# DoD revalidation — PR #92 (D6 web UX, post font fix)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_91ee5663-55ec-448e-9384-1b6f541fcc94`, task `task_6989eb044894`, dispatch `ctx_dace72f7eef1`) — ≠ implementer `ctx_b9c35513e94c`, ≠ fix `ctx_dc1cb4287133` |
| Scope | Issues #83–#85 (+ web #82); parent #81; PR #92; paths `apps/web/**`, `docs/reviews/d6-web-uat-notes.md` |
| Commit SHA | `ec8eac6180c150d96bcc02d0a0242b0c1bd13501` (confirmed `gh pr view 92 --json headRefOid`) |
| Prior review | **FAIL** on `613518a631ff5f477f48359b6dbd143477d454e1` (`next/font/google` CI build) — **not reused**; this is a fresh revalidation |
| Checks | Ownership `origin/main...SHA` = web + UAT notes only; `git grep` no `next/font/google` / googleapis / gstatic in build path (README mentions only); GitHub Actions run [39012194882](https://github.com/hangndat/ticket-solution/actions/runs/39012194882): `web` **SUCCESS** (lint/typecheck/test/build + routes) on this tip SHA; `ci` + `turbo-persist` SUCCESS; BE/mobile/DB skipped (web-only) |
| Verdict | **PASS with known gap** |

## Checklist (revalidation)

1. UX brand/tokens/ownership after font change — **PASS**. O09 CSS vars (`--ink`/`--paper`/`--signal`), `vemoki↗` chrome via `site-chrome` / layout footer, Syne + Be Vietnam Pro still wired via `--font-display` / `--font-body`. Font fix only swapped loader (`google` → `local`); no API/chrome regression in tip vs prior UI PASS.
2. Self-hosted `next/font/local` + OFL under `apps/web/fonts/` — **PASS**. `layout.tsx` imports `next/font/local` only; TTFs + `OFL-*.txt` + README present; no Google Fonts fetch in build path.
3. CI web green on **this** tip SHA — **PASS** (see Checks).
4. No backend/contract changes — **PASS** (diff ownership web + review notes only).

## Known gaps (non-blocking)

- Internal naming `AuthPoc` / `auth-poc` / “D1 identity POC” comment still present (not user-facing chrome).
- UAT screenshots gitignored; OIDC fail-closed path lacks live session in notes.
- D6 DoD PASS ≠ pilot ready / store submission.

## Prior FAIL (historical)

`613518a…` — `@ticket/web#build` failed on `next/font/google` ImportMappingReplacement. Fixed by `ec8eac6…` (`fix(web): self-host Syne + Be Vietnam Pro for CI-safe next build`).
