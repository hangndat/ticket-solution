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
mkdir -p "$REPO_ROOT/.orca-metrics" 2>/dev/null || true
LOG="$REPO_ROOT/.orca-metrics/cursor-hooks.log"
printf '%s' "$INPUT" | node "$REPO_ROOT/scripts/agent-role-monitor/cli.mjs" ingest-cursor-turn \
  >>"$LOG" 2>&1 || true

printf '%s\n' '{}'
exit 0
