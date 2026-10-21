# E01 — `/gate` SSR loading ~12s (trace + root cause)

| Trường | Giá trị |
| --- | --- |
| Issue | [#1021](https://github.com/hangndat/ticket-solution/issues/1021) |
| UAT | `docs/reviews/UAT-PROD-WEB-2026-10-21.md` retest 8 @ `0add1f6` (#682) — 5× `goto /gate` **12.2–12.4s** vẫn `app/loading.tsx` |
| Implementer | Higo · web · `task_8ed71eced1eb` |

## Root cause (ranked)

1. **SSR suspense on `GatePage`** — `app/loading.tsx` hiển thị tới khi RSC hoàn tất `requireSessionOrAuth` + `requireGateCapabilityOrHome` (`staff-route-guard.ts`). Không phải client `GateForm` / `SiteNav` effect.
2. **Access cookie còn nhưng JWT hết hạn** — PR #682 chỉ `refreshWebAccessToken()` khi **không** có access cookie. Phiên staff sau ~5 phút: cookie còn → guard bỏ qua refresh → `forwardWithBearer` gọi Nest với Bearer hết hạn → **401 → refresh → fetch lại** với `STAFF_DISCOVERY_TIMEOUT_MS` **8s** mỗi lần. UAT: retest 7 **>20s** (timeout 15s + retry); retest 8 **~12s** sau giảm timeout 8s — khớp **hai bước upstream tuần tự** (401 retry), không khớp client `fetch /api/bff/me/events` 200 nhanh (cùng token đã refresh trên tab).
3. **502/503 transient** (#682) chỉ áp dụng khi upstream trả 502/503; nhánh 401-retry vẫn chờ tối đa **2×8s** trước khi render shell.

## Root cause A — cookie refresh trong RSC (prod trace)

`forwardWithBearer` trên nhánh 401 gọi `refreshWebAccessToken` → `cookies().set` trong **Server Component** (`/gate` guards). Next.js ném *Cookies can only be modified in a Server Action or Route Handler* → trang lỗi/kẹt. BFF `/api/bff/me/events` cùng helper nhưng chạy **Route Handler** → refresh hợp lệ → client thấy 200.

**Fix:** SSR discovery `allowCookieRefresh: false`; session renew qua `GET /api/auth/refresh?next=…` (Route Handler). Discovery 401 → refresh route một lần (`vemoki_ssr_refresh_attempt`), sau đó `/auth`.

## Root cause B — 401 nhanh dù `require_session_access_ok`

SSR và BFF dùng cùng cookie `oidc_access_token`, cùng `Authorization: Bearer`, cùng path `PLATFORM_PATHS.meEvents` (`/v1/me/events`), cùng `API_BASE_URL` — không khác header X-Forwarded/host trên forward. Khác biệt quan sát được: BFF **retry sau refresh** trong Route Handler; SSR trước fix **throw** trước khi retry. Token vẫn pass `isAccessTokenStaleForSsr` (exp + 30s skew, **không verify chữ ký**) nhưng API `identityVerifier` từ chối ngay (~16ms) — thường JWT hết hạn thật trên server, audience/issuer, hoặc access đã invalid dù cookie còn.

**Trace phụ (đã có khi `GATE_SSR_TRACE=1`):** bước `forward_upstream_401_detail_*` ghi `WWW-Authenticate` + `code`/`error` JSON từ API (không token).

## Fix (minimal)

- `requireSessionOrAuth`: stale/missing → redirect `/api/auth/refresh?next=…` (không gọi refresh trong RSC).
- `forwardWithBearer` + staff guards: `allowCookieRefresh: false` trên SSR discovery.
- `GATE_SSR_TRACE=1`: log bước + ms (`gate-ssr-trace.ts`) trên gate guards, `forwardWithBearer`, `refreshWebAccessToken`.

## Bật trace prod (compose)

Trên service **web** (không ghi secret):

```yaml
environment:
  GATE_SSR_TRACE: "1"
```

Xem log container web: `docker compose logs -f web` — dòng `[gate-ssr-trace] gate_page …`. Tắt khi xong: bỏ biến hoặc `0`.

## Local repro (production server)

```bash
# API + Keycloak (compose local), sau đó:
pnpm --filter @ticket/web build
GATE_SSR_TRACE=1 API_BASE_URL=http://127.0.0.1:3001 pnpm --filter @ticket/web exec next start -p 3000
# Đăng nhập staff → /gate; tắt API để thấy timeout 8s + trace `forward_upstream_status_502`
```
