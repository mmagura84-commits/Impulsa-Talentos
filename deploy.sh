#!/usr/bin/env bash
# Deploy the static build to Hostinger without taking the site down.
#
#   ./deploy.sh
#
# Order (the old script deleted public_html first, then uploaded — a failed
# upload left the site at 403/404, see the 2026-08-27 incident):
#   1. build into a temp workspace and check the bundle targets the LIVE
#      Supabase project and contains index.html + .htaccess
#   2. upload everything to public_html.incoming (live site untouched)
#   3. on the server: verify the upload, back up public_html to
#      public_html.prev, copy the new files over the live ones, then remove
#      files that are no longer part of the build
#   Roll back: ssh in and `rm -rf public_html && cp -a public_html.prev public_html`
#
# Override any setting with env vars.
set -euo pipefail
cd "$(dirname "$0")"

SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/hostinger_deploy}"
REMOTE_HOST="${DEPLOY_HOST:-72.62.221.138}"
REMOTE_PORT="${DEPLOY_PORT:-65002}"
REMOTE_USER="${DEPLOY_USER:-u774117868_0D7T1hSPl}"
REMOTE_PATH="${DEPLOY_PATH:-/home/u774117868/websites/0D7T1hSPl/public_html}"
LIVE_REF="cmdqlybsgkegolqydmbh"
LEGACY_REF="wpnkeryyhsdsislqaegb"

# Hostinger rotates host keys across its SSH nodes (see the workflow note), so
# strict pinning breaks every other connection; the deploy key is the guard.
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=20 -i "$SSH_KEY")
REMOTE="$REMOTE_USER@$REMOTE_HOST"
INCOMING="${REMOTE_PATH%/}.incoming"
PREV="${REMOTE_PATH%/}.prev"

echo "═══ Impulsa Talentos Deploy ═══"
[ -f "$SSH_KEY" ] || { echo "SSH key not found: $SSH_KEY (set DEPLOY_SSH_KEY)"; exit 1; }

# 1. Build in a throwaway copy (keeps the working tree's dist/ untouched)
echo "📦 Building..."
BUILD_DIR="$(mktemp -d /tmp/impulsa-deploy-XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT
tar --exclude='./node_modules' --exclude='./dist' --exclude='./.run' --exclude='./.git' -cf - . | (cd "$BUILD_DIR" && tar -xf -)
cd "$BUILD_DIR"
BUN_INSTALL_CACHE_DIR=/tmp/.bun-cache bun install --silent
rm -rf dist
SITE_URL="https://impulsatalentos.expert" bun run build
cp .htaccess dist/.htaccess

for f in index.html .htaccess; do
  [ -f "dist/$f" ] || { echo "❌ dist/$f missing — refusing to deploy"; exit 1; }
done
if grep -rq --include='*.js' "$LEGACY_REF" dist/assets/; then
  echo "❌ bundle references the LEGACY Supabase project — refusing to deploy"; exit 1
fi
if ! grep -rq --include='*.js' "$LIVE_REF" dist/assets/; then
  echo "❌ bundle does not reference the LIVE Supabase project — refusing to deploy"; exit 1
fi
FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')
echo "✅ Build OK ($FILE_COUNT files)"

# 2. Upload to the staging folder next to public_html
echo "🚀 Uploading to staging folder..."
ssh "${SSH_OPTS[@]}" -p "$REMOTE_PORT" "$REMOTE" "rm -rf '$INCOMING' && mkdir -p '$INCOMING'"
BATCH_FILE="$BUILD_DIR/sftp-batch.txt"
: > "$BATCH_FILE"
(cd dist && find . -type d ! -name . | sort | sed 's#^\./##' | while read -r d; do echo "mkdir \"$d\""; done) >> "$BATCH_FILE"
(cd dist && find . -type f | sed 's#^\./##' | while read -r f; do echo "put \"$f\" \"$f\""; done) >> "$BATCH_FILE"
(cd dist && sftp -b "$BATCH_FILE" "${SSH_OPTS[@]}" -P "$REMOTE_PORT" "$REMOTE:$INCOMING" >/dev/null)

# 3. Verify on the server, back up, then swap in place
echo "🔁 Swapping in the new build..."
ssh "${SSH_OPTS[@]}" -p "$REMOTE_PORT" "$REMOTE" bash -s -- "$REMOTE_PATH" "$INCOMING" "$PREV" "$FILE_COUNT" < "$BUILD_DIR/scripts/remote-swap.sh"

echo ""
echo "✅ Deploy complete — https://impulsatalentos.expert"
