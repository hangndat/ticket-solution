# Issue #612 — Root cause: Tài khoản “Không tải được hồ sơ” (`u1@gmail.com`)

| Trường | Giá trị |
| --- | --- |
| Issue | [#612](https://github.com/hangndat/ticket-solution/issues/612) |
| Investigator | Orca worker `task_6b38ea3b879b` (read-only logs/DB/Keycloak; no code/data mutation) |
| Date (UTC) | 2026-10-20 / investigation continue into 2026-10-21 Asia/Shanghai |
| Verdict | **Root cause identified** — not single-user provisioning; systemic mobile access-token expiry + no refresh |

## Executive summary

User `u1@gmail.com` exists and is healthy in Keycloak and Postgres. `GET /v1/me` succeeds when the bearer is valid (last successful upsert ~`2026-10-20 15:59:19Z`). Around the time the Issue was filed (`16:07Z`), the same iOS client (`Vemoki/26`) received **`401`** on exact `GET /v1/me` with response size **132** bytes — matching backend message **`Invalid or expired token`**. Keycloak realm `ticket` sets **`accessTokenLifespan = 300` (5 minutes)**. Mobile login returns a `refreshToken` but **only persists `accessToken`** into SecureStore and Account `refreshMe` reuses that credential without refresh — so after ~5 minutes `/v1/me` 401s and the UI collapses every non-200 into “Không tải được hồ sơ”.

## Evidence

### 1) API container logs (`vemoki-api-1`)

- `docker logs … \| grep -iE 'u1@gmail\|/v1/me'` only hits Nest **route mapping** at process start (no per-request access log with email/path/status).
- Dominant structured JSON noise: `account_deletion_tombstone_keyring_missing` with `live_tombstone_keys: 0` (ops alert; **does not** deny upsert when zero live keys — see `assertIdentityAllowedForUpsert`).

**Implication:** request-level evidence must come from nginx (or a future structured access logger), not API app logs.

### 2) Nginx access log (`nginx-letencrypt-nginx-1`) — exact `GET /v1/me`

Status histogram (last ~7d, exact path only): **~176×200**, **~192×401**, **1×499**. No 5xx observed on exact `/v1/me`.

iOS client IP `38.77.153.226` (`Vemoki/26 CFNetwork…`) near Issue time:

| UTC time | Status | Bytes | Notes |
| --- | --- | --- | --- |
| 15:59:10–15:59:19 | 200 | 191 | Matches `users.updated_at` upsert |
| 16:02:28 | **401** | **132** | |
| 16:02:54 | **401** | **132** | |
| Issue #612 created | 16:07:32Z | — | ~5 min after 401s |

Same client shows the pattern all day: 200 ↔ 401 interleaved (e.g. 15:16 401 → 15:17 200; 15:31 401 → 15:40 200).

Serialized `ApiError` body length check (fixed UUID placeholder):

| Message | Length |
| --- | --- |
| `Invalid or expired token` | **132** |
| `Bearer token required` | 129 |
| `Account deletion in progress` | 136 |

→ Observed **401 + 132** ≡ OIDC verify failure path in `packages/backend/src/oidc.ts` (`jwtVerify` catch → `UNAUTHENTICATED` / “Invalid or expired token”).

### 3) Postgres (READ-ONLY)

DB: `ticket_solution` / role `ticket_owner`.

| Check | Result |
| --- | --- |
| `users` by email `u1@gmail.com` | **1 row** — id `a4e2c353-41dd-4251-98b0-dfa1373c0baa`, issuer `https://auth.vemoki.com/realms/ticket`, subject prefix `33fe5010-53d…`, `email_verified = true`, created `2026-10-19 16:14:50Z`, **updated `2026-10-20 15:59:19Z`** |
| `memberships` for that user | **0** (expected for attendee-only; **`GET /v1/me` does not require membership**) |
| `account_deletion_open_for_identity(issuer, subject)` | **false** |

### 4) Keycloak (`auth.vemoki.com` / realm `ticket`)

`kcadm get users -r ticket -q email=u1@gmail.com`:

| Field | Value |
| --- | --- |
| id | `33fe5010-53d5-4076-8f37-6d7f37c010a8` (matches DB subject) |
| enabled | **true** |
| emailVerified | **true** |
| requiredActions | `[]` |

Realm token policy:

| Setting | Value |
| --- | --- |
| `accessTokenLifespan` | **300** seconds |
| `ssoSessionIdleTimeout` | 1800 |
| `ssoSessionMaxLifespan` | 36000 |
| Client `ticket-mobile` | public, standard flow, no direct grants |

### 5) Client / code path (worktree source — no fix applied)

- `apps/mobile/src/screens/account.tsx`: `onSignIn` → `session.establish(result.accessToken, verifyViaMe)` — **`result.refreshToken` discarded**.
- `refreshMe` → `session.getCredential()` → `fetchMe(token)` with no refresh-on-401 / no proactive refresh.
- `apps/mobile/src/identity/fetch-me.ts`: `probeMe` maps 401/403 → `unauthorized`; `fetchMe` returns `null` for any non-ok → Account UI shows the vague “Không tải được hồ sơ…” copy.
- Backend `IdentityService.me`: verify bearer → `upsertFromVerifiedIdentity` — no membership join; healthy user + valid token ⇒ 200.

## Root cause classification

| Hypothesis from Issue | Finding |
| --- | --- |
| JWT/Keycloak broken for this user only | **Rejected** — KC user enabled + verified; `/v1/me` 200 minutes earlier for same device IP |
| Missing DB provision / seed | **Rejected** — user row present + recently upserted |
| Network / 8s timeout | **Unlikely primary** — nginx shows hard **401**, not missing requests; one 499 earlier is client abort, not the Issue window |
| Backend 5xx on `/v1/me` | **Rejected** — no 5xx on exact path in sampled window |
| **Expired access token reused without refresh** | **Confirmed** — AT TTL 300s + mobile stores only AT + 401 body “Invalid or expired token” + Issue timing |

**Scope:** Systemic for **any** mobile session that stays open past access-token TTL (not unique data corruption for `u1@gmail.com`). Symptom surfaces on Account because `refreshMe` always re-probes `/v1/me` with the stored bearer.

**Related ops noise (not causal here):** tombstone keyring missing alerts with `live_tombstone_keys: 0` — separate infra hardening; would only hard-deny when live tombstones exist without keys.

## Recommended next steps (coordinator → fix task; do **not** mutate prod data for this user)

1. **Mobile identity fix (primary):** persist refresh token securely; before `/v1/me` (or on 401 from `probeMe`), run OAuth refresh grant, rotate SecureStore credential, retry once; only then surface “đăng nhập lại”.
2. **UX clarity (secondary):** map `probeMe` `unauthorized` to a distinct Account copy (“phiên hết hạn / đăng nhập lại”) vs network `unreachable`.
3. **Optional mitigation:** lengthen Keycloak `accessTokenLifespan` alone is **insufficient** without refresh; keep TTL short if refresh is implemented.
4. **Observability:** add sanitized request logs for `/v1/me` failures (status + error `code`, no token/email) so future incidents do not require nginx archaeology.
5. **Data:** no production UPDATE/DELETE needed for `u1@gmail.com`.
6. **Repro:** optional device repro after fix; **not required** to confirm root cause given nginx+DB+KC evidence above. Do not log in as the user without explicit approval.

## Commands used (reference)

```bash
ssh conanphong "docker logs vemoki-api-1 --since 6h 2>&1 | grep -iE 'u1@gmail|/v1/me' | tail -200"
ssh conanphong 'docker logs nginx-letencrypt-nginx-1 --since 48h 2>&1 | grep -E "\"GET /v1/me HTTP"'
# READ-ONLY SQL (credentials from container env; not repeated here)
# SELECT id, issuer, subject, email, email_verified, created_at, updated_at FROM users WHERE lower(email)=lower('u1@gmail.com');
# Keycloak: kcadm get users -r ticket -q email=u1@gmail.com
# Keycloak: kcadm get realms/ticket --fields accessTokenLifespan,…
```

## Limitations

- Nginx cannot attribute a request to email; correlation uses DB `updated_at` ↔ 200 window and Issue timestamp ↔ 401 window on the dominant iOS client IP.
- Did **not** reproduce by logging in as the production user (per task safety).
- Exact JWT `exp` claim for the failed requests is not in logs (by design).
