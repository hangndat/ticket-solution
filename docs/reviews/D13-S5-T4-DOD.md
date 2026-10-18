# D13-S5-T4 — DoD + security (authz deletion / demo roles)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca Cursor `reviewer-dod` (+ authz/security checklist) · terminal `term_b3e8a694-d705-482b-b658-a6c5aaf06a32` · task `task_9adffff8ecff` · dispatch `ctx_0bfa9bfbd77b` · **≠** implementer sessions S5-T1/T2/T3 |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#309](https://github.com/hangndat/ticket-solution/issues/309) · Task [#331](https://github.com/hangndat/ticket-solution/issues/331) · after S5-T1 [#328](https://github.com/hangndat/ticket-solution/issues/328) / S5-T2 [#329](https://github.com/hangndat/ticket-solution/issues/329) / S5-T3 [#330](https://github.com/hangndat/ticket-solution/issues/330) |
| Architecture impact | **Không** — review only; không sửa product code |
| **Exact tip SHA** | **`9910173dc1c4f016448e2bc230ab6843c419b315`** (`origin/main` tip tại thời điểm review) |
| Decision IDs | O06 (account deletion / anonymize ≤30d); không O02 chrome trong scope S5-T4 |
| **Verdict** | **PASS with known gap** |

---

## 1. Tip SHA + ancestry

