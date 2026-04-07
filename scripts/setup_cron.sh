#!/usr/bin/env bash
# Install a crontab entry to run the ingest periodically.
#
# Usage:
#   ./scripts/setup_cron.sh [--schedule "0 3 * * 0"] [--args "--refresh --depth 2"]
#
# Defaults:
#   schedule : "0 3 * * 0"  (every Sunday at 3 AM)
#   args     : "--refresh --depth 2 --sitemap"
#
# The cron job writes logs to <project>/logs/cron_ingest.log.
# To remove: crontab -e  (delete the MegaMind lines)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

SCHEDULE="0 3 * * 0"
INGEST_ARGS="--refresh --depth 2 --sitemap"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --schedule) SCHEDULE="$2"; shift 2 ;;
    --args)     INGEST_ARGS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

PNPM_BIN="$(which pnpm)"
CRON_CMD="cd '$PROJECT_DIR' && $PNPM_BIN tsx run_ingest_dataset.ts $INGEST_ARGS >> '$LOG_DIR/cron_ingest.log' 2>&1"
CRON_LINE="$SCHEDULE $CRON_CMD # MegaMind-ingest"

# Remove any existing MegaMind-ingest cron lines then add the new one
( crontab -l 2>/dev/null | grep -v '# MegaMind-ingest' ; echo "$CRON_LINE" ) | crontab -

echo "Cron job installed:"
echo "  Schedule : $SCHEDULE"
echo "  Args     : $INGEST_ARGS"
echo "  Log      : $LOG_DIR/cron_ingest.log"
echo ""
echo "Active crontab:"
crontab -l | grep MegaMind
