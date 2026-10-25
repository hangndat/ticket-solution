# VD10 batch B-WEB-ATT + B-WEB-PLAT + primitives (DS-WEB-09..22)

| ID | Status | Notes |
| --- | --- | --- |
| DS-WEB-09 | Fixed | `Button variant="attendeePrimary"` on consumer catalog/home CTAs |
| DS-WEB-10 | Fixed | Sidebox + all surfaces share `attendeePrimary` variant |
| DS-WEB-11 | Fixed | Redeem: submit/auth/success = attendeePrimary; wallet link secondary on error |
| DS-WEB-12 | Fixed | Catalog search uses `@ticket/ui` `Input` |
| DS-WEB-13 | N/A | Hidden select unchanged (a11y fallback OK) |
| DS-WEB-14 | Fixed | `SurfaceState` rounded-2xl + `border-line` (web + package) |
| DS-WEB-15 | Fixed | not-found/error use `attendeePrimary` |
| DS-WEB-16 | Partial | Session uses `SurfaceState`; claim outcomes still section chrome (no custom Alert sweep) |
| DS-WEB-17 | Fixed | Ticket state chip `text-xs` (12px) |
| DS-WEB-18 | Fixed | Dev design-system copy updated |
| DS-WEB-19 | Fixed | `DualRunBanner` → `@ticket/ui` `Alert` |
| DS-WEB-20 | N/A | Banner only when env enables; no admin UI change |
| DS-WEB-21 | Fixed | `primary` hover darkens signal instead of ink flip |
| DS-WEB-22 | Fixed | `cardVariants` + `alertVariants` use `rounded-2xl` |

Marketing regression: `marketing-regression-1440.png`, `marketing-regression-390.png`.
