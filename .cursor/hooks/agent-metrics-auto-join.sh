#!/usr/bin/env bash
# beforeSubmitPrompt → record-join when .orca-metrics/active-dispatch.json is set.
# Fail-open: never block the prompt.
set -u
umask 077
export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || {
  printf '%s\n' '{}'
  exit 0
}

ACTIVE="$REPO_ROOT/.orca-metrics/active-dispatch.json"
LOG="$REPO_ROOT/.orca-metrics/cursor-hooks.log"
HELPER="$REPO_ROOT/scripts/agent-role-monitor/auto-join-from-hook.mjs"
mkdir -p "$REPO_ROOT/.orca-metrics" 2>/dev/null || true
if ! { touch "$LOG" && chmod 600 "$LOG"; } 2>/dev/null; then
  printf '%s\n' '{}'
  exit 0
fi

INPUT="$(cat || true)"
if [[ -z "${INPUT//[[:space:]]/}" || ! -f "$ACTIVE" || ! -f "$HELPER" ]]; then
  printf '%s\n' '{}'
  exit 0
fi

printf '%s' "$INPUT" | node "$HELPER" >>"$LOG" 2>&1 || true

printf '%s\n' '{}'
exit 0
