#!/usr/bin/env bash
# Hit /api/cron/watch (Auto pilot). Intended for EC2/Linux crontab.
#
# Usage:
#   ./scripts/ec2-cron-watch.sh [/path/to/envfile]
#
# Env file must define (same as your running Next app):
#   CRON_SECRET=...
#   NEXTAUTH_URL=https://your-domain.com   # or http://127.0.0.1:3000 if app is local-only
#
# Override default env path:
#   export CRON_ENV_FILE=/etc/auto-apply/cron.env
#   ./scripts/ec2-cron-watch.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_ENV="$REPO_ROOT/.env.production"
ENV_FILE="${1:-${CRON_ENV_FILE:-$DEFAULT_ENV}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ec2-cron-watch: env file not found: $ENV_FILE" >&2
  echo "  Pass path as first arg, set CRON_ENV_FILE, or create $DEFAULT_ENV" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "ec2-cron-watch: CRON_SECRET is empty in $ENV_FILE" >&2
  exit 1
fi
if [[ -z "${NEXTAUTH_URL:-}" ]]; then
  echo "ec2-cron-watch: NEXTAUTH_URL is empty in $ENV_FILE" >&2
  exit 1
fi

BASE="${NEXTAUTH_URL%/}"
curl -sS -f -H "Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/watch"
