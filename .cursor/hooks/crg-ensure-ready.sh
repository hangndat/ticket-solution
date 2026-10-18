#!/usr/bin/env bash
# Ensure ticket-solution code-review-graph is present and current for this HEAD.
# Used by sessionStart / beforeSubmitPrompt. Never blocks the editor (exit 0).
set -u

export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

CRG_BIN="$(command -v code-review-graph || true)"
if [[ -z "$CRG_BIN" ]]; then
  printf '%s\n' "CRG_MISSING: code-review-graph not on PATH"
  exit 0
fi

DB="$REPO_ROOT/.code-review-graph/graph.db"
ACTION="ok"

if [[ ! -f "$DB" ]]; then
  ACTION="build"
  "$CRG_BIN" build >/tmp/crg-ensure-build.log 2>&1 || true
else
  STATUS="$("$CRG_BIN" status 2>&1 || true)"
  if printf '%s' "$STATUS" | grep -Eqi 'WARNING|not built|graph not|but you are now on'; then
    ACTION="update"
    "$CRG_BIN" update >/tmp/crg-ensure-update.log 2>&1 || true
  fi
fi

STATUS_AFTER="$("$CRG_BIN" status 2>&1 || true)"
SUMMARY="$(printf '%s' "$STATUS_AFTER" | head -n 8)"

printf 'CRG_ACTION=%s\n' "$ACTION"
printf 'CRG_STATUS<<EOF\n%s\nEOF\n' "$SUMMARY"
exit 0
