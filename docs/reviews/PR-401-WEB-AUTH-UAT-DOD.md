# DoD review — PR #401 (web apex/admin host order + logout UAT)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` (+ OIDC security mindset) · terminal `term_93625a16-a2b0-4d34-90cc-cf4e0acb0723` · task `task_72a6985e609b` · dispatch `ctx_833aa3d38a2b` (≠ implementer) |
| Scope | PR [#401](https://github.com/hangndat/ticket-solution/pull/401) · branch `hangndat/d13-bug-web-auth-uat` · `apps/web/proxy.ts`, `apps/web/app/api/auth/{callback,logout}/route.ts`, `apps/web/src/oidc/cookies.ts`, `apps/web/tests/marketing-host.test.ts`, `scripts/web-uat.mjs`, `docs/reviews/d13-bug-web-auth-uat.md` |
| Commit SHA reviewed | `95e01d6ab431d898141bb5fadbc4dd957c578168` (tip; confirmed `gh pr view 401 --json headRefOid`) |
| Behavioral SHA | `bd12f844f92521c24bc4f2b7ecdad44cf0f1aabf` (proxy/logout/UAT); tip is docs SHA cite only |
| Architecture impact | Không (fix order + logout hint + UAT harness) |
| Decision IDs | O13 host split · O02 soft-redirect `/admin`\|`/gate` (product surface only, after host routing) |
| Verdict | **PASS with known gap** |

## Checks (on tip SHA)

| Check | Result |
| --- | --- |
| CI [39130869222](https://github.com/hangndat/ticket-solution/actions/runs/39130869222) | **changes** SUCCESS · **web** SUCCESS · **ci** SUCCESS · **turbo-persist** SUCCESS · other jobs SKIPPED |
| `node --import tsx --test tests/marketing-host.test.ts` @ `95e01d6…` | **13 pass / 0 fail** (includes apex `/admin`\|`/gate` → `https://app.vemoki.com…`) |
| Live prod (pre-deploy tip) | `https://vemoki.com/admin` → **307** `/auth?next=%2Fadmin` (relative) — confirms bug still live until web deploy |
| Live logout URI | BFF emits `post_logout_redirect_uri=https://app.vemoki.com/auth`; KC accepts → 302 `app./auth` (ops #397 already live) |
| Implementer UAT artifact | `docs/reviews/d13-bug-web-auth-uat.md` — auth-smoke / bff-login / auth-logout / nav-o02 against `app.vemoki.com` |

## Correctness vs AC

1. **Proxy order** — `decideHostRouting` (O13 apex product paths → absolute `PRODUCT_ORIGIN`) runs **before** O02 anonymous soft-redirect. Soft-redirect remains product-host-only for `/admin`\|`/gate` without access cookie.
2. **Unit coverage** — new assert: apex `/admin` and `/gate` → `https://app.vemoki.com${pathname}` status 302.
3. **`id_token` + logout** — callback stores `oidc_id_token` with same HttpOnly / SameSite=lax / `AUTH_COOKIE_SECURE` options as access; logout reads hint **before** `clearSessionCookies`, passes `id_token_hint` to KC end-session; `post_logout_redirect_uri` fixed to `{publicOrigin}/auth` (no open redirect).
4. **UAT harness** — `scripts/web-uat.mjs auth-logout` login → `/me` → logout → land `/auth`, detects Invalid redirect uri, probes post-logout `/admin` gate; switch has proper `break` (no fallthrough).

## Security (OIDC)

| Gate | Assessment |
| --- | --- |
| Cookie flags | `oidc_id_token` HttpOnly + SameSite=lax + secure when configured — OK |
| `id_token_hint` in redirect URL | Standard RP-initiated logout; short-lived in browser history — accepted tradeoff |
| Soft-redirect | Cookie **presence** only (pre-existing) — UI hide ≠ authz; API fail-closed still required |
| Host routing | Absolute product origin; no user-controlled Location |

No new OIDC blocker found on tip SHA.

## Findings

| Severity | Finding |
| --- | --- |
| known gap | **Prod web not yet on tip** — live apex `/admin` still soft-redirects relative `/auth` first; silent logout (`id_token_hint`) not live (Set-Cookie clear list still lacks `oidc_id_token`). Deploy web to close. |
| known gap (out of slice) | Platform logout `/api/auth/platform/logout` still cookie-clear only (no KC end-session) — pre-existing; track if product requires parity. |
| nit | Soft-redirect treats any non-empty access cookie as “signed in” — pre-existing; not introduced here. |
| — | No merge blocker for code+CI+unit evidence on tip. |

## O02 / PD §6.1

Chrome permission gates (D-O02 / dual-persona nav) **not** claimed by this PR — only soft-redirect order vs O13 host routing. `nav-o02` UAT cited by implementer for soft-redirect smoke; full O02 chrome DoD remains separate Issues #368–#371.

## Limitations

- Headless `auth-logout` against tip code **after deploy** not re-run by this reviewer (prod still on older web). Unit + CI + source review + live pre-deploy contrast used for verdict.
- Reviewer did not merge.

## Merge note

**Coordinator may merge** PR #401; schedule **web deploy** then re-probe apex `/admin` → `https://app.vemoki.com/admin` (302) and logout with `id_token_hint` (no KC confirm). Revalidate if tip SHA gains new behavior.
