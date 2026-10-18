#!/usr/bin/env bash
# afterFileEdit: incremental graph update for ticket-solution.
set -u
export PATH="/Users/admin/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cat >/dev/null || true
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0
code-review-graph update --skip-flows >/dev/null 2>&1 || true
python3 -c 'import json; print(json.dumps({"passed": True}))' 2>/dev/null || echo '{"passed":true}'
exit 0
