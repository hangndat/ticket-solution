# DoD review — D4 Tenant 2 prod UAT (vemoki.com)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_30152865-00f0-404a-b30b-b4d85e0f80b3`, task `task_a3b6f74a3878`, dispatch `ctx_1ecd39be82ae`) — ≠ implementer (Issue #5 comment `6231055351`) |
| Scope | Issue #5 — D4 Tenant 2 self-serve on prod (`api.vemoki.com` / `vemoki.com`); UAT evidence only (no code/PR tip) |
| Environment SHA | Local `main` at review time: `43c86871df944ea7fa6aac7e096933b2ca030baf` (`git rev-parse main`) — UAT against live prod, not a feature-branch tip |
| Checks | Read artifacts listed below; optional curl: `https://vemoki.com/` → HTTP 200; `https://api.vemoki.com/health` (and common `/ready`/`/healthz` paths) → 404 (no public health route found; not used as gate) |
| Verdict | **PASS with known gap** |

## Artifacts reviewed

| File | Role |
| --- | --- |
| `apps/web/.uat-artifacts/prod-d4-tenant2-evidence.md` | Summary + known gaps |
| `apps/web/.uat-artifacts/prod-create-tenant-ok.txt` | Platform create tenant HTTP 201 |
| `apps/web/.uat-artifacts/prod-accept-sql.txt` | Owner accept → membership ACTIVE |
| `apps/web/.uat-artifacts/prod-activate-ok.txt` | Tenant activate → ACTIVE |
| `apps/web/.uat-artifacts/prod-create-event.txt` | Admin create event HTTP 201 |
| `apps/web/.uat-artifacts/prod-d4-admin-ops.json` | Save config + publish + export gap + event PUBLISHED |
| `apps/web/.uat-artifacts/prod-d4-redeem.json` | Redeem + CS list |
| `apps/web/.uat-artifacts/prod-tenant-detail.txt` | Tenant slug/name (pre-activate snapshot) |
| `apps/web/.uat-artifacts/prod-import.txt` | Import 2 codes HTTP 201 |

## Key IDs (cross-checked)

| Entity | ID |
| --- | --- |
| tenantId | `26c16ee9-1472-440e-98f2-de50d23aa938` (slug `aurora-ops-0515`, name Aurora Night Org) |
| ownerInviteId | `a32f9f4c-fa4f-4d37-83af-2d88125cc167` |
| membershipId | `b8e80814-8046-4ff0-bd41-7a2d4526bfbb` (Owner, ACTIVE) |
| eventId | `5295ef1a-56bc-4c9e-971d-708ce9596ffa` (slug `aurora-night-150643`) |
| ticketTypeId (import/redeem) | `600955be-015f-4bab-977a-c0c1d2c09608` |
| ticketId | `7d8c18df-de69-436f-b965-b21665d0e56e` (state ACTIVE; CS masked `s***@example.com`) |

Not FUN FEST hardcode: new slug `aurora-ops-0515` / event `aurora-night-150643` via platform + admin path.

## Checklist DoD (D4 gate)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Second tenant created via platform (not FUN FEST hardcode) | **PASS** | `prod-create-tenant-ok.txt` HTTP 201 + `prod-tenant-detail.txt` slug `aurora-ops-0515` |
| 2 | Owner accepted / membership ACTIVE | **PASS** | `prod-accept-sql.txt` membership `b8e80814-…` status ACTIVE, role Owner |
| 3 | Tenant ACTIVE | **PASS** | `prod-activate-ok.txt` HTTP 201 `status=ACTIVE` version 2 |
| 4 | Admin event create + config publish | **PASS** | `prod-create-event.txt` HTTP 201; `prod-d4-admin-ops.json` steps `save-config`/`publish` status 201, `publishedConfigVersion=1`, event-detail `contentStatus=PUBLISHED` |
| 5 | Import codes + redeem ticket + CS list | **PASS** | `prod-import.txt` imported=2; `prod-d4-redeem.json` redeem HTTP 201 ticket `7d8c18df-…`; CS list 1 item masked |
| 6 | Known gaps honestly documented | **PASS** | Documented in evidence.md + Issue comment; listed below |

## Findings / limitations (known gaps — acceptable for D4 close)

1. **CSRF / invite UI:** BFF mutate `CSRF_ORIGIN_MISMATCH` on `/invite`; accept via HTTP `selfActor` blocked with platform MFA verifier on staff `ticket-web` token — UAT used DB `accept_membership_invite` (same function as API).
2. **Mailpit / invite email:** outbox `MembershipInvite` PENDING (no DELIVERED).
3. **MinIO export:** `prod-d4-admin-ops.json` export step HTTP 503 `MINIO_MISCONFIGURED`.
4. **D5 camera/push:** device redeem / push DELIVERED deferred to D5 (USB noted in evidence).

### Intermediate noise (not contradictory)

- `prod-d4-admin-ops.json` first redeem attempt HTTP 409 `FORM_VERSION_STALE` + empty CS list; later `prod-d4-redeem.json` proves redeem+CS after published form reload.
- `prod-publish.txt` shows an earlier `CONFIG_VERSION_MISMATCH` 409; final publish in `prod-d4-admin-ops.json` is 201 PUBLISHED.
- `prod-tenant-detail.txt` is pre-activate (`PENDING`); activate artifact is authoritative for ACTIVE.
- `prod-ticket-type.txt` has a different `ticketTypeId` (`817b490e-…`) than import/redeem (`600955be-…`); core path IDs in import+redeem are consistent — treated as earlier/alternate type create, not a gate failure.

## Verdict

**PASS with known gap** — core Tenant-2 self-serve path on prod is proven (platform create → Owner ACTIVE → tenant ACTIVE → event publish → import → redeem → CS). Gaps above are documented and acceptable for D4 close per gate; do not inherit this verdict for CSRF/invite HTTP, mail delivery, MinIO export, or D5 device work without revalidation.

Coordinator may set Project **Hoàn thành** after merge/CI/evidence policy for #5; this reviewer does not change Project status.
