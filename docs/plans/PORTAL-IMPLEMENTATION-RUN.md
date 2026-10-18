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

## Checkpoint tích hợp 18/10/2026 (không thay Project #3)

- PR #411: DoD + security revalidation PASS trên `176670d93fa25f4fe4829490f51a691653a4abf8`; merge `75b366fd1b39383e989c865e8081ecb1fff91934`; CI main `39133825296` SUCCESS. Tasks #408/#409/#410 và Story #407 nghiệm thu **tài liệu**.
- PR #444: workspace AntD bootstrap, pure `@ticket/web-session`, CI/Turbo/pre-push và contract nhân sự. DoD + security PASS trên `477d3c71e5eaa324d8141a73032e107fca763968`; merge `ba33dcd250f41cf797e249dca7af607f01522503`; CI main `39134227804` SUCCESS. Tasks #413/#414 nghiệm thu phạm vi nền tảng/contract, không runtime OIDC.
- PR #447: contract danh mục/import/filters/audit/Platform và architect handoff. DoD + security revalidation PASS trên `d203653b9b547cc480e103667bcf7caeef9b39d4`; merge `ef83adf46b29ade75e41b01fff14e6c0869fa70d`; CI main `39135176374` SUCCESS. Tasks #418/#422/#427/#431 nghiệm thu contract; OpenAPI và runtime thuộc backend consumers.
- PR #446 / Task #415: tip đầu `77c4c252c15d0538ad105dc163a4102c0a8530ca` DoD FAIL vì CI thiếu suite `portal-members.test.cjs`; security PASS với gap. Coordinator thêm shard trong commit `07389544dded9105169dfef0b81288839a11fb15`; worker fix delivery-state/OpenAPI và co-owner race trước revalidation. Chưa nghiệm thu.
- PR #449 / Task #416: tip `59b5440b2f1da53093a99cd00b8f057732e7ae95`, CI xanh; DoD/security đang duyệt. Chưa nghiệm thu auth/UI từ chỉ 18 unit tests và HTTP smoke.
- Task #419 catalog có worker riêng; coordinator thêm CI shard `portal-catalog` trong `f26e4e7` trước khi mở PR. Feature backend catalog và fix #446 là hai việc khác nhau; không hai feature backend Dispatch cùng lúc.

### Lifecycle và evidence

| Phạm vi | Task / Dispatch | Evidence |
| --- | --- | --- |
| PR #411 security revalidation | `task_955e00468165` / `ctx_9274dac0cbc6` | PR comment + `/tmp/portal-pr411-reviewer-security-revalidation.md` |
| PR #411 DoD revalidation | `task_30a28b2c2a8a` / `ctx_d6722c79b4d1` | PR comment + `/tmp/portal-pr411-reviewer-dod-revalidation.md` |
| PR #444 DoD / security | `ctx_4945a5c4acc4` / `ctx_426e5e28edeb` | PR comments + `/tmp/portal-pr444-reviewer-*.md` |
| #415 implement | `task_ff01b9ec8fe2` / `ctx_846cc7218f25` | PR #446; Docker DB tests; đã release |
| #416 implement | `task_f5e661f1ba9a` / `ctx_bda0341291f4` | PR #449; đã release |
| Architect import/privacy | `task_e7c7cd713a1a` / `ctx_57cfceac8c9e` | `docs/architecture/PORTAL-CONTRACT-HANDOFF.md`; đã release |
| PR #447 DoD / security | `ctx_0c15b9e1f3a2` / `ctx_172c9b2e800a` | PR comments trên d203653; đã release |
| #419 catalog | `task_8cee52c4f852` / `ctx_45c79aea21a1` | Checkout `portal-backend-catalog` |
| PR #446 first DoD / security | `ctx_199cddd755a4` / `ctx_7af16ab79375` | PR comments + `/tmp/portal-pr446-reviewer-*.md`; đã release |
| PR #446 fix | `task_9463581fc893` / `ctx_863978a814b7` | Checkout `portal-backend-members` |
| PR #449 DoD / security | `ctx_3c854ff96bc5` / `ctx_3cde56938f89` | Checkout `portal-web-foundation` |

Backpressure: ưu tiên review/fix/integration các PR đang mở. Không suy acceptance từ worker_done hoặc build. Bản ghi này là checkpoint, trạng thái động tiếp tục lấy Project #3.

### Làm rõ dependency thật

Task #424 attendee claim cần bảng và lifecycle invitation từ #423; ngoài contract #422, phải chờ #423. Không phát triển hai định nghĩa invitation song song. Các API Platform/audit/catalog không phải chờ toàn Story khác khi contract đã chốt và backend slice rảnh.
