# D11 / Issue #271 — Web invite HTTP/UI revalidation (O14)

**Role:** `web` · `docs/agents/roles/web.md`  
**Architecture impact:** Không  
**Exact HEAD (branch tip at evidence):** `beb822ff016c81f9643813df53d20d7c8aaec0fe`  
**Base reproduce SHA:** `39ecbd01266ccb9990d3f1b41c6f8b53685fb4f8` (main at dispatch)  
**Parent:** Epic #222 → Story #272 → Task #271

## Verdict (implementer)

**PASS with known gap** — CSRF Origin fail-closed + Vietnamese fail-closed copy + real Keycloak session Owner accept via HTTP/UI proven on isolated web `:3010` + Nest `:3272` + task Postgres `:55771`. Screenshot/token not logged.

Known gap (env, not product AC miss): shared Keycloak issues JWT `iss` as LAN host (`http://192.168.86.8:8080/realms/ticket`); isolated API must set `OIDC_ISSUER`/`OIDC_JWKS_URL` to that issuer for verification. Documented for local UAT only — not a web contract change.

## Reproduce on main tip (before fix)

On `39ecbd0`:

1. `/invite` did not bootstrap CSRF cookie (unlike Admin `/me/tenants`) → first accept often `CSRF_TOKEN_INVALID` / Origin mismatch path (D4 known gap).
2. Rejected accept showed raw `viewLabel` English `CODE: message` — not VI SurfaceState for expiry / used / wrong account / CSRF.
3. Email links may use `?token=` while UI preferred `#fragment` only — query not parked/stripped.

## Changes (`apps/web` only)

| Path | Why |
| --- | --- |
| `app/invite/invite-accept.tsx` | CSRF bootstrap via GET `/api/bff/me/tenants`; park `?token=`/`#token` into sessionStorage and strip URL; VI SurfaceState; login `return=/invite` |
| `src/platform/invite-messages.ts` | VI map for invite + CSRF codes (fail-closed, no success claim) |
| `tests/invite-messages.test.ts` | Unit map INVITE_* / CSRF / network |
| `tests/invite-csrf.test.ts` | Origin/CSRF guard for accept path |
| `tests/invite-http-uat.mjs` | Headless Playwright UAT (token via env/file only) |
| `tests/routes.integration.mjs` | Invite accept Origin missing + evil Origin fail-closed |

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web exec tsx --test tests/invite-messages.test.ts tests/invite-csrf.test.ts
# → 12 pass

# Isolated stack (this worker): web :3010, API :3272, Postgres :55771, shared Keycloak :8080
WEB_UAT_EXECUTABLE=…/chromium_headless_shell-1248/.../chrome-headless-shell \
KEYCLOAK_PUBLIC_HOST=127.0.0.1 \
WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
WEB_UAT_INVITE_TOKEN_FILE=/tmp/invite271-invite-token.txt \
node apps/web/tests/invite-http-uat.mjs http://127.0.0.1:3010
```

UAT JSON summary (token redacted; fixture local):

- `csrf.evilCode=CSRF_ORIGIN_MISMATCH`, `csrf.missingCode=CSRF_ORIGIN_REQUIRED`
- `tokenLeakedInUrl=false`, `afterParkUrl=…/invite`
- `acceptOk=true` — VI success: membership + tenant ACTIVE (Owner invite for `attendee@example.com`)
- Screenshot under `apps/web/.uat-artifacts/invite-http-*.png` (gitignored; no token in URL)

Seed invite: task-local Nest + Postgres via `provisionTenant` (Owner email `attendee@example.com`) — **not** SQL `accept_membership_invite` bypass.

## AC map

| AC | Result |
| --- | --- |
| Valid invite accept HTTP/UI real auth session | **PASS** — Keycloak session + BFF accept → ACTIVE membership |
| Sai/hết hạn/đã dùng/sai account copy VI fail-closed | **PASS** — unit + UAT SurfaceState VI; mock fulfill path for invalid when needed |
| CSRF Origin negative fail-closed | **PASS** — unit + HTTP + UAT |
| No token/PII in log/screenshot/CLI argv | **PASS** — token file/env only; URL stripped |
| No SQL bypass / no mock auth production / no BE-contract edit | **PASS** |

## Limitations

- `routes.integration.mjs` full suite expects OIDC unset; local `.env.local` for UAT makes that assertion fail if run with OIDC configured — invite CSRF assertions added; prefer unit `invite-csrf` + UAT for this Task.
- Do not reuse worker #236 stack / ports.
- No deploy / cloud build / real customer email.

## Cleanup (worker)

Stop task-owned: Next `:3010`, Nest `:3272`, compose `d11-invite-271` postgres/redis when settled.
