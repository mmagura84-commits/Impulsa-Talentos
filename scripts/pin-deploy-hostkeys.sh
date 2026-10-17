#!/usr/bin/env bash
# Collect the SSH host keys of the Hostinger deploy server for deploy.sh and the
# HOSTINGER_KNOWN_HOSTS GitHub secret. The server sits behind several nodes with
# different keys, so this connects repeatedly and keeps every distinct key.
#
# It only DISCOVERS keys: compare the printed fingerprints with the ones shown in
# hPanel (Hosting -> Advanced -> SSH access) BEFORE trusting them. Anything you
# have not verified could be an attacker's key.
#
#   scripts/pin-deploy-hostkeys.sh            # prints fingerprints + writes the file
#   DEPLOY_KNOWN_HOSTS=/path scripts/pin-deploy-hostkeys.sh
set -euo pipefail
HOST="${DEPLOY_HOST:-72.62.221.138}"; PORT="${DEPLOY_PORT:-65002}"
OUT="${DEPLOY_KNOWN_HOSTS:-$HOME/.ssh/hostinger_known_hosts}"
TRIES="${TRIES:-12}"
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
for _ in $(seq "$TRIES"); do ssh-keyscan -T 10 -p "$PORT" "$HOST" 2>/dev/null >> "$tmp" || true; done
sort -u "$tmp" | grep -v '^#' > "$tmp.u" || true
[ -s "$tmp.u" ] || { echo "no keys received from $HOST:$PORT" >&2; exit 1; }
echo "Distinct keys seen in $TRIES connections (verify these in hPanel):"
ssh-keygen -lf "$tmp.u" -E sha256
mkdir -p "$(dirname "$OUT")"; cp "$tmp.u" "$OUT"; chmod 600 "$OUT"
echo "Wrote $OUT. For GitHub Actions, store its contents in the HOSTINGER_KNOWN_HOSTS secret."
