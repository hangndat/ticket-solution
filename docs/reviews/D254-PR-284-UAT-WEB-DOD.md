# DoD review — PR #284 / Issue #282 (web headless UAT, ADR-19)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` · Task `task_cc4b9c8e41f8` · Dispatch `ctx_b164d288425d` · terminal `term_f7a2811e-f021-428f-8ae8-f4a0f87f2ddc` |
| Implementer (≠ reviewer) | Task `task_d8680a1d0f96` · Dispatch `ctx_6cb538443192` · Role `web` · evidence `docs/reviews/D254-MILESTONE-UAT-WEB.md` |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#282](https://github.com/hangndat/ticket-solution/issues/282) · PR [#284](https://github.com/hangndat/ticket-solution/pull/284) · ownership **docs/reviews** (UAT evidence web; không merge) |
| Commit SHA (docs tip) | `12a6ad9474de1c6d8b843a0f85271b1e7d162615` (verified `gh pr view 284 --json headRefOid`) |
| UAT base `main` SHA | `7923004af65131d7033a8556d39a214122fa59cf` (cited in evidence; `origin/main` ancestor + tip match at review time) |
| Architecture impact | Không (acceptance / milestone gate) — đối chiếu [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) published SoT |
| Verdict | **PASS** |

## Checklist

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Evidence cite exact `main`/UAT SHA + lệnh headless (không headed/cliclick) | **PASS** — `D254-MILESTONE-UAT-WEB.md` ghi `main` `7923004af65131d7033a8556d39a214122fa59cf`; lệnh `scripts/web-uat.sh screenshot|goto` qua Playwright / chrome-headless-shell; script mặc định headless (`WEB_UAT_HEADED` chỉ khi user yêu cầu). Không cliclick / computer-use. |
| 2 | Artifact paths credible; ADR-19 published SoT; không fixture-as-published | **PASS** — paths `apps/web/.uat-artifacts/d254-*.png` (gitignored, convention đúng); Nest public `mfest-demo`/`demo-studio` → titles khớp; home copy «từ máy chủ»; claim không Sunburst/Northline. Fail-closed unreachable đã cover sẵn bởi `docs/reviews/D254-PR-270-WEB-PUBLIC-DOD.md` + `routes.integration.mjs` (session #282 chốt happy-path còn lại sau #270). |
| 3 | CI trên tip docs PR | **PASS** — Actions run [39095716920](https://github.com/hangndat/ticket-solution/actions/runs/39095716920): `changes` SUCCESS, `ci` SUCCESS; `web`/`backend`/`mobile`/… SKIPPED (docs-only — hợp lý). |
| 4 | Artifact DoD + comment VI | **PASS** — file này + comment VI trên PR #284 / Issue #282. |
| 5 | Verdict | **PASS** |

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker / should-fix trước merge docs PR theo AC web của #282. |
| Nit | Issue #282 gợi ý tên `docs/reviews/D254-MILESTONE-UAT.md`; implementer dùng `D254-MILESTONE-UAT-WEB.md` (rõ slice web) — chấp nhận được. |
| Nit | PNG không có trong worktree reviewer (gitignored; tạo ở session implementer) — credibility dựa path + JSON `goto` 200 + mô tả quan sát trong evidence. |

## Limitations / ngoài phạm vi

- Phần **iOS** sim UAT của #282 thuộc worker riêng — không đánh giá trong PR #284.
- Reviewer không re-run Playwright/Nest trong session này (docs-only review trên tip SHA); runtime evidence = implementer artifact + CI tip.
- Không deploy prod; không full D11 #236; không merge `main` (Task: review only).

## Checks (trên SHA)

```text
gh pr view 284 --json headRefOid
→ 12a6ad9474de1c6d8b843a0f85271b1e7d162615

git rev-parse origin/main
→ 7923004af65131d7033a8556d39a214122fa59cf

CI tip (actions/runs/39095716920): changes SUCCESS, ci SUCCESS; runtime jobs SKIPPED (docs-only)

Source review: docs/reviews/D254-MILESTONE-UAT-WEB.md,
  docs/ops/ADR-19-EVENT-SERVER-SOURCE.md,
  scripts/web-uat.sh, scripts/web-uat.mjs,
  docs/reviews/D254-PR-270-WEB-PUBLIC-DOD.md (fail-closed prior)
```

## Verdict

**PASS** trên exact docs tip SHA `12a6ad9474de1c6d8b843a0f85271b1e7d162615` cho gate **web headless published SoT** (UAT trên `main` `7923004af65131d7033a8556d39a214122fa59cf`).

Coordinator có thể merge PR #284 sau khi đủ quyền integration; Project `Hoàn thành` cho phần web chỉ sau merge + đủ gates còn lại của #282 (iOS nếu còn mở).
