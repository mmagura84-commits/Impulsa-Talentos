#!/usr/bin/env bash
# Background daemon: checks for site changes every 24h and auto-deploys.
# Start: nohup ./auto-deploy-daemon.sh > /dev/null 2>&1 &
# Stop:  pkill -f auto-deploy-daemon
set -euo pipefail
cd "$(dirname "$0")"

STAMP_FILE="/home/team/shared/.last-deploy-hash"
LOG_FILE="/home/team/shared/site/.run/auto-deploy.log"
mkdir -p /home/team/shared/site/.run

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

log "Auto-deploy daemon started (checks every 24h)"

while true; do
  sleep 86400  # 24 hours

  # Hash all source files (exclude node_modules, dist, .run)
  CURRENT_HASH=$(find . -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/.run/*' \
    ! -name '.last-deploy-hash' \
    -exec md5sum {} \; | sort -k2 | md5sum | cut -d' ' -f1)

  STORED_HASH=$(cat "$STAMP_FILE" 2>/dev/null || echo "")

  if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    log "Changes detected, deploying..."
    if bash deploy.sh >> "$LOG_FILE" 2>&1; then
      echo "$CURRENT_HASH" > "$STAMP_FILE"
      log "Deploy successful"
    else
      log "Deploy FAILED — check log"
    fi
  else
    log "No changes, skipping deploy"
  fi
done
