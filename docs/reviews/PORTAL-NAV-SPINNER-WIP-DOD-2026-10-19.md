# Portal nav groups + home spinner WIP — DoD + Security (Wave C)

| Field | Value |
| --- | --- |
| **Reviewer / session** | James · dod+sec · `task_57380637b39a` (independent reviewer) |
| **Scope** | WIP uncommitted working tree, branch `hangndat/d1-portal-nav-groups`, paths `apps/portal/**` (~23 files, +276/−62). No PR. Intent: grouped sider nav, home/onboarding redirect loop fix, CSP/dev origins, loading surface hydration, BFF/OIDC timeouts, locale SSR alignment, `offline_access` scope default removal. |
| **Commit SHA** | **WIP (uncommitted)** on base `52bc54e3fdcb7b757c893507db7917d80cee1f2c` (`git rev-parse HEAD`) |
| **Architecture impact** | Client auth/discovery, CSP, hard navigation (`window.location.replace`), BFF/OIDC fetch timeouts, shell context dedupe — reviewed against deny-by-default nav (capabilities unchanged semantically; grouping only). |

## Checks

| Check | Command | Result |
| --- | --- | --- |
| Diff scope | `git diff HEAD --stat -- apps/portal` | 23 files, +276/−62 (excl. `test-results/`) |
| Unit tests | `pnpm --filter @ticket/portal test` | **FAIL** — 127 pass, **1 fail** (`VI_TO_KEY parity` for new `auth.error.notAllowed`) |
| Typecheck | `pnpm --filter @ticket/portal typecheck` | **PASS** |
| Lint | `pnpm --filter @ticket/portal lint` | **FAIL** — `surface-state.tsx` `react-hooks/set-state-in-effect` on `LoadingSurface` mount flag |
| Browser (unauth `/`) | Orca embedded browser `orca tab create --url http://127.0.0.1:3013/` + `orca snapshot` after ~10s | **PASS (spinner ends)** — a11y shows `Cần đăng nhập` / staff sign-in copy, not perpetual `aria-busy` loading. URL stayed `http://127.0.0.1:3013/` (no auto navigation to IdP in this session). |
| Browser (`/auth`) | Orca tab `http://127.0.0.1:3013/auth` | **PASS** — staff login link and copy render; no stuck loader. |
| Playwright headless | `npx playwright` install for scripted timing | **Not completed** (install hung >3m); Orca browser used instead. |
| HTTP smoke (no cookie) | `curl` BFF | `subject`/`tenants` → 401; `/` → 200 HTML (not acceptance alone). |

## Findings

| Sev | Area | Finding |
| --- | --- | --- |
| **Blocker** | CI / i18n | New `auth.error.notAllowed` strings added to `VI`/`EN` but **no `VI_TO_KEY` entry** for the VI literal — `tests/i18n.test.ts` fails. |
| **Blocker** | CI / lint | `LoadingSurface` uses `setMounted(true)` in `useEffect`; eslint `react-hooks/set-state-in-effect` errors with `--max-warnings 0`. |
| **Should-fix** | UX / auth flow | Unauthenticated `/` resolves to **PortalShell** “Cần đăng nhập” surface after shell discovery (~8s BFF timeout bound) rather than immediate `window.location.replace` to `/api/auth/login` (home page also calls replace; not observed in Orca browser). Not proven infinite spinner, but login path is manual (retry button) vs automatic redirect. |
| **Should-fix** | Evidence gap | **No signed-in** browser proof of grouped sider (`nav.group.*`) on a tenant/event route — only unauth paths exercised. |
| **Nit** | Dev UX | Next dev “issues overlay” showed 1 issue on `/auth` (likely eslint/hydration); not triaged further. |
| **Info** | Nav / O02 | Event menu `group: 'run' \| 'setup'` + Ant Design `Menu` groups; permissions still gate items in `capabilities.ts` — grouping does not bypass server permissions. New keys covered in `capabilities.test.ts` (pass). |
| **Info** | Spinner fix | Home/onboarding: guard `identity.status === 'loading'`, stable effect deps, `window.location.replace` instead of `router.replace`; `loadShellContext` inflight dedupe — reasonable fix for effect/cancel loops. |
| **Info** | Timeouts | `AbortSignal.timeout(20s)` upstream BFF, `15s` OIDC refresh, `8s` client `getJson` / subject fetch — reduces hung fetch risk; abort surfaces as error/unauth paths (fail-closed friendly). |

## Security review

| Topic | Assessment |
| --- | --- |
| **CSP `unsafe-eval`** | Gated on `NODE_ENV === 'development'` in `next.config.ts`; production branch keeps `script-src 'self' 'unsafe-inline'` only. **PASS** |
| **Dev origins** | `allowedDevOrigins: ['127.0.0.1', 'localhost']` — dev-only Next 16 affordance; no prod widening in diff. **PASS** |
| **Hard navigation** | `window.location.replace` for post-auth routing — full navigation; does not weaken httpOnly session cookies. Shell still uses `location.assign` for login on retry. **PASS** |
| **Secrets in diff** | `.env.example` scope comment only; no credentials printed. **PASS** |
| **OIDC scopes** | Default / example drops `offline_access` — reduces `not_allowed` misconfig; aligns with documented Keycloak constraint. **PASS** |
| **AbortSignal.timeout** | Server-side fetch timeouts — DoS/hang hardening, not auth bypass. **PASS** |

