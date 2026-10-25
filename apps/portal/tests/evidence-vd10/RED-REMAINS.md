# Portal — remaining red / rose usage (post VD10 tenant default + loading primary fix)

SHA: `64fe91e45fec1b310a0f151936cc9f146028e54b` (branch `hangndat/vd09-marketing-neon`)

Grep `#E11D48` in `apps/portal` after change:

| Location | Why kept |
| --- | --- |
| `src/theme/vemoki.ts` `VEMOKI_COLORS.signal` | Brand token parity with `brand/vemoki/tokens.json`; not used for product chrome |
| `src/theme/vemoki-root-vars.ts` `--vemoki-signal` | CSS var alias for `signal` token (no non-error consumers in portal CSS) |

Grep `var(--vemoki-signal)` in `apps/portal`: **none** (loading spinner uses `--vemoki-primary` → `#7C4DED`).

Other semantic reds (not `#E11D48`):

| Location | Why kept |
| --- | --- |
| `vemokiTheme.token.colorError` `#B3213A` | Ant Design semantic error |
| `PORTAL_ALERT_TOKENS` error bg/border | Destructive/error alert surfaces |
| `Button` `danger` / form validation | Semantic deny/destructive (Ant defaults) |

Verified: `colorPrimary` and `DEFAULT_TENANT_PRIMARY_COLOR` are `#7C4DED`. Config, onboarding, and settings placeholders read from `DEFAULT_TENANT_PRIMARY_COLOR`.
