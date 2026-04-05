#!/usr/bin/env bash
# Run ON EC2 once: writes CRON_SECRET + NEXTAUTH_URL into .env.production (same values as Next.js).
#
#   export CRON_SECRET='same-as-your-node-process'
#   export NEXTAUTH_URL='https://your-public-domain.com'
#   ./scripts/ec2-set-cron-env.sh
#
# Optional: ./scripts/ec2-set-cron-env.sh /path/to/.env.production

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$REPO/.env.production}"

if [[ -z "${CRON_SECRET:-}" || -z "${NEXTAUTH_URL:-}" ]]; then
  echo "Missing env. On EC2 run:" >&2
  echo '  export CRON_SECRET="(same secret your Next app uses)"' >&2
  echo '  export NEXTAUTH_URL="https://your-site.com"' >&2
  echo "  $REPO/scripts/ec2-set-cron-env.sh" >&2
  exit 1
fi

umask 077
tmp="$(mktemp)"
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  grep -vE '^[[:space:]]*CRON_SECRET=' "$ENV_FILE" | grep -vE '^[[:space:]]*NEXTAUTH_URL=' > "$tmp" || true
else
  : > "$tmp"
fi
{
  echo ""
  echo "# Cron + NextAuth (ec2-set-cron-env.sh — keep in sync with systemd/pm2)"
  printf 'CRON_SECRET=%q\n' "$CRON_SECRET"
  printf 'NEXTAUTH_URL=%q\n' "$NEXTAUTH_URL"
} >> "$tmp"
mv "$tmp" "$ENV_FILE"
echo "Updated: $ENV_FILE"
echo "Test: $REPO/scripts/ec2-cron-watch.sh \"$ENV_FILE\""
