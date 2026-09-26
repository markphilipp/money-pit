#!/usr/bin/env bash
# Usage: start.sh [port] [--no-build]
# Builds and starts one isolated production server. Prints the run dir; state lives in .verify/run-<port>/.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
export PATH="$HOME/.bun/bin:$PATH"

PORT="${1:-3310}"
BUILD=1
[[ "${2:-}" == "--no-build" ]] && BUILD=0
RUN=".verify/run-$PORT"

if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "port $PORT is already in use; pick another port or run stop.sh $PORT" >&2
  exit 1
fi

mkdir -p "$RUN"
if [[ $BUILD == 1 ]]; then
  bun run build >"$RUN/build.log" 2>&1 || { echo "build failed, see $RUN/build.log" >&2; exit 1; }
fi

nohup bunx next start -p "$PORT" >"$RUN/server.log" 2>&1 &
echo $! >"$RUN/pid"

for _ in $(seq 1 60); do
  if curl -fs -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "ready: http://127.0.0.1:$PORT (pid $(cat "$RUN/pid"), logs $RUN/server.log)"
    exit 0
  fi
  sleep 1
done
echo "server did not answer on $PORT within 60s, see $RUN/server.log" >&2
exit 1
