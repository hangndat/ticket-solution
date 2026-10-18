#!/usr/bin/env bash
# Cursor stop / afterAgentResponse → local agent-role-monitor ledger (privacy: no text/prompt).
# SoT: stop. afterAgentResponse is accepted but deduped by generation_id in ingest.
# Fail-open: never block the agent loop.
set -u
export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || {
  printf '%s\n' '{}'
  exit 0
}

INPUT="$(cat || true)"
if [[ -z "${INPUT//[[:space:]]/}" ]]; then
  printf '%s\n' '{}'
  exit 0
fi

# Best-effort ingest; stderr goes to local log (join_missing, etc.)
# Retry briefly so a parallel record-join can win the race before stop returns.
mkdir -p "$REPO_ROOT/.orca-metrics" 2>/dev/null || true
LOG="$REPO_ROOT/.orca-metrics/cursor-hooks.log"
TMP="$(mktemp -t agent-metrics-hook.XXXXXX 2>/dev/null || mktemp)"
printf '%s' "$INPUT" >"$TMP"
attempt=1
while [ "$attempt" -le 6 ]; do
  out="$(node "$REPO_ROOT/scripts/agent-role-monitor/cli.mjs" ingest-cursor-turn --stdin <"$TMP" 2>>"$LOG" || true)"
  printf '%s\n' "$out" >>"$LOG"
  case "$out" in
    *'"appended": true'*|*'"appended":true'*) break ;;
    *'"reason": "duplicate_generation"'*|*'"reason":"duplicate_generation"'*) break ;;
    *'"reason": "join_missing"'*|*'"reason":"join_missing"'*)
      sleep 0.2
      ;;
    *) break ;;
  esac
  attempt=$((attempt + 1))
done
rm -f "$TMP" 2>/dev/null || true

printf '%s\n' '{}'
exit 0
