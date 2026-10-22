# Portal — nhật ký điều phối nghiên cứu

- Ngày: 18/10/2026.
- User giao nghiên cứu và roadmap cho admin riêng `portal.vemoki.com`, UI `antd`, huy động nhóm.
- Run: `run_df32d5572a2d`; coordinator gốc: session `orca_session_id:codex_bcb66ba7_2f13_4e05_9b59_388347ec03c2`.
- Baseline source: `400ad87a1401972476c79f17c4fd726ca7538063`. Tài liệu nghiên cứu là thay đổi local chưa commit; SHA này không phải SHA nghiệm thu tài liệu mới.
- Chỉ nghiên cứu/thiết kế/lập kế hoạch. Chưa ủy quyền feature coding, commit/push/PR/merge, DNS/deploy hoặc store trong Run này.
- Project #3 đọc live lúc bắt đầu: 183 items; D12 #293 và D13 #301 đang làm. Các Task phát hành và thay đổi local ngoài phạm vi được giữ nguyên. Snapshot không thay authority trạng thái live.
- Agent cho mọi worker: `cursor`, theo `.cursor/rules/orca-agent-routing-coordinator.mdc`; model theo cấu hình host, không override.
- Các worker cùng checkout, output docs riêng; không đổi branch hoặc source. Không spawn con.

| Task | Role ID / hướng dẫn | Dispatch | Output |
| --- | --- | --- | --- |
| `task_b1db0479e51c` | Epic planner, `.cursor/rules/orca-epic-orchestrator.mdc` | `ctx_9b7a4ed81ac7` | `PORTAL-EPIC-TASKS.md` |
| `task_1e1ca2b60057` | `product-ba`, `docs/agents/roles/product-ba.md` | `ctx_618214f7487e` | `PORTAL-PRODUCT-RESEARCH.md` |
| `task_7419fcbe66d4` | `product-design`, `docs/agents/roles/product-design.md` | `ctx_a0717a2c4a4d` | `../design/PORTAL-ANTD-UX.md` |
| `task_e3802a180517` | `architect`, `docs/agents/roles/architect.md` | `ctx_196dc48c2047` | `../architecture/PORTAL-SUBDOMAIN-ANTD.md` |
| `task_dfb432b1adb9` | `web`, `docs/agents/roles/web.md` | `ctx_ffbb1b3b1e4e` | `PORTAL-WEB-FEASIBILITY.md` |
| `task_9f15db4d7b5c` | `backend`, `docs/agents/roles/backend.md` | `ctx_842110f979a5` | `PORTAL-BACKEND-GAPS.md` |
| `task_22d2801bd986` | `reviewer-security`, `docs/agents/roles/reviewer-security.md` | `ctx_d1b5882a474c` | `../reviews/PORTAL-DISCOVERY-SECURITY.md` |

Architecture impact: **Có** — tách host, session/OIDC, BFF/CSRF, ranh giới staff/Operator và migration Ant Design. Các kết luận trong output là đề xuất để user review, chưa là ADR được duyệt hay bằng chứng runtime.

## Kiểm tra và giới hạn

- Coordinator không có callable CRG/lean-ctx MCP trong danh sách tools; dùng tài liệu và source có giới hạn theo hướng dẫn fallback. Worker ghi riêng trạng thái graph trong báo cáo của mình.
- Không chạy build/UAT sản phẩm cho thay đổi docs-only; không suy ra triển khai portal đã tồn tại hoặc bảo mật đạt từ nghiên cứu.
- Baseline working tree đã có thay đổi `apps/mobile/README.md`, `apps/mobile/app.config.ts`, `infra/deploy/.env.example`, `infra/deploy/README.md`, `infra/deploy/compose.yaml`, `infra/keycloak/realm-ticket.json`; không thuộc Run này.

## Nguồn chính thức coordinator kiểm tra

Truy cập 18/10/2026:

