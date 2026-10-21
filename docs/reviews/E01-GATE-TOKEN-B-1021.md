# E01 root cause B — access cookie 401 ngay sau login (SSR)

| Trường | Giá trị |
| --- | --- |
| Issue | [#1021](https://github.com/hangndat/ticket-solution/issues/1021) |
| Symptom | `require_session_access_ok` → API `UNAUTHENTICATED` ~4ms → `/api/auth/refresh` ↔ `/gate` loop |

## Root cause

1. **JWT `aud` không khớp API** — SSR chỉ kiểm tra `exp` (`isAccessTokenStaleForSsr`), không kiểm tra `aud=ticket-api` như Nest `identityVerifier`. Access token sau authorization code có thể thiếu audience mapper (prod realm cũ / authorize không gửi `audience`) trong khi refresh grant trả token hợp lệ → BFF Route Handler che lỗi qua retry.
2. **Vòng refresh SSR** — `redirectForSsrSessionRenewal` (stale/missing) không tôn `vemoki_ssr_refresh_attempt`, khác `redirectForSsrDiscovery401` → có thể lặp `/api/auth/refresh` khi cookie access không được cập nhật sau redirect.

## Fix (web)

- `GET /api/auth/login`: `audience=<OIDC_AUDIENCE>` trên authorize URL (`buildWebAuthorizeUrl`).
- `exchangeRefresh`: gửi `audience` trên refresh grant.
- `requireSessionOrAuth`: fail-closed nếu decode `aud` không có `ticket-api` → một lần refresh route, sau đó `/auth`.
- `redirectForSsrSessionRenewal` dùng cùng guard một lần refresh như discovery 401.

## Realm prod (ops, không ssh tự động)

Đảm bảo client `ticket-web` có protocol mapper `oidc-audience-mapper` với `included.client.audience=ticket-api` và `access.token.claim=true` (đã có trong `infra/keycloak/realm-ticket.prod.json`). Import realm hoặc thêm mapper thủ công nếu prod lệch export.

## Claim evidence (local KC, không secret)

Password grant `ticket-web` → access payload: `aud: "ticket-api"`, `azp: "ticket-web"`, `iss: http://127.0.0.1:8080/realms/ticket`. Refresh grant cùng `aud`. API verify: `OIDC_AUDIENCE=ticket-api`, `issuer` + `audience` qua jose (`packages/backend/src/oidc.ts`).
