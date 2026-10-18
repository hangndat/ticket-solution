# DoD review — PR #100 (CSRF WEB_PUBLIC_ORIGIN + invite accept selfActor)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_d63041ba-3cbe-4d4f-afbd-0217d3d019d9`, task `task_a88702da0105`, dispatch `ctx_6ed0b5cb8063`) — ≠ implementer (PR author / tip commit `hangndat`) |
| Scope | PR #100 `hangndat/d5-web-csrf-invite`; Issue #6 residual. Paths: `apps/web/src/bff/origin.ts`, `apps/web/src/oidc/public-origin.ts`, `apps/web/src/oidc/cookies.ts`, `apps/web/tests/origin.test.ts`, `apps/api/src/platform.ts`, `apps/api/test/platform-self-actor.test.cjs` |
| Commit SHA | `ce5757d0e5f8a44a01960cd87aa59229a7655187` (confirmed `git rev-parse` + `gh pr view 100` + CI `headSha`) |
| Checks | Local: `pnpm exec tsx --test tests/origin.test.ts` → **11 pass**; `pnpm test` in `apps/api` → **15 pass** (incl. 3 selfActor). CI run `39013494874` on tip: `changes`/`backend`/`web`/`ci`/`turbo-persist` **success** |
| Verdict | **PASS with known gap** |

## Checklist (task scope)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Exact tip SHA under review | **PASS** | Single commit on PR: `ce5757d0e5f8a44a01960cd87aa59229a7655187` |
| 2 | CSRF prefers `WEB_PUBLIC_ORIGIN` | **PASS** | `resolvePublicOrigin` / `assertSameOrigin` allowlist via `webPublicOriginAllowlist`; bind URL (`127.0.0.1`/`0.0.0.0`) no longer fails public Origin when env set. Invite BFF `POST …/me/membership-invites/accept` uses `assertMutatingBrowserAsync` → `assertSameOrigin` |
| 3 | `/me/*` uses attendee OIDC (`createOidcVerifier`), not platform MFA | **PASS** | `PlatformService.selfActor` → `identityVerifier`; `buildPlatformDeps` wires `createOidcVerifier(readOidcEnvironment(env))` (env `OIDC_AUDIENCE` / ticket-api). `acceptInvite` / other self routes use `selfActor` |
| 4 | `/platform/*` still MFA | **PASS** | `platformActor` still `createPlatformOidcVerifier`; `me()` (`GET platform/me`) uses `platformActor`. Tests prove platform MFA path untouched |
| 5 | Tests cover CSRF + verifier split | **PASS** | `origin.test.ts` 11; `platform-self-actor.test.cjs` 3 (acceptInvite→identity, me→platform, missing identity fail-closed); full API suite 15 |
| 6 | No secrets / credentials | **PASS** | Diff secret-pattern scan clean; invite token not logged; no `.env` / real credentials in PR |

## Known gaps (non-blocking for this code fix)

1. **Prod UAT still open:** POST accept invite from `/invite` on live `vemoki.com` with `WEB_PUBLIC_ORIGIN` set after redeploy — not re-run in this review session (headless UAT / ops). Parent Issue #6 residual device/ops gates remain.
2. **Ops dependency:** Fix requires `WEB_PUBLIC_ORIGIN` configured in prod web env; without it, behavior falls back to X-Forwarded / bind URL (documented fail mode).
3. **Shared `selfActor`:** Tenant invite create / member revoke also use identity verifier (pre-existing `selfActor` call sites). Intentional — not a widening of platform MFA; platform routes stay on `platformActor`.

## Findings

No blocking security or correctness findings on tip SHA. CSRF allowlist when `WEB_PUBLIC_ORIGIN` is set rejects Origin not on allowlist even if `request.url` matches (anti-spoof). Platform MFA verifier is not relaxed for `/platform/*`.

## Verdict

**PASS with known gap** on exact SHA `ce5757d0e5f8a44a01960cd87aa59229a7655187`. Safe to merge for the CSRF + selfActor residual; revalidate after prod redeploy + invite UAT, and if tip SHA gains further behavior.
