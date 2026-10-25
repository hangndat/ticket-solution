# Portal — remaining red / rose usage (post VD10 tenant default)

SHA: `cb70fceb69dc17eb799084442072ea23308ba518` (branch `hangndat/vd09-marketing-neon`)

Grep `#E11D48` in `apps/portal` after change:

| Location | Why kept |
| --- | --- |
| `src/theme/vemoki.ts` `VEMOKI_COLORS.signal` | Brand token parity with `brand/vemoki/tokens.json`; not product/tenant primary |
| `src/theme/vemoki-root-vars.ts` `--vemoki-signal` | CSS var alias for `signal` token |
| `app/globals.css` `.portal-surface-loading__spinner` | Uses `var(--vemoki-signal)` for loading chrome (non-error); literal `#E11D48` not present |

Other semantic reds (not `#E11D48`):

| Location | Why kept |
| --- | --- |
| `vemokiTheme.token.colorError` `#B3213A` | Ant Design semantic error |
| `PORTAL_ALERT_TOKENS` error bg/border | Destructive/error alert surfaces |
| `Button` `danger` / form validation | Semantic deny/destructive (Ant defaults) |

Verified: `colorPrimary` and `DEFAULT_TENANT_PRIMARY_COLOR` are `#7C4DED`. Config, onboarding, and settings placeholders read from `DEFAULT_TENANT_PRIMARY_COLOR`.
