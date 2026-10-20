# DoD + Security re-review — PR #587 / Issue #580 (MPR-T3+T4 iOS)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · `reviewer-dod` + `reviewer-security` (James dod+sec) · `task_49a241ffb616` / `ctx_4551f83df7dd` |
| Implementer (≠ reviewer) | iOS wave worker (MPR-T3+T4) |
| Prior review | [MPR-PR587-REVIEW-2026-10-20.md](./MPR-PR587-REVIEW-2026-10-20.md) — **FAIL** @ `5c0078e1b265` |
| Scope | Epic [#580](https://github.com/hangndat/ticket-solution/issues/580) · PR [#587](https://github.com/hangndat/ticket-solution/pull/587) · `apps/mobile` |
| Commit SHA | `0f5b9adec6846024369421c4951ab509b93178ca` (`hangndat/mpr-t4-ios-account-push`) |
| Verdict (DoD) | **PASS** |
| Security verdict | **PASS** |

## Revalidation targets (prior FAIL)

| # | Tiêu chí | Trước | Sau |
| --- | --- | --- | --- |
| 1 | `events-home.test.ts` — không import demo helpers đã xóa | FAIL | **PASS** — suite refactor fail-closed/O18; 6/6 pass @ SHA |
| 2 | Merge với `main` | CONFLICTING / DIRTY | **PASS** — `mergeable=MERGEABLE`, `mergeStateStatus=CLEAN`, `headRefOid` = review SHA |
| 3 | CI trên exact SHA | empty check-runs | **PASS** — `./scripts/gh-dod-evidence.sh 587` green (`mobile`, `ci`, `backend`, `web`, …) |
| 4 | WebView privacy navigation allowlist | known gap (no `onShouldStartLoadWithRequest`) | **PASS** — `shouldAllowPrivacyNavigation` + `onShouldStartLoadWithRequest` on `privacy-policy-webview.tsx` |

## Checklist (Wave 1 iOS scope — unchanged PASS items)

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | K-API-02 prod API base | **PASS** (unchanged; đối chiếu prior review) |
| 2 | Events home platform catalog, fail-closed | **PASS** |
| 3 | Account PD layout / routes | **PASS** |
| 4 | Push permission state machine | **PASS** |
| 5 | Wallet contextual push prompt | **PASS** |
| 6 | Unit tests in PR scope | **PASS** — `pnpm --filter @ticket/mobile test` @ SHA: **257 pass / 0 fail** (sau `pnpm --filter @ticket/contracts build`) |
| 7 | Integrate + CI on SHA | **PASS** — see checks below |
| 8 | Security (auth, push, catalog, WebView) | **PASS** — WebView hardening landed |

## Security

- **Privacy WebView** — Fixed prior gap: every navigation request gated by HTTPS `vemoki.com` + `/privacy` path prefix (`isTrustedPrivacyUrl` / `shouldAllowPrivacyNavigation`).
- **Catalog / API / push / session** — No new concerns vs prior PASS-with-gap review; no secret leak or permission abuse observed in revalidation scope.

## Limitations

- Reviewer did not merge (per Spec).
- Manual UAT AC-A1..A9 not executed in this session.
- Local full mobile suite requires monorepo contract build (same as CI); ad-hoc run without build showed false negatives on redeem tests only.

## Checks (exact SHA)

```text
git rev-parse 0f5b9adec6846024369421c4951ab509b93178ca
→ 0f5b9adec6846024369421c4951ab509b93178ca

gh pr view 587 --json mergeable,mergeStateStatus,headRefOid
→ mergeable=MERGEABLE mergeStateStatus=CLEAN headRefOid=0f5b9adec6846024369421c4951ab509b93178ca

./scripts/gh-dod-evidence.sh 587
→ head.sha=0f5b9adec6846024369421c4951ab509b93178ca state=open mergeable=true
→ turbo-persist, ci, web, portal, mobile, backend, changes: success

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/mobile test
→ 257 pass, 0 fail

node --experimental-strip-types --test apps/mobile/src/published/events-home.test.ts
→ 6 pass, 0 fail
```

## Verdict

**PASS** (DoD) — prior blockers (tests, mergeability, CI) resolved on `0f5b9ad`.

**PASS** (security) — WebView navigation allowlist implemented; no remaining known gap from prior review.
## Post-merge note (2026-10-20)

Primary file `MPR-PR587-REVIEW-2026-10-20.md` updated to **PASS** @ `0f5b9ad` (docs PR #590); merge commit `453bcdc`.
