# DoD review — PR #298 / Issue #294 (D12 web privacy O06 + Gate Origin + invite VI)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_2f03fb9e-23cf-46c5-a0d7-0e324740c409` · task `task_921f01aff065` · dispatch `ctx_2bd8f1a52785` (**≠** implementer) |
| Role | `reviewer-dod` — `docs/agents/roles/reviewer-dod.md` |
| Scope | Issue #294 · PR #298 · `apps/web/**` (privacy, gate BFF, invite) · `docs/asc/privacy*` · Architecture impact: **Không** |
| Commit SHA reviewed | `e016e8de311f9e12423dcbbe7b09fce24ff01626` (confirmed `git rev-parse` + `gh pr view 298 --json headRefOid`) |
| Checks | CI run [39103827726](https://github.com/hangndat/ticket-solution/actions/runs/39103827726) on tip SHA: **web** SUCCESS (lint/typecheck/test/build + `test:routes`) · **changes**/**ci**/**turbo-persist** SUCCESS · backend/mobile/db SKIPPED (path filter). Local worktree had no `node_modules` — unit tests not re-run here; CI web job is evidence on exact SHA. |
| Verdict | **PASS with known gap** |

## Checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Privacy copy khớp O06 (30d/365d/730d/90d, region, SLA) VI/EN | **PASS** — `apps/web/src/marketing/copy.ts` VI+EN: retention ≤30d / 365d / audit 730d / object ≤90d; single-region VPS; RPO/RTO not sold as support SLA. ASC `docs/asc/privacy-policy-draft.md` §6–10 + `privacy-nutrition.md` khớp. Support SLA P1/P2/P3 numbers also on `support.sla` (Support page) + ASC §10. |
| 2 | Gate mutations Origin/CSRF guard + tests | **PASS** — `assertSameOrigin` fail-closed on `gate/sessions` · `gate/reservations` · `gate/confirm` (admin-pattern). `tests/gate-csrf.test.ts` + `routes.integration.mjs` assert missing Origin → `403` / `CSRF_ORIGIN_REQUIRED` before OIDC. |
| 3 | Invite accept CSRF/reval hợp lý; copy VI | **PASS** — accept route already `assertMutatingBrowserAsync` (Origin + double-submit); UI waits CSRF cookie (`csrfReady`); VI copy for CSRF Origin/token + page title/h1 clarified; `invite-csrf` / `invite-messages` tests cover fail-closed messaging. |
| 4 | Không đụng BE/mobile; không secrets | **PASS** — diff paths only `apps/web/**` + `docs/asc/privacy*`; secret-pattern scan clean. |
| 5 | Verdict + artifact | This file + PR comment. |

## Findings

### Non-blocking / nits

1. `gate-csrf.test.ts` exercises `assertSameOrigin` helper (incl. path strings) rather than importing route modules; **mitigated** by source wiring + `routes.integration.mjs` HTTP assert on `/api/bff/gate/confirm`.
2. EN copy typo: “when a real tenant **onboard**” → *onboards* (`privacy.s4.body`).
3. Marketing `/privacy` intro mentions SLA; full P1/P2/P3 table lives on Support (`support.sla`) + ASC §10 — numbers đúng O06, placement split (not a wrong-number issue).

### No blockers

- No BE/mobile/backend edits; no secrets; Architecture impact Không — no ADR drift requiring architect gate.

## Known gaps (accepted — do not block merge of this Task)

1. **Headless invite UAT with live Keycloak** not re-run in implementer/reviewer sessions; AC said “nếu được”. CSRF unit + route Origin integration evidence sufficient for this Task; full Keycloak invite UAT remains optional residual.
2. **Production publish** of `/privacy` / ASC store submit still needs **separate deploy/store authorization** — out of Issue #294 OUT.
3. Reviewer worktree lacked `node_modules`; relied on CI web job on exact SHA rather than local `pnpm --filter @ticket/web test`.

## Merge note

**Coordinator may merge** PR #298 after board process (CI already green on reviewed SHA). Reviewer did **not** merge. Project → `Hoàn thành` only after merge + this DoD evidence.
