#!/usr/bin/env bash
# Run the full dataset ingest in the background and return immediately.
# Logs are written to logs/ingest_<timestamp>.log
#
# Usage:
#   ./scripts/ingest_bg.sh [--category visa] [--depth 2] [--refresh] [--sitemap]
#
# All arguments are forwarded to run_ingest_dataset.ts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/ingest_${TIMESTAMP}.log"

echo "Starting ingest in background..."
echo "  Log: $LOG_FILE"
echo "  Args: $*"

nohup bash -c "
  cd '$PROJECT_DIR'
  echo 'Ingest started at \$(date)' >> '$LOG_FILE'
  pnpm tsx run_ingest_dataset.ts $* >> '$LOG_FILE' 2>&1
  echo 'Ingest finished at \$(date)' >> '$LOG_FILE'
" &>/dev/null &

BGPID=$!
echo "  PID: $BGPID"
echo "$BGPID" > "$LOG_DIR/ingest_last.pid"
echo "Background ingest running. Follow logs with:"
echo "  tail -f $LOG_FILE"
