#!/usr/bin/env bash
# sessionStart: refresh CRG + inject readiness context for ticket-solution agents.
set -u
export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cat >/dev/null || true
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

ENSURE_OUT="$("$HOOK_DIR/crg-ensure-ready.sh" 2>&1 || true)"
ACTION="$(printf '%s\n' "$ENSURE_OUT" | sed -n 's/^CRG_ACTION=//p' | head -n1)"
STATUS="$(printf '%s\n' "$ENSURE_OUT" | sed -n '/^CRG_STATUS<<EOF$/,/^EOF$/p' | sed '1d;$d')"

export CRG_CONTEXT="$(cat <<CTX
## CRG readiness (auto — sessionStart)
Namespace MCP: \`code-review-graph-ticket\` (Cursor may show \`user-code-review-graph-ticket\`).
Ensure action this session: ${ACTION:-unknown}

\`\`\`
${STATUS:-graph status unavailable}
\`\`\`

**Gate — before coding/exploration/review work:** call \`list_graph_stats_tool\` first.
If empty/stale/MCP error → \`build_or_update_graph_tool\` then continue with graph tools.
Do not start Grep/broad file scans until the graph gate passes (docs-only Q&A exempt).
CTX
)"

python3 -c '
import json, os
print(json.dumps({
  "env": {"CRG_READY": "1", "CRG_NAMESPACE": "code-review-graph-ticket"},
  "additional_context": os.environ.get("CRG_CONTEXT", ""),
}))
' 2>/dev/null || echo '{"passed":true}'
exit 0
