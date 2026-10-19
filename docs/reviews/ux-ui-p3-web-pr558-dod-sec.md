# DoD + Security review — Issue #554 · PR #558 (web Phase 3 Live Pulse)

| Field | Value |
| ----- | ----- |
| Reviewer / session | James · dod+sec — Orca `task_80130db1fbc1` / `ctx_dc92a6d263da` (≠ implementer) |
| Role IDs | `reviewer-dod`, `reviewer-security` (Wave C, same SHA) |
| Scope | Issue [#554](https://github.com/hangndat/ticket-solution/issues/554), PR [#558](https://github.com/hangndat/ticket-solution/pull/558), `apps/web` only |
| Commit SHA | `5f83766294a6b00c5b3c515df3aeb3c3f301dbe0` |
| Handoff | `docs/design/ux-ui-revamp/phase-3/` |
| Architecture impact | Không |
| **DoD verdict** | **PASS with known gap** |
| **Security verdict** | **PASS** |

## Executive summary

PR delivers Phase 3 PD freeze on membership `/invite` (Live Pulse chrome, guest-safe copy, token park UX), marketing hero token swap (`mkt-hero-note`), and redeem submit signal class — seven files, no BE/portal/mobile diff. DoD AC-I1–I4, AC-M1–M2, AC-R1, AC-V1 are met with lint, full web unit suite, and CI green on the exact SHA; AC-S* and iOS are out of PR scope. Security: invite accept path remains fail-closed (CSRF gating, idempotency key, no client-side privilege grant, no prod mock auth); diff is presentation/copy only on hot paths.

## Checks (exact SHA)

| Check | Command / source | Result |
| ----- | ---------------- | ------ |
| HEAD | `git rev-parse HEAD` @ worktree | `5f83766294a6b00c5b3c515df3aeb3c3f301dbe0` |
| CI | `gh pr checks 558`; `gh api …/commits/…/check-runs` | `web`, `ci`, `turbo-persist`, `changes` **success** on SHA `5f837662` (run `39202137525`) |
| Lint | `pnpm --filter @ticket/web lint` | **pass** (0 warnings) |
| Unit tests | `cd apps/web && pnpm test` | **249 pass**, 0 fail (incl. `invite-messages.test.ts` guest-safe / CSRF VI) |
| Diff scope | `git diff 5f837662^..5f837662 --stat` | 7 files, `apps/web` only |

Prior wave evidence (same SHA, not re-run on this host): `invite-http-uat.mjs` with `WEB_UAT_INVITE_SKIP_LOGIN=1` — `tokenLeakedInUrl: false`, CSRF evil/missing **403** + `CSRF_ORIGIN_MISMATCH` / `CSRF_ORIGIN_REQUIRED`; headless screenshots invite/marketing/redeem under `docs/reviews/o13-issue-381-uat/`. Full login+accept E2E exit **2** without live Nest membership stack (documented ops gap per handoff §1.4 / §4.2).

## DoD — AC mapping (Phase 3 §4.1, web slice)

| ID | Assessment |
| -- | ------------ |
| AC-I1 | **PASS** — H1, support, login `return=/invite`, `invite-form-panel`, signal submit |
| AC-I2 | **PASS** — `invite-token-empty`; submit disabled without token |
| AC-I3 | **PASS (unit + static)** — VI outcomes in `invite-messages.ts` + tests; runtime accept success not re-proven without upstream |
| AC-I4 | **PASS** — park `#token` / `?token` → `history.replaceState` pathname-only; metadata `referrer: no-referrer` |
| AC-S1–S3 | **N/A** — iOS `staff-access`; not in PR #558 |
| AC-M1 | **PASS** — `mkt-hero-note` replaces sticker badge class |
| AC-M2 | **PASS** — no content/route redesign in diff |
| AC-R1 | **PASS** — `redeem-submit` signal CTA class |
| AC-V1 | **PASS** — Live Pulse CSS vars + typography on invite/marketing paths |

O02 / PD §6.1: **N/A** — guest SiteNav unchanged; no staff chrome in scope.

### Known gap (DoD)

Live invite **accept** after Keycloak login against real BFF/Nest was not green on reviewer stack (`invite-http-uat` exit 2). Pre-existing environment dependency; CSRF probes, token park, and VI error mapping are otherwise evidenced. Does not block visual/copy AC for #554.

## Security review

### Threat / abuse cases considered (in-diff + invite hot path)

| Case | Finding |
| ---- | ------- |
| CSRF on `POST …/membership-invites/accept` | Unchanged server contract; UI disables submit until CSRF bootstrap (`platformGet` `/api/bff/me/tenants`); VI copy for CSRF_* codes; HTTP UAT confirms 403 on evil/missing Origin |
| Token exposure (Referrer, address bar, logs) | Park to `sessionStorage`, strip hash/query via `replaceState`; page metadata `no-referrer`; tests assert no internal codes in guest-facing strings |
| Client-side privilege escalation | Copy explicitly states UI does not grant Owner; success links to `/admin?tenantId=` with `encodeURIComponent` only after server `ok` view |
| Mock / bypass auth in production paths | **None** — no fixture auth added; accept still via `platformMutate` BFF |
| Idempotency / replay (accept) | `idempotencyKey: crypto.randomUUID()` retained on mutate |
| Staff-access / gate | **Out of diff** — no new surface |
| Secrets / deps | No `.env`, credentials, or `package.json` / lockfile changes |

### Security findings

| Severity | Item |
| -------- | ---- |
| — | No fix-before-merge issues in scope |

### Security limitations

- Did not run authenticated penetration against shared staging.
- BFF/Nest authz invariants assumed unchanged (no API diff); spot-check UI + CSRF UAT only.

## Combined verdict rationale

- **DoD: PASS with known gap** — In-scope Phase 3 web AC satisfied with automated checks on exact SHA; gap is runtime membership accept E2E without full stack, already documented in handoff.
- **Security: PASS** — Invite/membership UI changes do not weaken fail-closed behavior or introduce mock production auth; CSRF and token-handling patterns preserved.

## Limitations

- Review-only Task: no merge, no push.
- Revalidation required if commits land after `5f83766294a6b00c5b3c515df3aeb3c3f301dbe0`.
