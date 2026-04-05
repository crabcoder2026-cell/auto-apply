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
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ec2-cron-common.sh"

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_ENV="$REPO_ROOT/.env.production"
ENV_FILE="${1:-${CRON_ENV_FILE:-$DEFAULT_ENV}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ec2-cron-job-feed: env file not found: $ENV_FILE" >&2
  echo "  Pass path as first arg, set CRON_ENV_FILE, or create $DEFAULT_ENV" >&2
  exit 1
fi

ec2_cron_source_env "$ENV_FILE"
ec2_cron_check_secrets "$ENV_FILE"

BASE="${NEXTAUTH_URL%/}"
curl -sS -f -H "Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/job-feed"