- [Ant Design — Next.js](https://ant.design/docs/react/use-with-next/): App Router dùng registry để đưa style vào HTML đầu tiên.
- [Ant Design — theme](https://ant.design/docs/react/customize-theme/): token và component token cho thương hiệu.
- [Ant Design — Table](https://ant.design/components/table/): tham chiếu UI bảng; pagination/filter ở UI không thay API authorization hoặc server-side data contract.
- [Ant Design — i18n](https://ant.design/docs/react/i18n/).
- [ProComponents — Layout](https://procomponents.ant.design/en-US/components/layout/): tùy chọn đánh giá, không mặc định đổi framework.

## Kết quả và cleanup

Đã thu đủ 7 báo cáo nghiên cứu ban đầu; BA/PD/planner/security có lượt hiệu chỉnh trong cùng session. Tất cả đều giữ output docs riêng, không sửa source hoặc remote. Roadmap tổng hợp: [PORTAL-ROADMAP.md](./PORTAL-ROADMAP.md); root ROADMAP chỉ thêm pointer nghiên cứu. Sơ đồ HTML: `docs/design/PORTAL-ROADMAP.html` (tài liệu, không phải feature code).

| Lượt tiếp theo | Task | Dispatch | Kết quả |
| --- | --- | --- | --- |
| BA hiệu chỉnh source/status/confirmed scope | `task_9d9c544f13e5` | `ctx_5c57683a6d2e` | Đã bàn giao, session đã release |
| Planner hiệu chỉnh wave/HttpOnly/IdP/parity | `task_f67673d9a277` | `ctx_6a16980df5ee` | Đã bàn giao, session đã release |
| PD hiệu chỉnh parity/permissions/IDs | `task_0eb5082b4603` | `ctx_bf1cde2a4990` | Đã bàn giao, session đã release |
| Security hiệu chỉnh logout/mức yêu cầu/nguồn | `task_44cb95476884` | `ctx_d452d6a7e07e` | Đã bàn giao, session đã release |
| DoD độc lập cho kế hoạch | `task_ae34a0d6070d` | `ctx_0581c23228cc` | Xem `docs/reviews/PORTAL-ROADMAP-DOD.md` sau bàn giao |
| DoD revalidate glossary / wave mapping | `task_dfaa25a4b11c` | `ctx_6fc0c6d430b3` | Review delta trong cùng session độc lập; scope planning, không implementation |

Research sessions đầu không còn việc: đã release backend/web/architect và các session BA/PD/planner/security sau follow-up. Receipt `processAction=closed_agent_terminal`, archive `captured`. Bốn Dispatch cũ được reuse hiển thị `retained` lịch sử nhưng **không còn sở hữu resource**; resource đã chuyển cho follow-up và được release theo owner cuối. Không thao tác stop/release trùng resource đã chuyển.

Checks coordinator: `git diff --check` PASS; kiểm tra tất cả local links trong `PORTAL-ROADMAP.md` PASS. Không chạy build/UAT sản phẩm cho docs-only; không claim portal runtime hoặc acceptance. DoD độc lập ghi SHA256 nội dung docs local để không gán nhầm baseline SHA cho tài liệu mới.

Review lần đầu: `PASS with known gap` cho planning; coordinator bổ sung glossary cross-artifact và map I1/I2/I3 → P0.x/P1.x trong roadmap do mình sở hữu, rồi giao revalidation độc lập. Sơ đồ HTML inline JavaScript được kiểm syntax bằng `node` + `vm.Script` PASS; chưa kiểm render/a11y runtime. SHA256 roadmap/root pointer/visual trong artifact review là nội dung được review; run log này cập nhật lifecycle sau review, không nằm trong scope fingerprint kết luận của delta.

`worker_done` chỉ chứng minh Task nghiên cứu đã bàn giao; không đóng Epic triển khai hoặc đánh dấu portal production/pilot ready. Chưa commit/push/PR; chưa tạo Epic board (hierarchy là đề xuất chờ duyệt); không thay Status D12/D13.

### Kết thúc Run nghiên cứu

- DoD delta: **PASS (planning)**, [artifact](../reviews/PORTAL-ROADMAP-DOD.md); KG-1…KG-4 resolved trong bản tổng hợp. Primary roadmap SHA256: `575d2dfb6cc07f8b72fbf32d1b058c3a79a4fe09a6c3e463cc61e153787ad8ec`.
- Đã release **8 session/resource duy nhất**; receipt owner cuối đều `closed_agent_terminal` / archive `captured`. Audit `worker-list --run run_df32d5572a2d`: không active/reclaimable; 8 resource `released`; 5 Dispatch lịch sử `retained` do reuse không còn resource riêng. Không còn session/task-owned process phải giữ trong Run.
- Delivery cuối `delivery_dddb9fde719f` đã ack; check trả 0 messages, không còn question pending. Tổng cộng 13 Dispatch gồm research, hiệu chỉnh và review; tất cả đã settle. Không có Task coding đang chạy.
- Output: 11 file PORTAL mới (Markdown/HTML) và pointer 2 dòng trong `docs/ROADMAP.md`; không đổi source/mobile/infra từ Run này. Baseline commit giữ `400ad87a1401972476c79f17c4fd726ca7538063`; chưa tạo commit mới.
- Việc tiếp theo: người dùng review gói P0/P1 ở `PORTAL-ROADMAP.md` §7; ADR/Task dispatch triển khai chỉ sau phạm vi được duyệt, production cutover vẫn cần ủy quyền riêng.
