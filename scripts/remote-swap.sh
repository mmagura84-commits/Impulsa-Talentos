#!/usr/bin/env bash
# Runs ON the Hostinger server (piped over ssh by deploy.sh and the GitHub
# workflow). Swaps a fully uploaded build into public_html without downtime.
#   args: <live dir> <uploaded dir> <backup dir> <expected file count>
set -euo pipefail
LIVE="$1"; NEW="$2"; PREV="$3"; EXPECTED="$4"
GOT=$(find "$NEW" -type f | wc -l | tr -d ' ')
if [ "$GOT" != "$EXPECTED" ] || [ ! -f "$NEW/index.html" ] || [ ! -f "$NEW/.htaccess" ]; then
  echo "upload incomplete ($GOT of $EXPECTED files) — live site NOT changed"; exit 1
fi
rm -rf "$PREV" && cp -a "$LIVE" "$PREV"
cp -a "$NEW/." "$LIVE/"
# remove files that are no longer part of the build
(cd "$LIVE" && find . -type f) | while read -r f; do
  [ -e "$NEW/$f" ] || rm -f "$LIVE/$f"
done
find "$LIVE" -mindepth 1 -type d -empty -delete
rm -rf "$NEW"
echo "swapped ($GOT files); previous build kept in $PREV"
