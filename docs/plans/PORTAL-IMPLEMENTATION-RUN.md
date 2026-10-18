# PORTAL — Điều phối triển khai P0 + P1

- User duyệt gói ngày 18/10/2026; Epic [#406](https://github.com/hangndat/ticket-solution/issues/406), [roadmap primary](./PORTAL-ROADMAP.md), quyết định O16 và ADR-20.
- Run: `run_34fde1e32ed1`; coordinator gốc session `orca_session_id:codex_bcb66ba7_2f13_4e05_9b59_388347ec03c2`.
- Checkout docs/coordinator: `/Users/admin/orca/workspaces/ticket-solution/portal-coordination`, branch `hangndat/portal-coordination`, base `c7e344847b1acf1688302fef513b277fc8f18973` (origin/main lúc mở Run).
- Checkout `/main` đang có công việc khác; không đổi branch/reset/clean/stage mobile/infra hoặc các thay đổi ngoài PORTAL ở đó. 11 artifact nghiên cứu PORTAL được copy có giới hạn sang checkout này; không copy secrets/env.
- Quyền: coding/feature branch/commit/push/PR/review/CI/coordinator integration trong Epic đã duyệt. Không production DNS/TLS/deploy/cutover/cloud/store. P1.2 hiện chỉ chuẩn bị và kiểm thử local/môi trường được phép.
- Agent: `cursor` theo `.cursor/rules/orca-agent-routing.mdc`; model/effort theo host mặc định. Tất cả worker depth 1; chỉ coordinator dispatch.

## Checkpoint ban đầu

Project #3 live trước dispatch: chưa có PORTAL, D12/D13 đang chạy; 7 PR D13 mở (web/backend/ops/iOS). Coordinator D13 `run_1d13e6e391a0` xác nhận web/backend còn bận settle/rebase/merge. PORTAL chạy docs/ADR/planner/PD trước, không feature coding cùng ownership hoặc thay lockfile cho đến handoff rảnh.

Giao tiếp coordinator khác bằng đúng handle được `run-list` trả (`term_172fab9b-39dc-486d-9e65-e4cea827fca5`); `send --to run:<id>` chéo Run trả `run_not_found`, không báo gửi thành công. Lần gửi theo handle đã được enqueue và có reply; không takeover Run/merge PR D13 ngoài scope.

## Wave docs / handoff

| Issue | Role / scope | Task / Dispatch | Output |
| --- | --- | --- | --- |
| #408 (Story #407) | Epic planner; không code/spawn | `task_5cd80d44ef3e` / `ctx_86fb71bf5406` | `PORTAL-IMPLEMENTATION-TASKS.md`, `portal-task-manifest.json` |
| #409 | `architect`, `docs/agents/roles/architect.md`; Architecture impact Có | `task_fe3aadfcd481` / `ctx_0f85ebfd8721` | `docs/ops/ADR-20-PORTAL-ADMIN.md` |
| #410 | `product-design`, `docs/agents/roles/product-design.md`; Architecture impact Không (theo gói đã duyệt) | `task_61a47c5c4685` / `ctx_32f71830742d` | `docs/design/PORTAL-IMPLEMENTATION-HANDOFF.md` |

Root tooling/CI/lockfile/shared contracts: coordinator; `apps/portal` và `apps/web` là cùng slice web, không hai coding Dispatch feature đồng thời. Backend scope riêng; reviewer độc lập theo exact SHA. Mọi Task unblocked được fill dưới capacity/WIP sau khi ownership rảnh.

## Checks và giới hạn

- Root không có callable CRG/lean-ctx MCP trong danh sách tools hiện tại; fallback `rg`/source read khi cần, source thắng graph. Worker ghi riêng graph readiness trong report.
- `pnpm install --frozen-lockfile` trong checkout coordinator PASS; không thay lockfile.
- Node `v26.11.0`, pnpm `10.32.1` lúc thiết lập. Chưa có evidence runtime portal từ bước docs/handoff.
- `worker_done` không tự đóng Task hoặc Epic; cần DoD độc lập, CI/evidence theo Task, integration SHA khi required. Code complete / acceptance complete / pilot ready phân biệt.
