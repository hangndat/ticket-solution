#!/usr/bin/env bash
# beforeSubmitPrompt: ensure graph + inject compact gate (once per conversation).
set -u
export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

INPUT="$(cat || true)"
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
MARKER_DIR="$REPO_ROOT/.code-review-graph/session-gates"
mkdir -p "$MARKER_DIR" 2>/dev/null || true

CONV_ID="$(python3 -c 'import json,sys
try:
  d=json.load(sys.stdin)
  print(d.get("conversation_id") or d.get("session_id") or "unknown")
except Exception:
  print("unknown")
' <<<"$INPUT" 2>/dev/null || echo unknown)"

MARKER="$MARKER_DIR/${CONV_ID}.ready"

# Always refresh graph lightly; only inject verbose context on first prompt of conversation.
ENSURE_OUT="$("$HOOK_DIR/crg-ensure-ready.sh" 2>&1 || true)"
ACTION="$(printf '%s\n' "$ENSURE_OUT" | sed -n 's/^CRG_ACTION=//p' | head -n1)"
STATUS="$(printf '%s\n' "$ENSURE_OUT" | sed -n '/^CRG_STATUS<<EOF$/,/^EOF$/p' | sed '1d;$d' | head -n 6)"

if [[ -f "$MARKER" ]]; then
  python3 -c 'import json; print(json.dumps({"continue": True}))' 2>/dev/null || echo '{"continue":true}'
  exit 0
fi

touch "$MARKER" 2>/dev/null || true

export CRG_CONTEXT="$(cat <<CTX
## CRG readiness gate (auto — first prompt)
MCP namespace: \`code-review-graph-ticket\`. Ensure action: ${ACTION:-unknown}
${STATUS}

Before coding/exploration/review: call \`list_graph_stats_tool\`; if stale/empty → \`build_or_update_graph_tool\`. Then use graph tools first. Docs-only Q&A exempt.
CTX
)"

python3 -c '
import json, os
print(json.dumps({
  "continue": True,
  "additional_context": os.environ.get("CRG_CONTEXT", ""),
}))
' 2>/dev/null || echo '{"continue":true}'
exit 0
