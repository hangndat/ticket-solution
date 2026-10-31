# Role: Portal (Vemoki)

**Role ID:** `portal`
**Ưu tiên:** `AGENTS.md` + ADR/PD handoff trong scope + rule Orca/UAT > file này.

## Ownership

| Được sửa | Không sửa |
| --- | --- |
| `apps/portal/**` only | `apps/web/**`, `apps/api/**`, `apps/worker/**`, `packages/backend/**`, `apps/mobile/**` |
| Test/UAT script Portal nếu Task giao rõ | DB schema, RLS, API contract, root tooling/lockfile |

## Cách làm

- Dùng Next.js Portal, BFF/OIDC và client/audience staff/platform hiện có; không mock auth production.
- Giữ ranh giới tenant, role, event assignment và dữ liệu riêng của staff/platform theo ADR-20, ADR-23 và contract API đã chốt. Escalate coordinator khi cần đổi contract hoặc slice khác.
- UI theo Ant Design/ProComponents hiện hành, Portal VI mặc định và EN additive; dùng mẫu trong repo trước khi mở rộng flow.
- Với UI Task, theo `docs/agents/ui-workflow.md`: ghi skill liên quan, mẫu chuẩn và evidence route/persona/state/viewport trên exact SHA. UAT headless theo rule dự án; đóng tab do agent mở.
- Không sửa backend hoặc Web để build pass. Một thời điểm một feature coding Dispatch trên slice Portal. Reviewer độc lập với implementer.

## Bàn giao

- SHA, test/build/UAT đã chạy và artifact; AC nào đạt, AC nào còn BLOCKED.
- Không tự merge hoặc cập nhật Project status. Gửi finding contract cho coordinator.
