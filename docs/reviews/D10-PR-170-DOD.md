# DoD revalidation — PR #170 (D10 ASC S1+S3 metadata)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_978f0bbe-9f0a-4988-9f4f-768ab3d1193f` · task `task_146a267b2d4e` · dispatch `ctx_501b9603eb20` (≠ implementer `term_3fc31cb0-815f-43ac-ab9a-b89e43fcc7f5` / `task_855fcfd274b8`) |
| Scope | PR #170 · Issues #151–#153 / #157–#159 (Epic #150) · `docs/asc/**`, `docs/reviews/D10-ASC-S1-S3-METADATA.md`, `apps/mobile/ASC-METADATA.md`, `apps/mobile/README.md` |
| Commit SHA reviewed | `b1232f53d5fc9352283423b4feea3a8493c140e4` (confirmed `gh pr view 170 --json headRefOid`) |
| Prior reviewed SHA | `6f559fad0d3d3d9efd19389108bd05d64a7141d4` — **superseded**; tip moved (promo fix + rebase) |
| Checks | CI run [39023911146](https://github.com/hangndat/ticket-solution/actions/runs/39023911146) on tip: **changes** SUCCESS · **mobile** SUCCESS · **ci** SUCCESS · **turbo-persist** SUCCESS (web/backend/database-isolation/d5-* SKIPPED). Docs-only — no archive/TestFlight/store submit. `curl -sI https://vemoki.com/privacy` → 404 (known gap). |
| Verdict | **PASS with known gap** |

## Revalidation delta vs FAIL at `6f559fad…`

- Blocking finding (EN Promotional Text 182 > 170) **fixed**: EN promo now **128 ≤ 170**; VI promo **153 ≤ 170**.
- Other ASC length gates OK on tip: EN name 6/30, EN subtitle 29/30, keywords 83/100; VI name 6/30, VI subtitle 26/30.

## Findings

- Docs-only + mobile ASC pointer; no runtime app behavior change.
- Identity pointer matches `apps/mobile/app.config.ts` on integration tree: bundle `com.hangndat.ticket`, Team `BLUA62D52G`, name `Vemoki`, camera usage string, `ITSAppUsesNonExemptEncryption: false`.
- Claim boundary “chưa submit” clear; demo Keycloak fixtures marked non-prod; prod review passwords not committed.
- Impl evidence file still cites pre-rebase SHA `dd6f7bed…` inside the table (chicken-egg after tip-align + rebase) — **non-blocking**; this review is on tip OID above.

## Known gaps (intentional — block store submit, not docs DoD)

1. `https://vemoki.com/privacy` → HTTP 404; publish before submit.
2. ASC UI screenshots after manual fill — not in this PR.
3. Production review credentials paste-only in ASC when TestFlight binary ready.
4. Screenshots/preview + local archive/TestFlight = other Epic #150 stories.

## Merge note

**Coordinator may merge** after board process. Reviewer did **not** merge.
