# DoD — PR #347 (D13 web privacy/support disclosure + companion UAT)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_a96b3a61-e424-4c62-b570-46df62480f99` · task `task_887785358d2a` · dispatch `ctx_ddad4861e897` (≠ implementer; ≠ prior review `ctx_43e5a0ed7ec2`) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Tasks [#321](https://github.com/hangndat/ticket-solution/issues/321) / [#330](https://github.com/hangndat/ticket-solution/issues/330) · PR [#347](https://github.com/hangndat/ticket-solution/pull/347) · paths: `apps/web/src/marketing/copy.ts`, `legal-pages.tsx`, `app/account/page.tsx`, `account-panel.tsx`, `tests/marketing-copy.test.ts`, `docs/reviews/D13-WEB-STORE-UAT.md` |
| Architecture impact | **Không** — copy-only follow-up; không đổi OpenAPI/contracts/authz/RLS |
| Commit SHA reviewed (PR tip) | `b2f7b82be597611459ab587e4d953661c492dcc6` (`git rev-parse` + PR `headRefOid`) |
| Implementation / jargon-plain SHA | `5ac2b436626d0abaab06ad2d17cadcf3aa9a9e57` — last `apps/web` change; tip↔this SHA = docs-only under `docs/reviews/*` |
| Prior verdict superseded | **INVALIDATED** — PASS-with-gap on `6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703` (dispatch `ctx_43e5a0ed7ec2`) does **not** apply to this tip |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` + `detect_changes_tool` (base `main`, scoped files); graph build SHA lagged Orca worktree → **source + unit tests + rebuilt `next start` HTML thắng** |
| React skill | Loaded `vercel-react-best-practices` — static privacy/support sections; no new waterfall/bundle risk from copy edit; AccountPanel sequential CSRF+GET pre-existing |
| Verdict | **PASS** |

---

## Supersession note

Previous independent DoD (**PASS with known gap**) cited residual user-visible jargon (`O06`, `ACK`, `OIDC`, `DECISION-LOG`, `RPO/RTO`, `TTL`, `anonymize`) on SHA `6c458cdc…`. Follow-up `5ac2b436…` removes that jargon from VI/EN privacy, support, and `/account` flows while keeping ≤30-day processing + retained audit and no immediate-erasure claims. This artifact is the authoritative DoD for tip `b2f7b82…`.

---

## Checklist vs AC

| AC | Result |
| --- | --- |
| Camera scan on-device / no photo upload (VI+EN) | **PASS** — `privacy.s3`; unit test; HTML `:3013` |
| Session / ticket / push collection | **PASS** — `privacy.s1` (login provider Keycloak / user ID, ticket/QR, Apple Push) — plain language, no `OIDC` token |
| Account deletion entry + ≤30d + audit exception | **PASS** — `privacy.s4`/`s5` + `/account`; 730d audit retained; “chưa phải xóa ngay” / “not immediate erasure” |
| No production enforce / job/scheduler promises | **PASS** — no job/scheduler/enforce claims in privacy/account surfaces |
| Support contact VI/EN | **PASS** — `support@vemoki.com` + SLA; privacy.s7 + support.lead |
| Copy VI/EN parity for disclosures | **PASS** — both locales; marketing-copy test |
| No internal O06/ACK/OIDC/anonymize/TTL/RPO/DECISION-LOG jargon in user flow | **PASS** — scoped source scan 0 matches; tip HTML spot-check 0 matches (`ẩn danh` / `de-identify` = plain language) |
| Headless UAT evidence + 207 unit tests | **PASS** — 207 re-run on tip; prior Playwright artifacts under `apps/web/.uat-artifacts/d13-companion/` (layout unchanged by copy-only follow-up); reviewer rebuilt `next start :3013` for HTML claims |
| CI web green on tip | **PASS** — [run 39109567367](https://github.com/hangndat/ticket-solution/actions/runs/39109567367) on `b2f7b82…` → success |
| No authenticated E2E pretended | **PASS** — not claimed |

---

## Checks (exact tip SHA `b2f7b82be597611459ab587e4d953661c492dcc6`)

```bash
git rev-parse HEAD
# → b2f7b82be597611459ab587e4d953661c492dcc6

pnpm --filter @ticket/contracts build
cd apps/web && pnpm exec tsx --test tests/*.test.ts
# → 207 pass / 0 fail

pnpm --filter @ticket/web build
pnpm --filter @ticket/web exec next start --hostname 127.0.0.1 --port 3013
# HTTP 200: /privacy /en/privacy /support /en/support /account (+ /marketing/* mirrors)
# Spot HTML: ≤30d / 730 audit / support@vemoki.com / on-device|không tải ảnh /
#            chưa phải xóa|not immediate|de-identify|ẩn danh;
#            absent: O06 OIDC ACK anonymize TTL RPO RTO DECISION-LOG AWAITING_POLICY xóa cứng
```

| Check | Result |
| --- | --- |
| Unit tests | **207 pass** (reviewer re-run on tip) |
| Tip `next start :3013` HTML matrix | **all 200** + disclosure/jargon spot-check (reviewer) |
| Playwright screenshots | Present `apps/web/.uat-artifacts/d13-companion/` (mtime 2026-10-18; copy-only follow-up — layout evidence reused) |
| CI | [run 39109567367](https://github.com/hangndat/ticket-solution/actions/runs/39109567367) tip `b2f7b82…` → **success** (`web`, `ci`, `changes`; backend/mobile/db skipped) |

---

## Findings

### Residual nits (do not block PASS)

1. **AccountPanel raw JSON dump** — pre-existing `JSON.stringify(current)` when a request exists; not introduced by D13 disclosure AC and not internal policy jargon.
2. **UAT doc tip line lag** — `docs/reviews/D13-WEB-STORE-UAT.md` Review tip field lists `ae8ba365…` while PR tip is `b2f7b82…` (docs-only commits after); jargon-plain SHA `5ac2b436…` correctly recorded; `apps/web` unchanged after that SHA.
3. **CRG worktree lag** — graph `built_at_sha` pointed at another workspace path during review; conclusions from source/tests/CI/HTML.

### Out of scope / intentional non-claims

- No merge, no prod deploy, no authenticated deletion POST / redeem E2E.
- BE anonymize prod enforce / SEC-1/SEC-2 — **not claimed**.
- iOS in-app deletion copy (S5-T1) — separate ownership.

### Blockers

- **None**.

---

## Verdict

**PASS** on exact PR tip SHA `b2f7b82be597611459ab587e4d953661c492dcc6` (apps/web behavior from `5ac2b436626d0abaab06ad2d17cadcf3aa9a9e57`).

This **supersedes** the prior **PASS with known gap** on `6c458cdc09b4e3fceceade1b9b5a8aeadf5ee703`.

Coordinator owns Project Status / merge; reviewer did **not** merge, deploy, or set `Hoàn thành`. Revalidation required if behavior-changing commits land after this tip.
