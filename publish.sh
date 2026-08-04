#!/usr/bin/env bash
# Build the site on /tmp (overlay, 2.6G space) and serve from dist/.
# /home is limited to 300M; node_modules for this project exceed that,
# so we build elsewhere and copy only the static output back.
set -euo pipefail
cd "$(dirname "$0")"

umask 002
mkdir -p .run

# Kill any previous server
pids=$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true)
[ -n "$pids" ] && kill $pids 2>/dev/null || true

# Build workspace on overlay filesystem (plenty of space)
BUILD_DIR="/tmp/impulsa-build-$$"
rm -rf "$BUILD_DIR" 2>/dev/null || true
mkdir -p "$BUILD_DIR"
# Copy source without the local dependency tree; dependencies are reinstalled in build workspace.
# This avoids duplicating node_modules and exhausting the small overlay filesystem.
tar --exclude='./node_modules' --exclude='./dist' --exclude='./.run' -cf - . | (cd "$BUILD_DIR" && tar -xf -)
cd "$BUILD_DIR"

BUN_INSTALL_CACHE_DIR=/tmp/.bun-cache bun install
# Vite does NOT clean dist — stale chunks from a previous build linger
# and get copied back. Remove it so the published bundle is exact.
rm -rf dist
bun run build

# Copy the static output back
rm -rf /home/team/shared/site/dist
cp -a dist /home/team/shared/site/dist
cd /home/team/shared/site

# Cleanup
rm -rf "$BUILD_DIR"

# Start server
setsid nohup bun run serve.ts > .run/server.log 2>&1 < /dev/null &

for _ in $(seq 1 50); do
  if curl -sf -o /dev/null http://localhost:3000; then
    echo "site published; serving on port 3000"
    exit 0
  fi
  sleep 0.2
done
echo "warning: published, but the server isn't responding — check .run/server.log" >&2
exit 1
