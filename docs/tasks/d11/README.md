# D11 — Task specs (Epic planner)

**Epic:** [#222](https://github.com/hangndat/ticket-solution/issues/222)  
**Story discovery:** [#223](https://github.com/hangndat/ticket-solution/issues/223)  
**Plan:** [`docs/plans/D11-UX-PRODUCTION-PLAN.md`](../../plans/D11-UX-PRODUCTION-PLAN.md)

## Quy ước

- Tiếng Việt user-facing; giữ ID/path/SHA/command.
- Role ID bắt buộc trong mọi Spec ownership/reviewer — xem [`docs/agents/README.md`](../../agents/README.md).
- Agent: `--agent cursor` ([orca-agent-routing](../../../.cursor/rules/orca-agent-routing.mdc)).
- `D11-A*` = pha discovery (đã ủy quyền O11).  
- `D11-B*` = **đề xuất** implementation — **không** dispatch coding cho đến user review roadmap.
- Parent multi-slice (`B2`/`B4`/`B6`/`B7`) = **TEMPLATE NOT DISPATCH-READY** — chỉ `worker-start` **sub-spec** một ownership.
- Contract/OpenAPI **không** auto-approve từ Task UX.
- Chỉ coordinator gốc `worker-start` / đổi Project Status.

## Index

| Spec | Issue | Role | Trạng thái proposal |
| --- | --- | --- | --- |
| [D11-A1-ba-research.md](./D11-A1-ba-research.md) | #224 | `product-ba` | Đang làm (discovery) |
| [D11-A2-pd-design.md](./D11-A2-pd-design.md) | #225 | `product-design` | Đang làm (discovery) |
| [D11-A3-planner.md](./D11-A3-planner.md) | #226 | Epic planner | Đang làm (discovery) |
| [D11-A4-reviewer-discovery.md](./D11-A4-reviewer-discovery.md) | *(sau Chờ duyệt)* | `reviewer-dod` | Spec sẵn |
| [D11-B1-privacy-ux.md](./D11-B1-privacy-ux.md) | TBD · BA S-P0-D | `web` (1 slice) | **Đề xuất** — policy duyệt trước publish |
| [D11-B2-attendee-web.md](./D11-B2-attendee-web.md) | — | `web` | **TEMPLATE NOT DISPATCH-READY** |
| → [D11-B2-web-home.md](./D11-B2-web-home.md) | TBD · S-P0-F | `web` | **Đề xuất** sub-spec |
| → [D11-B2-web-invite.md](./D11-B2-web-invite.md) | TBD · S-P0-A | `web` | **Đề xuất** sub-spec |
| → [D11-B2-web-redeem.md](./D11-B2-web-redeem.md) | TBD · S-P1-A | `web` | **Đề xuất** sub-spec |
| [D11-B3-attendee-ios.md](./D11-B3-attendee-ios.md) | TBD · attendee iOS | `ios` | **Đề xuất** (+ brand AC) |
| [D11-B4-gate-staff-ux.md](./D11-B4-gate-staff-ux.md) | — | multi | **TEMPLATE NOT DISPATCH-READY** |
| → [D11-B4-ios-staff-scan.md](./D11-B4-ios-staff-scan.md) | TBD · S-P0-B | `ios` | **Đề xuất** sub-spec |
| → [D11-B4-web-gate.md](./D11-B4-web-gate.md) | TBD · S-P0-B web | `web` | **Đề xuất** sub-spec |
| → [D11-B4-backend-validate-only.md](./D11-B4-backend-validate-only.md) | TBD · S-P1-C optional | `backend` | **Đề xuất** — capability chưa approved |
| [D11-B5-admin-ops-ux.md](./D11-B5-admin-ops-ux.md) | TBD · S-P0-E / S-P1-B | `web` | **Đề xuất** — không skin-only (+ brand AC) |
| [D11-B6-a11y.md](./D11-B6-a11y.md) | — | multi | **TEMPLATE NOT DISPATCH-READY** |
| → [D11-B6-web-a11y.md](./D11-B6-web-a11y.md) | TBD | `web` | **Đề xuất** sub-spec |
| → [D11-B6-ios-a11y.md](./D11-B6-ios-a11y.md) | TBD | `ios` | **Đề xuất** sub-spec |
| [D11-B7-metrics-release.md](./D11-B7-metrics-release.md) | — | multi | **TEMPLATE NOT DISPATCH-READY** |
| → [D11-B7-backend-metrics.md](./D11-B7-backend-metrics.md) | TBD · BA §10 | `backend` | **Đề xuất** sub-spec |
| → [D11-B7-coordinator-release-docs.md](./D11-B7-coordinator-release-docs.md) | TBD | coordinator | **Đề xuất** sub-spec |
| [D11-B8-milestone-gate.md](./D11-B8-milestone-gate.md) | TBD | coordinator | **Đề xuất** |
| [D11-S-P0-C-brand-test-ac.md](./D11-S-P0-C-brand-test-ac.md) | — | AC dùng chung | Gắn vào B2/B3/B5 surface — **không** Dispatch riêng |

**WIP:** cùng lúc ≤1 feature Dispatch / ownership (`web`|`ios`|`backend`).
