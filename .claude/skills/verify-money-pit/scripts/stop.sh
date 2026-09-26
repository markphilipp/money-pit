#!/usr/bin/env bash
# Usage: stop.sh [port]
# Stops only the server start.sh launched on this port and removes its run dir. Evidence in .verify/evidence/ is kept.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${1:-3310}"
RUN=".verify/run-$PORT"

descendants() { for c in $(pgrep -P "$1" 2>/dev/null); do echo "$c"; descendants "$c"; done; }

if [[ -f "$RUN/pid" ]]; then
  pid=$(cat "$RUN/pid")
  tree="$pid $(descendants "$pid")"
  kill -TERM $tree 2>/dev/null
  for _ in $(seq 1 10); do kill -0 $tree 2>/dev/null || break; sleep 0.5; done
  kill -KILL $tree 2>/dev/null
fi
rm -rf "$RUN"

if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "port $PORT still has a listener that start.sh did not launch; left it alone" >&2
  exit 1
fi
echo "stopped $PORT; evidence kept in .verify/evidence/"
