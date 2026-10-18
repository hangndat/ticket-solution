# DoD review — PR #375 · O02 permission-nav architect handoff

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | `reviewer-dod` · Orca dispatch `ctx_42f18304fe04` · terminal `term_4fae3745-eebb-428c-b1c4-88d71cf7d842` · **≠** implementer `ctx_3c9efb9fedfb` |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` |
| Scope | PR [#375](https://github.com/hangndat/ticket-solution/pull/375) · Issue [#368](https://github.com/hangndat/ticket-solution/issues/368) · Epic [#293](https://github.com/hangndat/ticket-solution/issues/293) · paths `docs/design/o02-permission-nav/*` |
| Commit SHA | **`1dc6b9bb4f5a10b224f3212e01cb128b8ef902f4`** (verified = PR tip `headRefOid`) |
| Architecture impact | Có — shared discovery contract; review đối chiếu O02 / ADR-07 + handoff đủ unblock BE #369 |
| Checks | Docs-only — không chạy Nest/UI; `gh pr checks 375` trên tip: `ci` pass, `changes` pass; backend/web/mobile/database-isolation skipped (đúng cho docs) |
| Verdict | **PASS** |

## Checklist

| Mục | Kết quả |
| --- | --- |
| Handoff đủ cho BE #369 | **Pass** — `be-handoff.md` chốt types additive (`staffEligible`, `MeEventItem.tenantId`), OpenAPI path, Nest sketch (`list_my_events` ∥ `list_my_tenants`), acceptance checklist, OUT web/mobile |
| Khớp O02 / ADR-07 | **Pass** — O02: staff cùng app, nav theo permission server; ADR-07: app chung hai chế độ. Chọn MeEvents, **không** mở rộng `/v1/me` — giữ identity probe lean |
| Không implement Nest trong PR | **Pass** — diff chỉ 3 file docs; zero `apps/api` / `packages/backend` / contracts runtime |
| Consumer web/iOS shape rõ | **Pass** — `contract.md` §3 chrome mapping (tab Nhân viên / Admin / Gate / soft-redirect) + failure/revoke; consumers #370/#371 có field SoT rõ |

## Evidence đối chiếu (tip contracts @ source SHA handoff `a507b36…` / workspace)

- `MeResponse` identity-only — khớp quyết định không mở rộng `/v1/me`.
- `MeEventsResponse` hiện chỉ `{ items }` — handoff additive `staffEligible` đúng gap.
- `MeEventItem` thiếu `tenantId` — handoff bắt buộc thêm — đúng.
- `GET /v1/me/events` **chưa** có trong OpenAPI/paths — BE #369 unblock được.
- `role-map.ts` allowlist chứa `gate.confirm` / `gate.undo` và tenant perms (`event.create`, `event.list`, `members.manage`, `tenant.profile`) — mapping chrome neo đúng SoT server.

## Findings

### Blocker

Không có.

### Should-fix

Không có.

### Nit (non-blocking)

1. Example JSON trong `contract.md` dùng `gate.undo` (Supervisor); Scanner matrix chỉ cần `gate.confirm` — rõ trong §8, không gây nhầm acceptance.
2. Manager `tenantPermissionsForRole` chỉ `['event.create']` → Admin chrome vẫn hiện theo giao tập §3 — khớp role-map hiện tại; BE/consumers không cần đổi trong #368.

## Limitations

- Đây là **docs/design DoD** — không chứng minh Nest route live hay UAT chrome; evidence implementation thuộc BE #369 + consumers #370/#371.
- Reviewer không merge PR.

## Merge note

**Coordinator may merge** PR #375 sau board process. Verdict **PASS** trên exact SHA `1dc6b9bb4f5a10b224f3212e01cb128b8ef902f4`. Commit hành vi mới sau tip → bắt buộc revalidation.
