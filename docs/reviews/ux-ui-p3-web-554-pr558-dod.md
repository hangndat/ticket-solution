# DoD review — Issue #554 · PR #558 (web Phase 3 Live Pulse)

| Field | Value |
| ----- | ----- |
| Reviewer / session | James · dod — Orca worker `task_b61a16ca3052` / `ctx_ad1b1a4ccc14` (≠ implementer) |
| Scope | Issue [#554](https://github.com/hangndat/ticket-solution/issues/554), PR [#558](https://github.com/hangndat/ticket-solution/pull/558), `apps/web` only |
| Commit SHA | `5f83766294a6b00c5b3c515df3aeb3c3f301dbe0` |
| Architecture impact | Không |
| Verdict | **PASS with known gap** |

## Summary

PR maps Phase 3 PD freeze (Live Pulse) onto `/invite`, marketing hero chrome, and residual `/redeem` submit styling. Guest-safe invite copy/metadata, `invite-form-panel` layout, signal CTAs, and expanded `invite-messages` + unit tests align with handoff `docs/design/ux-ui-revamp/phase-3/` AC-I*, AC-M*, AC-R1, AC-V1. No portal/mobile/BE contract changes in diff.

## Checks (exact SHA worktree @ `5f83766294a6`)

| Check | Command | Result |
| ----- | ------- | ------ |
| CI (remote) | `gh pr checks 558` | `web`, `ci`, `turbo-persist`, `changes` **pass** on run `39202137525` |
| Lint | `pnpm --filter @ticket/web lint` | **pass** (0 warnings) |
| Unit tests | `cd apps/web && pnpm test` | **249 pass**, 0 fail (incl. `invite-messages.test.ts` guest-safe / CSRF copy) |
| Build | `pnpm --filter @ticket/web build` | **pass** |
| Invite HTTP UAT | `WEB_UAT_INVITE_SKIP_LOGIN=1 node apps/web/tests/invite-http-uat.mjs http://127.0.0.1:3271` | **partial** — `tokenLeakedInUrl: false`, CSRF evil/missing `403` + codes `CSRF_ORIGIN_MISMATCH` / `CSRF_ORIGIN_REQUIRED`; exit `2` — `acceptOk: false` (no live Nest membership accept on reviewer host) |
| Headless screenshots | `WEB_BASE_URL=http://127.0.0.1:3271 ./scripts/web-uat.sh screenshot …/invite`, `…/redeem`, `o13-sales` | **pass** — HTTP 200; marketing sales/privacy/support PNGs under `docs/reviews/o13-issue-381-uat/` |
| SSR smoke `/invite` | `curl -s http://127.0.0.1:3271/invite` | H1 + empty state + `invite-form-panel` + `return=/invite` login CTA; no Keycloak/Nest/BFF in HTML |

Reviewer started production server locally (`pnpm --filter @ticket/web start --port 3271`) only for UAT; not part of PR diff.

## AC mapping (Phase 3 handoff §4.1)

| ID | Assessment |
| -- | ------------ |
| AC-I1 | **PASS** — H1, support, login `return=/invite`, form panel + signal submit (`invite-submit`) |
| AC-I2 | **PASS** — empty `invite-token-empty` when no token; submit disabled |
| AC-I3 | **PASS (unit + static)** — VI outcomes in `invite-messages.ts` + tests; runtime accept success **not** re-proven without upstream (see gap) |
| AC-I4 | **PASS** — invite-http-uat: URL stripped after `#token` park (`afterParkUrl` path-only) |
| AC-M1 | **PASS** — `mkt-hero-note` replaces sticker `mkt-badge`; o13-sales first viewport captured |
| AC-M2 | **PASS** — privacy/support routes 200 with same token host |
| AC-R1 | **PASS** — `redeem-submit` signal CTA; redeem status chrome uses ink/signal/focus mixes (no Syne/terracotta v1 in changed paths) |
| AC-V1 | **PASS** — Live Pulse CSS vars + Sora/Be Vietnam Pro on `/invite` SSR |

O02 / PD §6.1 chrome gates: **N/A** — Task scope excludes staff/iOS; guest SiteNav unchanged (no Owner invite in guest chrome).

## Findings

| Severity | Item |
| -------- | ---- |
| **Known gap** | Full invite **accept** Playwright path (login + live BFF/Nest success or mocked invalid UI) not green on reviewer machine (`invite-http-uat` exit 2). Pre-existing ops/stack dependency per Phase 3 handoff §1.4 / §4.2 — not introduced by this visual PR. |
| nit | `invite-field-hint` still mentions `#` on URL (acceptable per handoff flow; not IdP jargon). |

## Security / fail-closed (spot-check)

- CSRF origin probes on accept endpoint: **403** with expected codes (invite-http-uat JSON).
- Guest copy avoids leaking internal codes in titles (covered by unit tests).
- No authz bypass in diff; UI explicitly states no auto Owner grant.

## Limitations

- Did not merge (per Task).
- Did not run `scripts/web-uat.sh redeem` login flow (D9) — out of minimal smoke for this Task; redeem change is one CSS class on submit.

## Verdict rationale

**PASS with known gap:** All in-scope visual/copy AC for #554 are met with lint, full web unit suite, CI on SHA, and headless smoke for invite/marketing/redeem surfaces. The only open item is runtime membership-invite accept E2E without live backend — documented ops gap, with CSRF + token-park + VI mapping otherwise evidenced.
