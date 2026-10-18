# DoD review — PR #93 (D6 iOS UX)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_15c8005f-5c0e-4be6-9138-402974c602b4`, task `task_99178d2c5c98`, dispatch `ctx_c42a6df86027`) — ≠ implementer `ctx_a4b9f44eee21` |
| Scope | Issues #87, #88 (+ iOS half #82); parent #81; PR #93; paths `apps/mobile/**` only |
| Commit SHA | `a3eabf248a4187026df59c4d5725de018ab4b565` (confirmed `gh pr view 93 --json headRefOid`) |
| Checks | PR file list = 17× `apps/mobile/**` only; detached worktree at tip: `pnpm typecheck` PASS, `pnpm lint` PASS, `pnpm test` **136 pass / 0 fail**; GitHub Actions run [39012398467](https://github.com/hangndat/ticket-solution/actions/runs/39012398467): `mobile` SUCCESS, `changes` SUCCESS, `ci` + `turbo-persist` SUCCESS; web/backend/DB skipped (iOS-only) |
| Verdict | **PASS with known gap** |

## Checklist

1. Vemoki tokens + VI polish + branded QR + a11y roles — **PASS**. `brand/vemoki/tokens.json` values mapped into `theme/colors.ts` (`ink`/`paper`/`signal`/`focus`); `colors.accent` = `brand.signal` (replaces `systemBlue`); tabs tint + CTAs/links use signal; `BrandWordmark` (`vemoki↗`); ticket canvas brand paper + ink QR; a11y roles unchanged (`alert` for unknown/pending redeem + unknown gate; VI label suffixes “Đây không phải vé…”, “Không cho vào”, “Không phải lượt vào”).
2. Ownership / no EAS Cloud — **PASS**. Diff is `apps/mobile/**` only; no web/backend edits; no EAS Cloud Build introduction (policy text only in docs).
3. CI / mobile checks — **PASS** (local + GitHub mobile green on exact SHA). sim-uat ticket-QR screenshot needs OIDC/fixture — **documented** on PR; accepted limitation.
4. Design not systemBlue-only product chrome — **PASS**. Product accent is rust signal `#9b3a18`; admit/deny/unknown tones without purple/glow.

## Known gaps (non-blocking)

- `gate-scan.ts` runtime English strings remain (e.g. “Do not admit”) while UI/a11y chrome is VI; supervisor constant + related UI are VI.
- Some exception/error paths in account/wallet still English.
- `brand.focus` mapped but unused in this PR; QR default `paperColor` stays `#ffffff` for scan contrast (canvas uses brand paper).
- sim-uat screenshots gitignored; live ticket QR UAT blocked without OIDC.
- D6 DoD PASS ≠ pilot ready / store submission.

## Findings

No blocking defects. Revalidation required if tip SHA gains behavioral commits after this review.
