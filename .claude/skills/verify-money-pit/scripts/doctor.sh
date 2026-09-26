#!/usr/bin/env bash
# Usage: doctor.sh [port]
# Read-only: is the instance on this port ours, current, healthy, and wired to the dev database?
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${1:-3310}"
RUN=".verify/run-$PORT"
ok=1
say() { printf '%-10s %s\n' "$1" "$2"; }

if [[ -f "$RUN/pid" ]] && kill -0 "$(cat "$RUN/pid")" 2>/dev/null; then
  say process "pid $(cat "$RUN/pid") alive"
else
  say process "NOT RUNNING (no live pid in $RUN/pid)"; ok=0
fi

listener=$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
ours=0
p=$listener
while [[ -n "$p" && "$p" -gt 1 ]]; do
  [[ "$p" == "$(cat "$RUN/pid" 2>/dev/null)" ]] && { ours=1; break; }
  p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
done
if [[ $ours == 1 ]]; then
  say port "$PORT owned by our process tree (listener pid $listener)"
else
  say port "$PORT listener ${listener:-none} is not ours"; ok=0
fi

build_id=$(cat .next/BUILD_ID 2>/dev/null || echo none)
if [[ -f .next/BUILD_ID && -n "$(find src -newer .next/BUILD_ID -type f -print -quit)" ]]; then
  say build "$build_id is STALE (src changed since build); restart without --no-build"; ok=0
else
  say build "$build_id"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")
csp=$(curl -sI "http://127.0.0.1:$PORT/" | grep -ci '^content-security-policy')
say page "/ -> $code, CSP header present: $([[ $csp -gt 0 ]] && echo yes || echo NO)"
[[ $code == 200 && $csp -gt 0 ]] || ok=0

auth=$(curl -s "http://127.0.0.1:$PORT/api/auth/ok")
say auth "/api/auth/ok -> ${auth:-no response}"
[[ $auth == '{"ok":true}' ]] || ok=0

db_host=$(grep -E '^DATABASE_URL=' .env.local 2>/dev/null | sed -E 's#.*@([^.]*)\..*#\1#')
say database "${db_host:-no DATABASE_URL in .env.local} (must be the dev branch endpoint, never production's)"

[[ $ok == 1 ]] && echo "doctor: OK" || { echo "doctor: PROBLEMS ABOVE"; exit 1; }
