# Spec đề xuất — D11-B7-coordinator-release-docs

> **CHƯA APPROVED.** Parent [`D11-B7-metrics-release.md`](./D11-B7-metrics-release.md) = TEMPLATE.
> **Một Issue / một Dispatch / coordinator docs only** — không coding `apps/**`.

## Vai trò chuyên môn

- Coordinator (không gắn coding role catalog) · Agent: cursor
- Path: `.cursor/rules/orca-epic-orchestrator.mdc` + ops docs ownership

## Mục tiêu

Cập nhật `docs/ops/RELEASE-CHECKLIST.md` (và liên quan) mục UX/metrics gates: ghi rõ chưa đo production nếu chưa có số; không claim pilot/store.

## Phụ thuộc

- Soft: BA §10 / §11 gates
- Soft: output từ `D11-B7-backend-metrics` nếu đã có — **không** hard-block soạn checklist “chưa đo”

## Ownership

`docs/ops/*` (và docs liên quan được giao) — **không** `apps/**`.

## AC

- [ ] Checklist UX/release ghi trạng thái đo (chưa đo / cách lấy)
- [ ] Không bịa baseline số
- [ ] Không ủy quyền deploy/store ngầm
- [ ] Review exact-SHA docs nếu đưa vào Chờ duyệt

## OUT

Backend instrumentation; fake SLO; deploy prod.