| Check | Result |
| ----- | ------ |
| `git rev-parse origin/main` | `9910173dc1c4f016448e2bc230ab6843c419b315` |
| Subject | `[P2] A11y residual redeem/admin/gate (axe + focus) — Fixes #382 (#386)` |
| S5-T1 merge ancestry | PR [#313](https://github.com/hangndat/ticket-solution/pull/313) `c70631dd46d9…` ⊆ tip |
| S5-T2 merge ancestry | PR [#361](https://github.com/hangndat/ticket-solution/pull/361) `66792420121f…` ⊆ tip |
| S5-T3 merge ancestry | PR [#347](https://github.com/hangndat/ticket-solution/pull/347) `1183773a5e3c…` ⊆ tip |
| SEC-1 ACK revoke | PR [#352](https://github.com/hangndat/ticket-solution/pull/352) tip `626b860bc328…` ⊆ tip |
| SEC-2 IdP erasure | PR [#357](https://github.com/hangndat/ticket-solution/pull/357) tip `8d5e9d7ce9e9…` ⊆ tip |
| CI on tip | GitHub check-runs @ tip: **all `success`** (incl. `database-isolation (account-deletion, …)`, `mobile`, `web`, aggregate `ci`) |

Issues #328 / #329 / #330 = **CLOSED**. Issue #327 (S4-T3 physical TF) vẫn **OPEN** — xem §5.

---

## 2. Checklist vs AC

| # | Gate | Verdict | Evidence |
| - | ---- | ------- | -------- |
| 1 | Account deletion / privacy in-app (mobile) + companion web notes | **PASS** | Mobile: `apps/mobile/src/account-deletion/*` + `screens/account.tsx` wires `SessionScopedAccountDeletionPanel` + **Chính sách quyền riêng tư** → `PRIVACY_POLICY_URL=https://vemoki.com/privacy`. Implementer artifact `docs/reviews/D13-S5-T1-PRIVACY-ACCOUNT-DELETION.md`. Web companion: PR #347 + `docs/reviews/D13-WEB-STORE-UAT.md` / prior DoD `docs/reviews/D13-PR347-DOD.md` (privacy/support/account paths; headless Playwright). |
| 2 | Demo reviewer roles: không secret trong git; docs/ops đủ ASC | **PASS** (gap nhỏ) | `docs/reviews/D13-S5-T2-DEMO-REVIEWER.md`: ROPC OK trên prod IdP; dedicated `review-*` passwords **chỉ** VPS `/opt/vemoki/secrets/app-review/…` mode 600. Git chỉ placeholders. `docs/asc/app-review-notes.md` vẫn ghi fixture `attendee-demo` / `staff-demo` (realm-import demo — intentional ASC fixture, không phải secret `REVIEW_*`). |
| 3 | Authz: deny-by-default; deletion/anonymize không lộ cross-tenant | **PASS** | API `requestDeletion` / `currentDeletion` → `selfActor` (OIDC bearer bắt buộc; userId từ identity verified). `createAccountDeletionRequest` chỉ thao tác `user_id` của caller trong `withActor`. Anonymize SQL (`apply_account_anonymization`) keyed by `request_id` → `user_id`; không DELETE audit; không query theo tenant arbitrary. Prior security DoD PASS: `D13-PR352-R2-DOD-SECURITY.md`, `D13-PR357-R4-DOD-SECURITY.md` (ancestors của tip). Prod unauth smoke (reviewer, 2026-10-18): `POST`/`GET` `/v1/me/account-deletion-requests*` → **401**. |
| 4 | Artifact exact SHA + checks + verdict | **PASS** | File này. |
| 5 | Không claim App Store Submit / TF physical smoke (#327) PASS nếu thiếu evidence | **PASS** (không claim) | `#327` OPEN; `docs/reviews/D13-S4-T3-DEVICE-SMOKE.md` verdict **BLOCKED (không PASS)**. Reviewer **không** tuyên bố TF device smoke / Submit for Review / Ready for Sale. |
| 6 | Comment Issue #331 | **Draft below** | Worker channel cấm post GitHub trong run; coordinator paste comment §7. |

---

## 3. Checks chạy trên / đối chiếu tip

```text
# Tip
git rev-parse origin/main
→ 9910173dc1c4f016448e2bc230ab6843c419b315

# Mobile unit (account-deletion) — 14/14 pass (source khớp tip ancestry)
cd apps/mobile && node --experimental-strip-types --test src/account-deletion/*.test.ts
→ 14 pass / 0 fail

# Prod deny-by-default (no bearer)
curl -X POST https://api.vemoki.com/v1/me/account-deletion-requests -H 'content-type: application/json' -d '{}'
→ 401
curl https://api.vemoki.com/v1/me/account-deletion-requests/current
→ 401

# CI @ tip (gh check-runs)
→ ci / mobile / web / database-isolation (account-deletion …) = success
```

Backend DB isolation suite: **không** re-run local (worktree thiếu `node_modules`); tin CI shard account-deletion xanh trên exact tip + prior SEC reviews trên ancestor SHAs.

CRG: `list_graph_stats_tool` sẵn; incremental build không đổi vì MCP graph HEAD lệch worktree — **source + git show tip + tests thắng**.

---

## 4. Findings

| ID | Severity | Notes |
| -- | -------- | ----- |
| — | — | Không blocker mới trên tip cho S5-T4 AC. |

---

## 5. Known gaps (chấp nhận được — không nuốt gate S5-T4 bắt buộc)

1. **#327 S4-T3** physical TestFlight `1.0.0 (10)` smoke vẫn **BLOCKED** — ngoài AC đóng S5-T4; **cấm** dùng verdict này để mở S6 submit.
2. **ASC Sign-in paste** chưa làm (S5-T2 documented) — cần binary Review/TF + operator.
3. **Authenticated prod e2e** `POST` account-deletion với demo reviewer: chưa (T1 ghi rõ); unauth 401 + unit/API wiring đủ cho gate “paths + authz”, không claim prod erasure E2E.
4. **iOS Simulator headless UAT** S5-T1 skipped (sim occupied) — physical/TF vẫn gate riêng (#327).
5. **Live Keycloak DELETE** trên prod: prior SEC reviews PASS với gap HTTP-fixture only — không reopen ở S5-T4.
6. Fixture passwords `attendee-demo`/`staff-demo` vẫn trong `docs/asc/app-review-notes.md` (demo ASC); dedicated `REVIEW_*` không có trong git.

---

## 6. Limitations (process)

- Review only — không merge, không đổi Project Status, không deploy, không Submit.
- Không post GitHub Issue/PR từ worker session (Orca channel rule); artifact + draft comment bàn giao coordinator.
- Worktree branch `hangndat/hangndat-d13-dod-331` có thể lệch tip local HEAD; review neo **`9910173…`** qua `origin/main` / `git show`.

---

## 7. Draft comment Issue #331 (coordinator paste)

```text
## DoD S5-T4 — PASS with known gap

- Reviewer: Orca Cursor reviewer-dod · task_9adffff8ecff / ctx_0bfa9bfbd77b (≠ implementer S5)
- Exact tip SHA: 9910173dc1c4f016448e2bc230ab6843c419b315 (origin/main)
- Artifact: docs/reviews/D13-S5-T4-DOD.md
- Checks: mobile account-deletion 14/14; prod unauth deletion routes 401; CI tip all success (incl. account-deletion shard)
- S5-T1/T2/T3 closed + merges in ancestry; authz selfActor + prior SEC PASS (#352/#357) retained
- Không claim #327 TF physical smoke / App Store Submit PASS (artifact S4-T3 vẫn BLOCKED)
- Known gaps: ASC paste chưa; authenticated prod deletion e2e chưa; sim UAT S5-T1 skipped; live IdP DELETE prod không claimed
```
