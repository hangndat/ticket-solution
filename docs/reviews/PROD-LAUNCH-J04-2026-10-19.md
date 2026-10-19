# PROD-LAUNCH J04 — Gate HTTP + platform env + portal shell (DoD + security)

| Field | Value |
| ----- | ----- |
| Reviewer / session | James · dod+sec (`task_55683701490c`) |
| Commit SHA (exact) | `979483083f5f1d44f01d012b48b0bd2fb30b5ffb` |
| Subject | `fix(gate): accept created sessions and record prod platform env` |
| Architecture impact | Có — OIDC scopes, `PLATFORM_*` prod fail-close, nginx buffer, Gate HTTP 200 vs Nest 201 |
| Scope paths | `apps/api/src/gate.ts`, `apps/web/{app/gate/gate-form.tsx,src/gate/decide.ts,tests/gate-decide.test.ts}`, `apps/mobile/src/gate/{gate-scan.ts,gate-scan.test.ts}`, `apps/portal/{app/layout.tsx,src/components/{portal-shell,dual-run-banner}.tsx}`, `infra/deploy/{compose.yaml,nginx-portal.snippet.conf}` |

## Summary

Hotfix aligns Gate clients with Nest default **201 Created** (and explicit **200** after `@HttpCode(200)`), records production `PLATFORM_*` on the API service so `readPlatformSecurityConfig` does not fail-closed at boot, drops `offline_access` from portal compose OIDC scopes, enlarges portal nginx proxy buffers for OIDC callback cookies, and passes server-resolved `PRODUCT_ORIGIN` into portal client shell / Gate deeplink.

## Scope verification (diff `979483083f5f^..979483083f5f`)

| AC / theme | Evidence in SHA |
| ---------- | ---------------- |
| Web + iOS accept 200 \| 201 on session, hold, confirm | `gate-form.tsx`, `decide.ts`, `gate-scan.ts` treat `200 \|\| 201` with unchanged body gates (`sessionId`, hold fields, `state === 'USED'` + `checkinId`) |
| API `@HttpCode(200)` on open / reserve / confirm | `GateController` — `sessions`, `reservations`, `confirm` POST handlers |
| Compose `PLATFORM_*` + portal `OIDC_SCOPES` without `offline_access` | `api` env: invite/support/MFA/ACR/audience; `portal` `OIDC_SCOPES: openid profile email` (was `offline_access`) |
| Portal nginx buffer | `proxy_buffer_size 32k`, `proxy_buffers 8 32k`, `proxy_busy_buffers_size 64k` on `/` |
| `PRODUCT_ORIGIN` into client shell | `layout.tsx` → `PortalShell productOrigin={productOrigin()}` → `gateDeeplinkUrl({ PRODUCT_ORIGIN: productOrigin })` + `PortalDualRunBanner` |

## Checks run (on `979483083f5f`)

| Command | Result |
| ------- | ------ |
| `git show 979483083f5f --stat` + `git diff 979483083f5f^..979483083f5f` | 11 files; diff matches scope above |
| `git rev-parse 979483083f5f` | `979483083f5f1d44f01d012b48b0bd2fb30b5ffb` |
| `cd apps/mobile && pnpm exec node --test src/gate/gate-scan.test.ts` | **7/7 pass** (incl. `Nest 201 session and hold still admit`) |
| `cd apps/web && pnpm exec tsx --test tests/gate-decide.test.ts` | **5/5 pass** (incl. `confirm 201 with check-in admits`) |
| Static: `packages/backend/src/platform-config.ts` + compose `api` env | Production requires all `PLATFORM_*` + audience; compose now supplies values matching defaults (48h invite, 1h support max, 15m MFA, ACR `2`, `ticket-platform-api`) |

Not run in this session: full `apps/web` test suite, API integration/CI on GitHub, live prod HTTP/UAT after VPS deploy, nginx reload on conanphong.

## DoD findings

| # | Severity | Finding |
| --- | -------- | ------- |
| — | — | No blockers. Client admit/deny still keyed on response body invariants; session open no longer treats sole **201** as failure. |
| 1 | nit | `@HttpCode(200)` only on three mutating Gate endpoints in scope; other Gate POSTs unchanged (out of slice). |
| 2 | limitation | Nginx snippet and compose changes are **config-only** until deployed/restarted on VPS; this review is code-at-SHA only. |

O02 / PD §6.1 chrome: **N/A** — no tab/permission IA change in diff.

## Security findings

| Threat / abuse | Assessment |
| -------------- | ---------- |
| Admit on arbitrary HTTP status | **Mitigated** — status widened to 200/201 only; admit still requires `USED` + `checkinId` / valid hold payload. |
| Gate authz bypass | **No change** — `@ApiBearerAuth()` retained on controller mutations; diff does not touch membership/RLS paths. |
| Long-lived portal refresh (`offline_access`) | **Improved** — portal compose scopes omit `offline_access` (aligns PROD-LAUNCH UAT B02/B05 intent). Note: `readPortalOidcConfig` still defaults scopes to include `offline_access` when `OIDC_SCOPES` unset (dev); prod compose overrides. |
| `PLATFORM_*` misconfiguration / boot | **Improved** — explicit API env avoids `PLATFORM_MISCONFIGURED` throw in `NODE_ENV=production` per `readPlatformSecurityConfig`. |
| Gate deeplink host injection | **Unchanged risk** — `productOrigin()` normalizes via `URL` origin; server passes resolved string into client (avoids client-only env drift). |
| nginx buffer increase | **Hardening** — prevents 502 on large `Set-Cookie`; no weakening of TLS or auth. |
| Secrets in diff | **None** — no credentials committed; compose uses existing `${…}` secret refs. |

| # | Severity | Finding |
| --- | -------- | ------- |
| — | — | No fix-before-merge security issues in scope. |

## Verdict

| Gate | Verdict |
| ---- | ------- |
| DoD (implementation + unit evidence) | **PASS** |
| Security (scope) | **PASS** |
| **Combined** | **PASS** |

**Known gap (non-blocking):** Production runtime confirmation (portal callback 307, Gate scan on prod, nginx buffer under real OIDC cookie size) not exercised in this reviewer session; recommend launch-UAT or deploy smoke after VPS apply.
