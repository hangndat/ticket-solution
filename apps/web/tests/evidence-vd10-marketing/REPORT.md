# VD-10 B-WEB-MKT evidence (DS-WEB-01..08)

| Finding | Status | Notes |
| --- | --- | --- |
| DS-WEB-01 | Fixed | `MarketingNeonPrimaryButton` on legacy `cta.tsx` repeat demo; sales `#demo` anchor on hero link |
| DS-WEB-02 | Fixed | Interest submit uses `MarketingNeonPrimaryButton` (DEC-03) |
| DS-WEB-03 | Fixed | Neon primary uses `variant="ghost"` + scoped CSS hover (no primary CVA fight) |
| DS-WEB-04 | Fixed | Legal/support header demo via `mkt-neon-btn-primary` + paper-surface CSS |
| DS-WEB-05 | Fixed | Mobile menu toggle → `@ticket/ui` `Button` `ghostOnInk` |
| DS-WEB-06 | Fixed | `outcomes.tsx` demo neon; `CtaSection` not mounted on sales (neon page uses dialog interest) |
| DS-WEB-07 | Verified | Retry uses `secondary` + `mkt-neon-interest-retry` on paper dialog |
| DS-WEB-08 | Documented | Comment on `interest-cta-link.tsx` — intentional anchor + `.mkt-neon-btn-secondary` |

Captured against local dev (`vd10-marketing-evidence.mjs`).
