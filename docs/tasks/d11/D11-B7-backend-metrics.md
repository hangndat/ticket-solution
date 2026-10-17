# Spec đề xuất — D11-B7-backend-metrics

> **CHƯA APPROVED** coding. Parent [`D11-B7-metrics-release.md`](./D11-B7-metrics-release.md) = TEMPLATE.
> **Một Issue / một Dispatch / `backend` only.** Soft-dep BA §10 — **không** block P0 UI.

## Vai trò chuyên môn

- Role ID: `backend` · File: `docs/agents/roles/backend.md` · Agent: cursor
- Nhạy cảm PII labels → `reviewer-security`

## Mục tiêu

Instrumentation tối thiểu đã duyệt cho metric defs BA §10 (redeem completion, time-to-QR, scan confirm latency, …) — map event/code path observed; không bịa số production.

## Phụ thuộc

- Soft: BA §10 defs
- Soft: TD §16 cardinality
- Schema/event mới → escalate duyệt (**không** auto-approve)

## Ownership

`apps/api` / `apps/worker` / `packages/backend` — không sửa web/ios UI trong Dispatch này.

## AC

- [ ] Danh mục metric đề xuất ↔ event/code path (observed)
- [ ] Không PII thô trong labels
- [ ] Tests/smoke nếu có hook metrics
- [ ] Ghi “chưa đo production” nếu chưa có số
- [ ] `reviewer-dod` (± security) exact-SHA

## OUT

Fake dashboards; docs RELEASE alone (→ coordinator sub-spec); đóng O06.
