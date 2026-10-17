# TEMPLATE — D11-B7 Metrics wiring + release UX gates

> **TEMPLATE NOT DISPATCH-READY.**  
> Parent index only — **cấm** một Dispatch trộn backend instrumentation + coordinator docs.  
> Sau user muốn đo / duyệt: split sub-spec. **Không** bịa baseline; **không** claim SLO khách hàng.

## Vai trò chuyên môn (khi split)

- `backend` (instrumentation) **hoặc** coordinator (docs ops) — một Dispatch một role  
- Agent: cursor · PII trong labels → `reviewer-security`

## Sub-specs (DISPATCH-READY candidates — vẫn CHƯA APPROVED coding)

| Sub-spec | Ownership |
| --- | --- |
| [`D11-B7-backend-metrics.md`](./D11-B7-backend-metrics.md) | `apps/api` / `apps/worker` / `packages/backend` |
| [`D11-B7-coordinator-release-docs.md`](./D11-B7-coordinator-release-docs.md) | `docs/ops/*` (coordinator) |

## Mục tiêu chung (hypothesis)

Định nghĩa cách đo PRD §13 (BA §10) — đề xuất instrumentation; cập nhật RELEASE-CHECKLIST mục UX nếu cần.

## Phụ thuộc chung

- Soft: BA metric defs trong `D11-BA-RESEARCH.md`  
- Soft: TD §16 cardinality (không user/ticket ID trong labels)

## OUT

Fake dashboards; 50k concurrent claim; đóng O06 hộ user; auto-approve schema mới.
