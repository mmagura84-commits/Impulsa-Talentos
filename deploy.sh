#!/usr/bin/env bash
# Auto-deploy to Hostinger — build + upload
# Usage: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

SSH_KEY="/home/agent-lead/.ssh/hostinger_deploy"
REMOTE_HOST="72.62.221.138"
REMOTE_PORT="65002"
REMOTE_USER="u774117868_0D7T1hSPl"
REMOTE_PATH="/home/u774117868/websites/0D7T1hSPl/public_html"

SSH_CMD="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $REMOTE_PORT -i $SSH_KEY"

echo "═══ Impulsa Talentos Deploy ═══"
echo ""

# 1. Build
echo "📦 Building..."
BUILD_DIR=/tmp/impulsa-deploy-$$
rm -rf "$BUILD_DIR" 2>/dev/null || true
mkdir -p "$BUILD_DIR"
# Copy everything except node_modules and dist (bun install + build recreate them)
find . -mindepth 1 -maxdepth 1 ! -name node_modules ! -name dist ! -name .run \
  -exec cp -a {} "$BUILD_DIR/" \;
cd "$BUILD_DIR"
BUN_INSTALL_CACHE_DIR=/tmp/.bun-cache bun install --silent
rm -rf dist
SITE_URL="https://impulsatalentos.expert" bun run build

# Copy htaccess
HTACCESS_SRC="/home/team/shared/hostinger-deploy/.htaccess"
if [ -f "$HTACCESS_SRC" ]; then
  cp "$HTACCESS_SRC" dist/.htaccess
fi

FILE_COUNT=$(find dist -type f | wc -l)
echo "✅ Build complete ($FILE_COUNT files)"
echo ""

# 2. Clear remote public_html
echo "🧹 Clearing old files..."
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_PATH' && rm -rf ./* .htaccess 2>/dev/null; echo 'cleared'"

# 3. Upload new files via SFTP
echo "🚀 Uploading..."

BATCH_FILE="/tmp/sftp-batch-$$.txt"
cd dist

# Create directory structure first
find . -type d | while read -r dir; do
  [ "$dir" = "." ] && continue
  echo "mkdir $dir" >> "$BATCH_FILE"
done

# Then upload all files
find . -type f | while read -r file; do
  echo "put \"$file\" \"$file\"" >> "$BATCH_FILE"
done

sftp -b "$BATCH_FILE" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -P "$REMOTE_PORT" -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH" 2>&1 | tail -3

# Cleanup
rm -f "$BATCH_FILE"
cd /
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Deploy complete!"
echo "   https://impulsatalentos.expert"
