#!/usr/bin/env bash
# Runs ON the Hostinger server (piped over ssh by deploy.sh and the GitHub
# workflow). Swaps a fully uploaded build into public_html without downtime.
#   args: <live dir> <uploaded dir> <backup dir> <expected file count>
# The account can't create folders next to public_html, so the upload and the
# backup live in public_html/.deploy/ (blocked from the web by .htaccess) and
# are never touched by the copy or the prune.
set -euo pipefail
LIVE="$1"; NEW="$2"; PREV="$3"; EXPECTED="$4"
GOT=$(find "$NEW" -type f | wc -l | tr -d ' ')
if [ "$GOT" != "$EXPECTED" ] || [ ! -f "$NEW/index.html" ] || [ ! -f "$NEW/spa-fallback.html" ] || [ ! -f "$NEW/.htaccess" ] || [ ! -f "$NEW/page.php" ]; then
  echo "upload incomplete ($GOT of $EXPECTED files) — live site NOT changed"; exit 1
fi
# back up the current site (everything except .deploy/)
rm -rf "$PREV" && mkdir -p "$PREV"
tar -C "$LIVE" --exclude=./.deploy -cf - . | tar -C "$PREV" -xf -
# copy the new build over the live files
cp -a "$NEW/." "$LIVE/"
# remove files that are no longer part of the build
# (hidden files/folders such as .well-known — SSL renewals — are left alone,
# like the old deploy did; only .htaccess is managed by the build)
(cd "$LIVE" && find . -path ./.deploy -prune -o -type f -print) | while read -r f; do
  case "$f" in ./.htaccess) ;; */.*) continue ;; esac
  [ -e "$NEW/$f" ] && continue
  # Keep earlier builds' scripts and styles for 14 days: a page cached by the
  # CDN or a browser tab opened before the deploy still loads the files it
  # names (they are content-hashed, so they never clash with the new build).
  case "$f" in ./assets/*) [ -n "$(find "$LIVE/$f" -mtime -14 2>/dev/null)" ] && continue ;; esac
  rm -f "$LIVE/$f"
done
find "$LIVE" -path "$LIVE/.deploy" -prune -o -mindepth 1 -type d -empty -print | xargs -r rmdir 2>/dev/null || true
rm -rf "$NEW"
echo "swapped ($GOT files); previous build kept in $PREV"
