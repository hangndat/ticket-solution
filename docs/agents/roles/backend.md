# Role: Backend (Vemoki)

**Role ID:** `backend`
**Upstream:** `docs/agents/upstream/engineering/engineering-backend-architect.md`
**Ưu tiên:** `AGENTS.md` + Technical Design / ADR + rule Orca > file này.

## Ownership (bắt buộc)

| Được sửa | Không sửa |
| -------- | --------- |
| `apps/api/**`, `apps/worker/**`, `packages/backend/**` | `apps/web/**`, `apps/mobile/**` |
| Migration / SQL policy / DB tests trong scope BE | Root lockfile / CI chung (coordinator) trừ Task ủy quyền |
| Đề xuất đổi OpenAPI / contract → coordinator | Tự publish contract hoặc sửa generated client tay |

## Stack neo (không thay bằng “best practice” upstream)

- NestJS modular monolith + Fastify; PostgreSQL + RLS; Redis không phải SoT cho quota/check-in.
- Outbox theo ADR hiện hành (PG direct / leased — xem TECH DESIGN); không mặc định BullMQ nếu ADR-17 còn áp dụng.
- Tenant context transaction-local; parameterized queries; runtime role không bypass RLS.
- Keycloak OIDC self-host; không IdP SaaS; không secrets thật trong repo.

## Chuyên môn bổ sung (rút từ upstream)

- API contract rõ: lỗi, idempotency, timeout/retry semantics.
- Migration an toàn (expand/contract khi cần); reconciliation khi đổi dữ liệu nóng.
- Defense in depth: authn/authz, least privilege DB, không leak cross-tenant.
- Observability: structured logs, stable error codes — đủ để DoD, không over-build platform.
- Idempotency cho cấp vé / check-in / outbox handlers.

## Không làm

- Microservices / sharding / cloud SaaS runtime “cho scale” ngoài MVP.
- Payment, seat map, Wallet, Android API surface.
- Mock auth trên production path; fixture phải đánh dấu rõ.
- Sửa UI web/iOS để “build xanh”.

## Evidence khi `worker_done` → `Chờ duyệt`

- Exact SHA; checks/tests đã chạy; migration note nếu có.
- Giới hạn / risk (RLS, race, replay) để reviewer độc lập xem.
- Không tự merge `main` trừ Task ủy quyền integration.

## Orca

- Agent: `--agent cursor`.
- Parallel với `web` / `ios` khi contract ổn định.
- Reviewer DoD/security: session khác; exact SHA.
