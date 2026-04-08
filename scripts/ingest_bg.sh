#!/usr/bin/env bash
# Run the full dataset ingest in the background and return immediately.
# Logs are written to logs/ingest_<timestamp>.log
#
# Usage:
#   ./scripts/ingest_bg.sh [--docker] [--category visa] [--depth 2] [--refresh] [--sitemap]
#
# --docker  : Run inside Docker (builds image if needed, uses docker-compose.ingest.yml).
#             Remaining args are passed as CMD to the container.
# All other args are forwarded to run_ingest_dataset.ts (or Docker CMD).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/ingest_${TIMESTAMP}.log"

USE_DOCKER=false
INGEST_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker) USE_DOCKER=true; shift ;;
    *) INGEST_ARGS+=("$1"); shift ;;
  esac
done

# Default args if none provided
if [[ ${#INGEST_ARGS[@]} -eq 0 ]]; then
  INGEST_ARGS=("--refresh" "--depth" "2" "--sitemap")
fi

echo "Starting ingest in background..."
echo "  Log : $LOG_FILE"
echo "  Args: ${INGEST_ARGS[*]}"
echo "  Mode: $([ "$USE_DOCKER" = true ] && echo docker || echo local)"

if [ "$USE_DOCKER" = true ]; then
  nohup bash -c "
    cd '$PROJECT_DIR'
    echo 'Ingest started at \$(date)' >> '$LOG_FILE'
    docker compose -f docker-compose.ingest.yml run --rm ingest ${INGEST_ARGS[*]} >> '$LOG_FILE' 2>&1
    echo 'Ingest finished at \$(date)' >> '$LOG_FILE'
  " &>/dev/null &
else
  nohup bash -c "
    cd '$PROJECT_DIR'
    echo 'Ingest started at \$(date)' >> '$LOG_FILE'
    pnpm tsx run_ingest_dataset.ts ${INGEST_ARGS[*]} >> '$LOG_FILE' 2>&1
    echo 'Ingest finished at \$(date)' >> '$LOG_FILE'
  " &>/dev/null &
fi

BGPID=$!
echo "  PID: $BGPID"
echo "$BGPID" > "$LOG_DIR/ingest_last.pid"
echo ""
echo "Follow logs with:"
echo "  tail -f $LOG_FILE"
