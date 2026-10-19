# UAT gap evidence — PR #558 · Issue #554 (web Phase 3)

| Field | Value |
| ----- | ----- |
| Wave | UX-UI-P3 · UAT gap (post DoD PASS with known gap) |
| Session | Wave leader `task_8ebfe868fd7f` / `ctx_7d39f2155129` (fan-out blocked → inline UAT) |
| PR commit SHA | `5f83766294a6b00c5b3c515df3aeb3c3f301dbe0` |
| DoD artifact | `docs/reviews/ux-ui-p3-web-554-pr558-dod.md` (PASS with known gap) |

## Orca embedded browser

| Step | Result |
| ---- | ------ |
| `orca tab create --url http://127.0.0.1:3272/invite --worktree path:…/ux-ui-p3-web-554` | Returned `browserPageId`; `orca tab list` empty immediately after |
| `orca exec --command snapshot` / `screenshot` | `browser_tab_not_found` / `browser_no_tab` |

**Limitation:** Orca browser tab did not stay attachable in this session. Evidence below uses HTTP UAT + SSR smoke per `uat-headless.mdc` § HTTP-only (no Playwright/agent fallback).

## Local server (review worktree)

```bash
pnpm --filter @ticket/web build
pnpm --filter @ticket/web start --port 3272
```

## Invite / marketing / redeem checks

| Surface | Command | Result |
| ------- | ------- | ------ |
| `/invite` SSR | `curl -s http://127.0.0.1:3272/invite` | `invite-form-panel`, `invite-submit`, `invite-token-empty` present |
| Invite HTTP UAT | `WEB_UAT_INVITE_SKIP_LOGIN=1 node apps/web/tests/invite-http-uat.mjs http://127.0.0.1:3272` | `tokenLeakedInUrl: false`; CSRF evil/missing **403**; `afterParkUrl` path-only; `acceptOk: false` (no live Nest — **unchanged known gap**) |
| Marketing | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3272/marketing/privacy` | **200** (VI privacy body + `mkt-footer`) |
| Redeem | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3272/redeem` | **200** |

## Artifacts (gitignored)

| Path | Note |
| ---- | ---- |
| `apps/web/.uat-artifacts/invite-http-1792390076897.png` | invite-http-uat capture @ gap pass |
| `apps/web/.uat-artifacts/invite-http-1792386718021.png` | prior DoD reviewer capture |
| `docs/reviews/o13-issue-381-uat/*.png` | marketing sales/privacy/support (DoD PASS) |

## Gap status vs DoD

- **Closed for merge (ops):** Visual/copy AC + CSRF + token park + marketing/redeem HTTP smoke re-run on gap pass.
- **Still open (ops):** Live membership **accept** E2E without Nest/BFF stack — same as DoD § Known gap; not introduced by PR #558.

## Merge recommendation

Coordinator may merge **#558** after board process: CI green on `5f837662`, independent DoD+sec artifacts present; remaining accept gap is documented ops dependency.
