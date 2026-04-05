#!/usr/bin/env bash
# Shared by ec2-cron-watch.sh and ec2-cron-job-feed.sh
# Loads .env-style files reliably on Linux (strips CRLF from Windows editors).

# Source env file: strip \r so CRON_SECRET=... works after editing on Windows.
ec2_cron_source_env() {
  local ENV_FILE="$1"
  set -a
  # shellcheck disable=SC1090
  source /dev/stdin <<< "$(tr -d '\r' < "$ENV_FILE")"
  set +a
}

ec2_cron_check_secrets() {
  local ENV_FILE="$1"
  if [[ -z "${CRON_SECRET:-}" ]]; then
    echo "ec2-cron: CRON_SECRET is empty after loading $ENV_FILE" >&2
    echo "  Fix: add a line with no spaces around =:" >&2
    echo "    CRON_SECRET=your-long-random-string" >&2
    echo "  Same value must be set for the running Next.js process (systemd/pm2)." >&2
    if grep -E '^[[:space:]]*CRON_SECRET=' "$ENV_FILE" >/dev/null 2>&1; then
      echo "  (File contains CRON_SECRET= but the value is empty or the line is malformed.)" >&2
    else
      echo "  (No CRON_SECRET= line found — copy from .env.example and fill in.)" >&2
    fi
    exit 1
  fi
  if [[ -z "${NEXTAUTH_URL:-}" ]]; then
    echo "ec2-cron: NEXTAUTH_URL is empty after loading $ENV_FILE" >&2
    echo "  Example: NEXTAUTH_URL=https://your-domain.com" >&2
    exit 1
  fi
}