**Security verdict:** **PASS** (no exploitable regression identified in scope; residual risk = unproven signed-in nav surface).

## Verdict

| Gate | Verdict |
| --- | --- |
| DoD (tests, lint, honest WIP readiness) | **FAIL** |
| Security (scope diff) | **PASS** |
| **Overall (Wave C)** | **FAIL** |

**Rationale:** WIP does not pass portal `test` or `lint`. Browser evidence supports “spinner ends” for unauthenticated `/` and `/auth`, but CI blockers and missing signed-in nav proof prevent merge-ready acceptance. Fix `VI_TO_KEY` for `auth.error.notAllowed`, resolve eslint on `LoadingSurface`, re-run full portal checks, then add signed-in UAT for grouped sider before re-review on a committed SHA.

---

## Revalidation (2026-10-19 · James · dod+sec · `task_81cd0a1935a9`)

| Field | Value |
| --- | --- |
| **Reviewer / session** | James · dod+sec · `task_81cd0a1935a9` (independent reviewer; ≠ implementer Higo) |
| **Prior artifact** | This file — prior **FAIL** on `VI_TO_KEY` + `LoadingSurface` lint |
| **Commit SHA** | **WIP (uncommitted)** on base `52bc54e3fdcb7b757c893507db7917d80cee1f2c` (`git rev-parse HEAD`, branch `hangndat/d1-portal-nav-groups`) |
| **Diff scope** | `git diff HEAD --stat -- apps/portal` → 22 files, +294/−59 |

### Checks (revalidation)

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `pnpm --filter @ticket/portal test` | **PASS** — 128 tests, 0 fail (`VI_TO_KEY parity` green) |
| Lint | `pnpm --filter @ticket/portal lint` | **PASS** — `eslint . --max-warnings 0` (`LoadingSurface` no longer `setState` in effect) |
| Typecheck | `pnpm --filter @ticket/portal typecheck` | **PASS** |
| Browser (unauth `/`) | `orca tab create --url http://127.0.0.1:3013/` → `sleep 12` → `orca snapshot --page <id>` | **PASS** — no perpetual `aria-busy` loader; navigated to Keycloak `http://127.0.0.1:8080/realms/ticket/.../auth` with `scope=openid+profile+email` (no `offline_access`), a11y **Sign in to your account** / Email+Password |
| CSP (dev) | `curl -sI http://127.0.0.1:3013/ \| grep Content-Security-Policy` | **PASS** — `unsafe-eval` present in dev response; `next.config.ts` still gates `unsafe-eval` on `NODE_ENV === 'development'` only |

### Findings (revalidation)

| Sev | Area | Finding |
| --- | --- | --- |
| **Cleared** | CI / i18n | `auth.error.notAllowed` — `VI_TO_KEY` parity test passes. |
| **Cleared** | CI / lint | `LoadingSurface` simplified (static loader; `suppressHydrationWarning`); eslint clean. |
| **Cleared** | UX / auth flow | Unauthenticated `/` now **auto-redirects** to IdP (Keycloak login), addressing prior should-fix vs manual “Cần đăng nhập” only. |
| **Known gap** | Evidence | Still **no signed-in** browser proof of grouped sider (`nav.group.*`) on tenant/event routes — unchanged from prior review. |
| **Known gap** | Integration | Tree remains **uncommitted** on same base SHA; merge/CI on GitHub still needs a pushed commit. |

### Security revalidation

| Topic | Assessment |
| --- | --- |
| **CSP `unsafe-eval`** | Dev header includes `'unsafe-eval'`; production branch in `next.config.ts` unchanged (`script-src 'self' 'unsafe-inline'` only). **PASS** |
| **OIDC redirect** | PKCE authorize URL to local Keycloak; scopes in observed redirect exclude `offline_access`. **PASS** (no new exposure in diff) |

**Security verdict (revalidation):** **PASS**

### Verdict (revalidation)

| Gate | Verdict |
| --- | --- |
| DoD (prior blockers: test, lint, unauth spinner → login/IdP) | **PASS** |
| Security | **PASS** |
| **Overall (Wave C)** | **PASS with known gap** |

**Rationale:** Prior **blockers** (`VI_TO_KEY`, `LoadingSurface` eslint) are cleared with green portal `test`/`lint`/`typecheck`. Orca browser shows unauthenticated `/` reaches Keycloak login within ~12s (not stuck on portal loading or static “Cần đăng nhập” without redirect). Residual acceptance gaps: signed-in grouped-nav UAT and a **committed** SHA for PR/CI — document before calling pilot/merge-ready for full nav-groups slice.
