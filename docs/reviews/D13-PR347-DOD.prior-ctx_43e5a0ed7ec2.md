# DoD — PR #347 (D13 web privacy/support disclosure + companion UAT)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_a1b9c701-7c6e-44fb-9064-331ccc8251aa` · task `task_4566700bb705` · dispatch `ctx_43e5a0ed7ec2` (≠ implementer dispatch `ctx_0c5f960a5262`) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Tasks [#321](https://github.com/hangndat/ticket-solution/issues/321) / [#330](https://github.com/hangndat/ticket-solution/issues/330) · PR [#347](https://github.com/hangndat/ticket-solution/pull/347) · paths: `apps/web/src/marketing/copy.ts`, `legal-pages.tsx`, `app/account/page.tsx`, `account-panel.tsx`, `tests/marketing-copy.test.ts`, `docs/reviews/D13-WEB-STORE-UAT.md` |
| Architecture impact | **Không** — web disclosure/support/account copy theo O06 hiện hữu; không đổi OpenAPI/contracts/authz/RLS |
| Commit SHA reviewed | `6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703` (`git rev-parse` + PR head) |
| Implementation code SHA | `8dc9abbfb6434ef7960e4ad5a6ee2e108073239e` — `git diff` empty under `apps/web` tip↔impl (docs-only tip commits after) |
| Graph | `code-review-graph-ticket` `detect_changes_tool` (base `main`, scoped files) + lean-ctx/source for copy strings; graph `head_matches_build` briefly stale → source/tests/CI/UAT thắng |
| React skill | Loaded `vercel-react-best-practices` — no waterfall/bundle regressions introduced by static privacy sections; AccountPanel sequential CSRF+GET is pre-existing client pattern, out of disclosure AC |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC

| AC | Result |
| --- | --- |
| Camera scan on-device / no photo upload (VI+EN) | **PASS** — `privacy.s3`; unit test asserts; HTML on `:3013` contains phrases |
| Session / ticket / push collection | **PASS** — `privacy.s1` (OIDC subject, ticket/QR, APNs push token) |
| Account deletion entry + ≤30d + audit exception | **PASS** — `privacy.s5` + `/account` copy; audit TTL 730d in `privacy.s4` / account notice |
| No production enforce / job/scheduler promises (SEC-1/SEC-2 open) | **PASS** — no `job`/`scheduler`/`NO_JOB`/`enforce` in rendered privacy/account; object retention wording policy-only; UAT map marks enforce not claimed |
| Support contact VI/EN | **PASS** — `support@vemoki.com` + SLA; privacy.s7 + support.lead |
| Copy VI/EN parity for disclosures | **PASS** — both locales updated; marketing-copy test covers both |
| Headless UAT evidence + 207 unit tests on tip | **PASS (revalidated)** — see Checks; UAT doc tip-field stale noted under gaps |
| CI web green on tip | **PASS** — Actions run success (web + ci) |
| No authenticated E2E pretended | **PASS** — not claimed; account shell only |
| No implementation jargon in user flow | **GAP** — see findings (should-fix; not ASC disclosure blocker) |

---

## Checks (exact SHA `6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703`)

```bash
git rev-parse HEAD
# → 6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703

pnpm --filter @ticket/contracts build
cd apps/web && pnpm exec tsx --test tests/*.test.ts
# → 207 pass / 0 fail

pnpm --filter @ticket/web exec next start --port 3013
# HTTP 200: /privacy /en/privacy /support /en/support /account /redeem /en /auth /t/demo/events/demo
# Spot HTML: camera on-device / không tải ảnh; ≤30 ngày; /account; support@vemoki.com;
#            no chưa chốt / AWAITING_POLICY / job / scheduler / enforce
```

| Check | Result |
| --- | --- |
| Unit tests | **207 pass** (reviewer re-run) |
| Local `next start :3013` HTTP matrix | **all 200** (reviewer re-run) |
| Playwright screenshots | Present under `apps/web/.uat-artifacts/d13-companion/` (gitignored; mtime 2026-10-18) — code tree unchanged since impl SHA |
| CI | [run 39109050026](https://github.com/hangndat/ticket-solution/actions/runs/39109050026) on tip → **success** (`web`, `ci`, `changes`, `turbo-persist`; backend/mobile/db skipped) |
| Prod ASC URLs | Prior UAT recorded 200; enriched copy **not** on prod until deploy (out of scope) |

---

## Findings

### Should-fix (known gaps — do not fail disclosure DoD)

1. **Residual internal jargon in user-visible copy** — Account + privacy still expose `O06`, `ACK`, `OIDC`, `DECISION-LOG`, `RPO/RTO`, `TTL`, and success UI echoes raw `state` / `policyStatus`. Timeline/deletion path is clear; polish toward plain language recommended before store submit narrative, not a missing-disclosure blocker.
2. **UAT evidence tip field stale** — `docs/reviews/D13-WEB-STORE-UAT.md` still lists Review tip SHA `15501a01dbcb988e113b32fefde85356a2d9d6ab` while PR tip is `6c458cdc…`. Apps/web tree identical since `8dc9abb…`; reviewer revalidated tests+HTTP on tip. Owner may amend the tip line in a docs follow-up.
3. **AccountPanel raw JSON dump** — pre-existing UX (`JSON.stringify(current)`); not introduced as primary scope but still developer-facing in user flow.

### Nits

- Personal interim email `hangndat@gmail.com` on privacy.s7 — intentional interim contact; fine for MVP.
- CRG graph briefly lagged tip during review; conclusions from source/tests/CI.

### Out of scope / intentional non-claims

- No merge, no prod deploy, no authenticated deletion POST / redeem E2E.
- BE anonymize prod enforce / SEC-1/SEC-2 Keycloak·staff_sessions — **not claimed** (correct per coordinator `policy-only-no-enforce-claim`).
- iOS in-app deletion copy (S5-T1) — separate ownership; BA already tracked.

### Blockers

- **None** for this web disclosure/UAT DoD slice.

---

## Verdict

**PASS with known gap** on exact SHA `6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703`.

Coordinator may merge when board/WIP allows; reviewer did **not** merge, deploy, or set Project `Hoàn thành`. Revalidation required if behavior-changing commits land after this SHA.
