# VD-11 consumer header performance evidence

## Root causes addressed

- `SiteNav` remounted on every route via `ConsumerPageShell` and `loading.tsx`, re-running nav discovery and `/api/bff/me` per navigation.
- `NavCapabilitiesStore.refresh()` published guest chrome during revalidation, swapping link sets for logged-in users.
- Avatar email appeared after fetch without reserved width; product surface lacked `scrollbar-gutter: stable`.

## After metrics (local prod, guest session)

Captured by `node apps/web/tests/vd11-header-perf-evidence.mjs http://127.0.0.1:3000` — see `metrics.json` in this folder.

| Metric | After (2026-10-25) |
| --- | --- |
| Header height (1440) | 73px stable across `/` ↔ `/redeem` |
| Header ΔY / Δheight per nav | 0 / 0 |
| CLS increment per nav hop | 0 |
| Nav transition (client) | ~42–45ms |
| CLS after initial load | 0 |

## Before (inferred from prior implementation)

| Signal | Before (typical logged-in) |
| --- | --- |
| Header remounts per route | Yes (shell + loading duplicate) |
| Nav guest flash on refresh | Yes (`refresh()` reset links) |
| CLS on nav hop | High (nav items + avatar/email pop-in) |
| Nav transition | Extra client fetches per mount |

Logged-in CLS/INP on production requires an authenticated Playwright storage state (not committed).
