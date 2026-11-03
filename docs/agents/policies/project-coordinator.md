# GitHub Project tracking (coordinator)

Bổ sung [Project/DoD](project.md). Leader Read khi orchestrate.

## Reviewer spawn

Task `Chờ duyệt` **nhánh B** → một reviewer độc lập/PR (review only). Nhánh A: không spawn reviewer. Nhiều PR độc lập → reviewer song song, cap ≤3 live (`docs/agents/workflows/dispatch.md`). Agent: `docs/agents/workflows/dispatch.md`.

Áp dụng [quy trình review/fix](../workflows/review.md) trước review/fix: lưu findings và số lượt trên Issue/PR; bị ngắt → `Bị chặn` kèm owner/điều kiện mở lại, không tự quay lại ready queue. Revalidation ưu tiên reviewer cũ nếu phù hợp, luôn khác implementer.

**Wave C:** DoD+security cùng SHA → một `James · dod+sec`; tách chỉ hot path + lý do evidence.

Architecture impact `Có`: DoD đối chiếu ADR; drift → `architect` trên exact SHA (song song DoD OK).

## Milestone / Epic DoD

| Gate            | Yêu cầu                                                 |
| --------------- | ------------------------------------------------------- |
| (a) UAT         | Orca tab/emulator — `docs/agents/workflows/uat.md`      |
| (b) iOS local   | prebuild + xcodebuild khi chạm mobile — không EAS cloud |
| (c) Deploy prod | Chỉ khi authorize                                       |
| (d) Reviews     | `docs/reviews/*` hoặc comment Issue/PR + exact SHA      |

## WIP / backpressure

Đầy khi: ≥3 `Chờ duyệt` board, hoặc ≥2 PR/slice chờ merge, hoặc ≥4 PR mở thiếu DoD+CI.

Ưu tiên: review → fix → CI → merge → feature mới. Soft caps: `docs/agents/workflows/dispatch.md` (≤5 non-review + ≤3 reviewer, ≤1 feature/slice).

Idle fill: `docs/agents/workflows/dispatch.md`.

## Đo lường nhẹ

Thời gian chờ duyệt, CI re-run, reopen, `inherit%` (cost-wave) — ghi comment đợt.

## `gh` sketch

**Project list (cache — không gọi lặp mỗi spawn):**

```bash
CACHE="${TMPDIR:-/tmp}/ticket-project3-items.json"
if [[ ! -f "$CACHE" || "${TICKET_PROJECT3_REFRESH:-}" == 1 ]]; then
  gh project item-list 3 --owner hangndat --limit 120 --format json >"$CACHE"
fi
# Chỉ refresh: TICKET_PROJECT3_REFRESH=1 hoặc xóa $CACHE; refresh sau khi sửa Project và trước quyết định phụ thuộc status mới.
```

**PR CI evidence (DoD / reviewer spec):** `./scripts/gh-dod-evidence.sh <pr>` — xem `docs/agents/policies/github-api.md`. Nhiều reviewer live: coordinator prefetch hoặc stagger 30s giữa các lần gọi.

```bash
gh project item-edit --project-id PVT_kwHOAGoDWs4BnWaN \
  --id <ITEM_ID> --field-id PVTSSF_lAHOAGoDWs4BnWaNzhl7cPk \
  --single-select-option-id <OPTION_ID>
```

Status ids: Đang làm `8c0ed3f4` · Chờ duyệt `0544c261` · Bị chặn `e6e061c9` · Hoàn thành `98236657` · Sẵn sàng `47fc9ee4` · Chưa lên lịch `f75ad846`.

Re-fetch `gh project field-list 3 --owner hangndat --format json` **chỉ khi** `item-edit` fail (không mỗi wave).
