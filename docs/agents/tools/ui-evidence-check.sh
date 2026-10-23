#!/usr/bin/env bash
# Kiểm thư mục evidence UI trước khi gửi worker_done.
# Dùng: bash docs/agents/tools/ui-evidence-check.sh <assets-dir>
# Exit 1 nếu có file trùng nội dung (ảnh hoặc probe JSON) — trùng nghĩa là chụp/đo sai state.
set -euo pipefail
# Full provenance/state/scope gate (preferred for agent handoff).
if [[ "${1:-}" == "--manifest" ]]; then
  script_root="$(cd "$(dirname "$0")/../../.." && pwd)"
  shift
  exec node "$script_root/scripts/agent-workflow-guard.mjs" handoff --manifest "$@"
fi
dir="${1:?Cần đường dẫn thư mục assets}"
[ -d "$dir" ] || { echo "Không thấy thư mục: $dir" >&2; exit 2; }
dups=$(cd "$dir" && find . -maxdepth 1 -type f -exec shasum -a 256 -- {} + | sort | awk '{n[$1]++; f[$1]=f[$1]" "$2} END {for (h in n) if (n[h] > 1) print substr(h,1,12)":"f[h]}')
if [ -n "$dups" ]; then
  echo "FAIL: file trùng nội dung — chụp lại đúng state hoặc xóa:"
  echo "$dups"
  exit 1
fi
echo "OK: $(ls "$dir" | wc -l | tr -d ' ') file, không trùng nội dung."
