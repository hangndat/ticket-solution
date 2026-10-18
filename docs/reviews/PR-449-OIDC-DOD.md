# DoD review — PR #449 OIDC B1–B4 revalidation

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca `term_b79a2c8d-a745-4829-b71d-daf2be126894` · dispatch `ctx_61b9e9193d18` · task `task_7f03b112fe0e` · Role `reviewer-dod` (Cursor ≠ implementer `ctx_8d01c264eb4f` / `term_5d26a40a`) |
| Scope | Issue #416 · PR #449 · `apps/portal/**` · Epic #406 |
| Commit SHA | `b6fceab05468a7692f17972aa66217d9749a3480` |
| Prior FAIL SHA | `59b5440b2f1da53093a99cd00b8f057732e7ae95` (DoD FAIL + security FAIL: nonce/JWT/Host fallback/refresh concurrency) |
| Architecture | ADR-20 OIDC/session correctness — Architecture impact: Có |
| Decision IDs | ADR-20 · PLATFORM-PORTAL-ZONE · GATE-STAY-APP |
| Verdict | **PASS with known gap** |
| Date | 2026-10-18 |

## Checklist B1–B4

| # | Yêu cầu | Kết quả |
| --- | --- | --- |
| B1 | OIDC nonce + jose/JWKS claim checks (iss/aud/nonce/azp/ACR/auth_time) | **PASS** |
| B2 | `publicOrigin` 503, không Host fallback khi origin misconfigured | **PASS** |
| B3 | Refresh single-flight / coalescing + verify-before-set | **PASS** |
| B4 | Tests + `docs/reviews/pr449-refresh-singleflight-limits.md` | **PASS** |

### B1 — evidence

- Staff/platform login: `generateOidcNonce()`, cookie HttpOnly ngắn hạn (`portal_oidc_nonce` / `platform_oidc_nonce`), authorize Location có `nonce=` (+ platform `acr_values`).
- Callbacks require nonce cookie; `acceptOidcTokenGrant` → `jose.jwtVerify` (RS256/ES256) + JWKS remote; id_token: iss/aud/nonce/azp(multi-aud)/sub; access: iss/aud/bounds/azp; platform access: exact ACR + `auth_time` max age (default 900s).
- `forwardPlatformBearer` re-verifies access JWT (aud/ACR/auth_time) trước khi forward; fail → clear platform jar.
- Unit: `tests/verify-tokens.test.ts` (accept grant, wrong nonce/iss/aud/sig/expired/subject, platform ACR/auth_time, multi-aud azp).

### B2 — evidence

- `requirePublicOrigin` → 503 `ORIGIN_NOT_CONFIGURED` khi `resolvePublicOrigin` null; message từ chối Host fallback.
- Staff + platform callbacks/logout paths dùng helper; không còn `?? new URL(request.url).origin`.
- Unit: `requirePublicOrigin returns 503 when production origin unresolved`; dev loopback vẫn resolve khi allowlist trống.

### B3 — evidence

- `singleFlightStaffRefresh` keyed `SHA-256(issuer\0clientId\0refreshToken)`; parallel waiters share one IdP exchange; mỗi waiter `applyStaffGrant` riêng (không clear winner mid-flight).
- `performStaffRefreshFlight` → `acceptOidcTokenGrant` (verify-before-set); failure → clear staff jar + flight cache.
- Unit: parallel one-exchange / failure cache / subject mismatch / key isolation.

### B4 — evidence

- `docs/reviews/pr449-refresh-singleflight-limits.md` ghi rõ **không** distributed-safe.
- New/updated tests: `verify-tokens.test.ts`, `refresh-flight.test.ts`, `oidc-config.test.ts` (audience+jwks fail-closed).

## Checks trên exact SHA

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `b6fceab05468a7692f17972aa66217d9749a3480` |
| Diff tip vs prior FAIL | `59b5440..b6fceab` — portal OIDC verify/origin/refresh + tests + limits doc (+ jose pin `f21dc1e`) |
| `pnpm --filter @ticket/portal test` (workspace: `cd apps/portal && pnpm test`) | **25/25 pass** |
| CI commit `b6fceab…` | **portal / web / backend / mobile / changes / ci / turbo-persist = success** (database-isolation & d5-* skipped) — run gắn PR #449 tip |

## Findings

### Blockers

Không còn blocker B1–B4 từ FAIL @ `59b5440`.

### Known gaps (không nuốt security gate B1–B3)

1. **Refresh single-flight per-process only** — documented in `pr449-refresh-singleflight-limits.md`. Multi-replica vẫn có thể race IdP rotation. Chấp nhận cho foundation; **không** tuyên bố distributed safety / production horizontal scale.
2. **Live Keycloak realm UAT** — không chạy lại HTTP authorize/callback trên realm thật trong session này; deferred Issue #439. Unit JWKS local + CI portal job đủ cho revalidation fix.
3. **Foundation scope** — chưa production/pilot certified; mutating portal BFF CSRF attach vẫn ngoài AC hẹp #416 nếu chưa có route POST.

### Nits / should-fix (không chặn)

- `verifyIdToken` so sánh nonce thủ công sau `jwtVerify` (không truyền `nonce` vào jose options) — tương đương fail-closed.
- Platform zone chưa có refresh single-flight path (platform BFF verify-only, không rotate) — ngoài B4 staff coalescing.

## Architecture (ADR-20)

Implementation khớp hướng fail-closed OIDC/session: verify trước persist cookie, origin redirects không tin Host khi misconfigured, refresh coalescing trong process. Design drift đáng kể: **không**. Gap multi-instance đã ghi nhận có chủ đích — không cần architect re-open trừ khi scale multi-replica trước khi có shared lock.

## Verdict

**PASS with known gap** trên exact SHA `b6fceab05468a7692f17972aa66217d9749a3480`.

Coordinator có thể merge sau security revalidation độc lập (nếu còn mở) + CI xanh đã xác nhận. Không tuyên bố pilot/production.
