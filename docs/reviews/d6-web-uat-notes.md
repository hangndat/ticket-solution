# D6 Web UX/UI — headless UAT notes

**Branch:** `hangndat/d6-web`  
**Issues:** #82 (web half), #83, #84, #85  

## Token mapping (`brand/vemoki/tokens.json` → CSS)

| Token | CSS var | Notes |
| --- | --- | --- |
| `colors.ink` | `--ink` | Body text / chrome |
| `colors.paper` | `--paper` | Page background (+ subtle gradient mix) |
| `colors.signal` | `--signal` | Wordmark arrow / accent |
| `colors.focus` | `--focus` | `:focus-visible` rings |
| Spacing | `--space-1`…`--space-8` | 4→72px scale |
| Type | `--font-display` (Syne), `--font-body` (Be Vietnam Pro) | next/font; not Arial/Inter |

## Screenshots (gitignored)

Captured via `scripts/web-uat.sh screenshot` under `apps/web/.uat-artifacts/`:

- `d6-home.png` — `/`
- `d6-redeem.png` — `/redeem`
- `d6-gate.png` — `/gate`
- `d6-admin.png` — `/admin`
- `d6-account.png` — `/account`
- `d6-event.png` — demo event public

## Limits

- Fail-closed OIDC pages show empty/error chrome without live session.
- Admin/platform panels unchanged in API contract — visual/IA only.
- D6 PASS ≠ pilot ready.
