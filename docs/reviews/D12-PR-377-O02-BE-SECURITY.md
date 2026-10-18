# D12 — PR #377 security review (O02 MeEvents / #369)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_3d74123c-e0f9-4a2e-81a8-19f0c3f58d78` · dispatch `ctx_b82ebaaeb603` · task `task_0fb39c8180ea` · Role `reviewer-security` · Agent cursor |
| Implementer | `ctx_467e2c58fb67` (session ≠ this reviewer) |
| Scope | Issue **#369** · PR **#377** · Authz/RLS for `GET /v1/me/events` + `staffEligible`; revoke freshness; no privilege escalation via MeEvents |
| Paths | `apps/api/src/platform.ts`, `packages/backend/src/membership-invite.ts`, `packages/backend/prisma/migrations/202610180006_d12_o02_me_events/migration.sql`, `packages/backend/test/platform.test.cjs`, `packages/contracts/src/index.ts`, OpenAPI allowlist |
| Architecture impact | **Có** — discovery SQL + `migration_owner` policy; đối chiếu `docs/design/o02-permission-nav/contract.md` |
| **Exact tip SHA** | **`3856824bc687b7085bdf90671ac766c8f6020402`** (`git rev-parse HEAD` = PR `commits[0].oid` = branch `hangndat/d12-o02-be-369`) |
| Verdict Security | **PASS** |

## Threat / abuse cases examined

| Abuse case | Result |
| --- | --- |
| Unauthenticated / wrong audience on MeEvents | Route uses `selfActor` (standard OIDC, same as `/me/tenants`); missing verifier → identity misconfig fail-closed. Not platform MFA verifier (no widen). |
| Client-supplied userId / role / `staffEligible` | `userId` only from verified identity → `set_config('app.actor_id', …)`; `staffEligible` / `permissions` computed in SQL/DB rows — not request body. |
| Cross-tenant / other-user assignment leak | `list_my_events()` filters `m.user_id = actor` + active membership **and** active assignment; returns only caller’s events. |
| Attendee-only privilege via `staffEligible` | `my_staff_eligible()` deny-by-default: false without active membership/assignment; matrix test asserts attendee → `false`, `items: []`. |
| MeEvents used as mutation authz bypass | Read-only discovery; **no** change to `requireTenantPermission` / membership mutation paths. Chrome signal ≠ API grant (contract §1/§4). |
| `event_assignments_owner` USING(true) weakens runtime RLS | Policy `TO migration_owner` only — same FORCE-RLS + SECURITY DEFINER pattern as `memberships_owner` / `events_owner`. `ticket_runtime` still under `event_assignment_isolation` (tenant GUC). |
| SECURITY DEFINER abuse (search_path / PUBLIC execute) | `SET search_path = pg_catalog, public`; `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE … TO ticket_runtime` — mirrors `list_my_tenants()`. |
| Stale chrome after revoke | Assignment revoke → item gone; membership revoke → `staffEligible: false` + empty items (platform O02 test). Membership revoke also revokes open assignments. |
| Escalate via empty-items Owner (`staffEligible: true`) | By contract (membership OR assignment); Gate still needs `gate.confirm` in items; mutations still server-enforced. |

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| — | — | **No fix-before-merge findings** in scoped authz/RLS surface |

## Hardening (không chặn PASS)

- Explicit `ALTER FUNCTION list_my_events() / my_staff_eligible() OWNER TO migration_owner` không có trong migration (cùng kiểu với `list_my_tenants()` — phụ thuộc role chạy migrate). Không phải regression O02.
- HTTP 401 unauthenticated cho `/v1/me/events` không nằm trong matrix O02 của `platform.test.cjs` (đường `selfActor` dùng chung với `/me/tenants`). Gap test, không phải lỗ hổng authz mới.

## Checks on exact tip

```text
git rev-parse HEAD
→ 3856824bc687b7085bdf90671ac766c8f6020402
gh pr view 377 --json commits → oid khớp tip

Static / graph: CRG list_graph_stats + rebuild; source review of route, listMyEvents,
migration SQL, requireTenantPermission (unchanged), O02 platform test matrix.
Implementer evidence (PR body): platform.test.cjs + health.test.cjs pass on tip.
```

CRG note: graph tools used for orientation; **source + migration SQL + contract** are authoritative for this security verdict. No exploit PoC executed.

## Limitations (review process)

- Review only — không merge, không đổi Project Status, không deploy, không viết exploit PoC.
- Không chạy lại full DB isolation suite trong session này; dựa trên đọc code/SQL/test matrix + SHA tip đã verify.
- DoD / CI gate vẫn thuộc `reviewer-dod` / coordinator.

## Verdict

**PASS** — `GET /v1/me/events` giữ deny-by-default `staffEligible`, RLS owner policy không nới `ticket_runtime`, revoke fail-closed trong scope, và không mở đường privilege escalation qua MeEvents.
