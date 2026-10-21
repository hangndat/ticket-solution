# Epic #686 — Prod demo seed (architecture handoff)

| Field | Value |
| --- | --- |
| Issue | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| Role | `architect` |
| Base SHA | `c76657c35bd876e425b247234e5fde57fa80e322` |
| ADR | [ADR-21-PROD-DEMO-SEED.md](../ops/ADR-21-PROD-DEMO-SEED.md) (**Đề xuất**) |
| Runbook | [PROD-SEED-RUNBOOK.md](../ops/PROD-SEED-RUNBOOK.md) |
| Dataset SoT | [PROD-SEED-DATASET.md](../demo/PROD-SEED-DATASET.md) (namespace `686f0001-*`, `VEM-*`, không `· Demo`) |
| Architecture impact | Có — seed prod fixture, MinIO, HMAC, staff trust boundary |

## Mục tiêu

Pilot production với 4 org / 6 event fixture (staff, membership, assignment, redeem, marketing ADR-19, media) tách biệt dữ liệu khách, idempotent, có backup/rollback.

## Non-goals

- Không merge/deploy prod trong task architect
- Không thay SMTP prod / Keycloak realm trong PR docs
- Không mở SaaS hoặc publish MinIO

## Ràng buộc đã áp dụng

- PostgreSQL SoT; seed qua `demo-seed.cjs` / `seedD9DemoDataset`
- Fail-closed collision (slug/UUID) — `packages/backend/src/demo-seed.ts`
- `CODE_HMAC_PEPPER` prod — `packages/backend/src/code-hmac.ts`
- MinIO private — ADR-14, `scripts/d9-seed-media.mjs`
- Outbox: seed không enqueue invite — `membership-invite.ts` chỉ cho API path

## Phương án staff (tóm tắt)

Chọn **OIDC login trước + grant membership DB**; từ chối realm import và bulk MembershipInvite lúc seed (chi tiết ADR-21).

## Dependencies

| Artifact | Owner | Trạng thái |
| --- | --- | --- |
| Dataset UUID 4/6 | BA (Epic) | [`PROD-SEED-DATASET.md`](../demo/PROD-SEED-DATASET.md) — PR #688 |
| ADR-21 + runbook | Architect | PR #689 — đồng bộ dataset #688 |
| Code seed mở rộng | Backend | Chờ merge docs |
| Media manifest 6 event | PD/Web | Chờ |
| dod+sec | Reviewer | Trước prod run |

## Xác minh

- Docs: coordinator review PR
- Runtime: runbook §10 sau implementation BE
- Security: không secret trong git; pepper chỉ trên VPS

## Kết luận

**Đủ để triển khai trong scope Epic** sau coordinator chốt ADR-21 và dataset #688 merge `main`. Ops/runbook và BE seed phải dùng cùng allowlist `686f0001-*` / `VEM-*`. **Cần owner** cho gates runbook §9 trước mọi lệnh trên VPS.
