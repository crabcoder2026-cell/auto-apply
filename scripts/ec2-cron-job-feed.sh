#!/usr/bin/env bash
# Hit /api/cron/job-feed (Auto Search cache refresh via headless Chrome on the server).
#
# Usage:
#   ./scripts/ec2-cron-job-feed.sh [/path/to/envfile]
#
# Same env file as the Next app: CRON_SECRET, NEXTAUTH_URL.
# Job-feed also needs Chrome on the server (CHROME_PATH in that env file or systemd unit).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_ENV="$REPO_ROOT/.env.production"
ENV_FILE="${1:-${CRON_ENV_FILE:-$DEFAULT_ENV}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ec2-cron-job-feed: env file not found: $ENV_FILE" >&2
  echo "  Pass path as first arg, set CRON_ENV_FILE, or create $DEFAULT_ENV" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "ec2-cron-job-feed: CRON_SECRET is empty in $ENV_FILE" >&2
  exit 1
fi
if [[ -z "${NEXTAUTH_URL:-}" ]]; then
  echo "ec2-cron-job-feed: NEXTAUTH_URL is empty in $ENV_FILE" >&2
  exit 1
fi

BASE="${NEXTAUTH_URL%/}"
curl -sS -f -H "Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/job-feed"
