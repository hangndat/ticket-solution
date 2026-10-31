# D9 demo dataset (fixture) — multi-tenant

**Issue:** #136 (T1) → Story #135 → Epic #134  
**Marker:** chỉ **event.name** giữ chuỗi `· Demo` (vd. `MFest · Demo`). Tenant org name, venue, source/ticket labels, và marketing FAQ/terms **không** gắn `· Demo` / `(fixture)` — UI trông production-like; marker chỉ trên tên sự kiện.

## Mục tiêu

≥2 tenant demo với event PUBLISHED, mã redeem, quota, staff membership + event assignment — đủ UAT demo (web/iOS/API) mà không lẫn dữ liệu thật.

## Stable fixture IDs

| Entity | Slug / label | UUID (ổn định) |
| --- | --- | --- |
| Tenant A | `mfest-demo` / name `MFest` | `d9d9f001-0001-4000-8000-000000000001` |
| Tenant B | `demo-studio` / name `Studio Organization` | `d9d9f001-0001-4000-8000-000000000002` |
| Event A | `mfest` @ mfest-demo — name `MFest · Demo` | `d9d9f001-0002-4000-8000-000000000001` |
| Event B | `studio-night` @ demo-studio — name `Studio Night · Demo` | `d9d9f001-0002-4000-8000-000000000002` |
| Ticket type A | General (mfest-demo) | `d9d9f001-0003-4000-8000-000000000001` |
| Ticket type B | General (demo-studio) | `d9d9f001-0003-4000-8000-000000000002` |
| Source A | VIP Pass | `d9d9f001-0004-4000-8000-000000000001` |
| Source B | General Admission | `d9d9f001-0004-4000-8000-000000000002` |
| Quota EVENT A | — | `d9d9f001-0005-4000-8000-000000000001` |
| Quota TYPE A | — | `d9d9f001-0005-4000-8000-000000000011` |
| Quota SOURCE A | — | `d9d9f001-0005-4000-8000-000000000021` |
| Quota EVENT B | — | `d9d9f001-0005-4000-8000-000000000002` |
| Quota TYPE B | — | `d9d9f001-0005-4000-8000-000000000012` |
| Quota SOURCE B | — | `d9d9f001-0005-4000-8000-000000000022` |

Venue (UI): `Bến Bạch Đằng, TP. Hồ Chí Minh` (MFest); `The Factory Contemporary Arts Centre, TP. Hồ Chí Minh` (Studio Night).

Slug cặp **khớp** catalog fixture iOS (`apps/mobile/src/data/demo-events.ts`: `mfest-demo` / `demo-studio`). Web marketing fixtures (`mfest` / `northline`) là catalog tĩnh riêng — không ghi đè bởi seed này.

## Roles & identities (Keycloak realm demo)

| Role | Email (realm import) | Password (local only) | Scope |
| --- | --- | --- | --- |
| Owner + event ops | `staff@example.com` | `staff-demo` | Membership Owner trên **cả hai** tenant; event assignment với quyền Owner-event |
| Attendee | `attendee@example.com` | `attendee-demo` | Không membership — redeem mã → My Tickets |

Issuer lấy từ `OIDC_ISSUER` (phải khớp Keycloak discovery). Seed gắn membership cho **mọi** `users` row cùng email (hỗ trợ issuer `127.0.0.1` và LAN IP).

## Inventory (plaintext codes — fixture only)

Pepper: `CODE_HMAC_PEPPER` (local placeholder). Codes lưu HMAC only. Plaintext codes vẫn dùng tiền tố `DEMO-*` (nội bộ / redeem UAT) — **không** surface trong marketing FAQ.

| Tenant | Event | Quota EVENT | Codes (uppercase) |
| --- | --- | --- | --- |
| mfest-demo | mfest | 50 | `DEMO-MFEST-001` … `DEMO-MFEST-010` |
| demo-studio | studio-night | 50 | `DEMO-STUDIO-001` … `DEMO-STUDIO-010` |

**Attendee UAT (wallet):** đăng nhập `attendee@example.com` / `attendee-demo`, đổi mã **`DEMO-MFEST-001`** (tenant `mfest-demo`, event `mfest`). Published terms version **`terms-v1`** — redeem API phải gửi `termsVersion: "terms-v1"` và `termsAccepted: true` (cùng phiên bản như `GET /v1/public/tenants/mfest-demo/events/mfest` → `terms.version`). Thiếu consent → `TERMS_REQUIRED`.

```json
{
  "code": "DEMO-MFEST-001",
  "termsVersion": "terms-v1",
  "termsAccepted": true,
  "idempotencyKey": "<uuid>"
}
```

Studio Night dùng `DEMO-STUDIO-001` với cùng `terms-v1` trên event `studio-night`.

## Idempotency

- Upsert tenant/event theo **stable UUID + slug** (name / venue / brand snapshot luôn cập nhật trên re-seed).
- Inventory: insert-or-skip theo fixed type/source/quota IDs; `issuance_sources.name` **UPDATE** trên conflict; codes insert-or-skip theo HMAC.
- Membership / assignment: skip nếu đã active **và** bộ quyền khớp `role-map` Owner. Re-seed **sửa** assignment cũ thiếu `report.read` (và các grant Owner-event khác). Cùng email `staff@example.com` còn được reconcile trên mọi tenant Owner/Manager ngoài D9 (UAT catalog Aurora Night Org) — Issue #880.
- Prod migrate: `202610280002_demo_staff_report_read` cùng phạm vi email (không SQL tay theo tenant UUID). Operator `hangndat+{org}-{role}@gmail.com`: re-run `./scripts/prod-seed.sh` với `PROD_SEED_CONFIRM=1` (assignment cũ không còn skip câm).
- **Marketing config:** lần đầu seed → save + publish. Re-seed mặc định **skip** nếu `published_config_version` đã có (tránh bump version vô ích). Nếu bản publish cũ **thiếu** section terms / `terms-v1`, seed tự **upgrade** (save + publish một lần). Sau khi đổi copy marketing seed, **phải force republish** (xem dưới).

## Commands

```bash
# Requires migrated DATABASE_URL + CODE_HMAC_PEPPER
./scripts/d9-demo-seed.sh
./scripts/d9-demo-seed.sh   # second run must be safe (marketing skip nếu đã publish)

# Sau khi cập nhật DEMO_MARKETING / venue / FAQ trong demo-seed.ts — bắt buộc trên DB đã seed:
D9_DEMO_FORCE_MARKETING=1 ./scripts/d9-demo-seed.sh

# API smoke (login / me/tenants / redeem / me/tickets + public catalog)
./scripts/d9-demo-seed-smoke.sh
```

### Local web UAT — catalog API (`ticket_d9_demo` @ `:55432`)

Guest home và event detail gọi `GET /v1/public/events` và `GET /v1/public/tenants/:tenant/events/:event`. API **runtime** phải là login `d9_demo_rt` (hoặc role tương đương) có **cả hai** membership: `ticket_runtime` **và** `ticket_platform_runtime` — thiếu platform role → `SET LOCAL ROLE ticket_platform_runtime` → 500 `permission denied for table events`.

**DB mới (khuyến nghị):** smoke bootstrap tạo DB + role đúng:

```bash
# In ra runtimeUrl (password ngẫu nội bộ) — dùng cho DATABASE_URL khi chạy API
node scripts/lib/d9-demo-bootstrap-db.mjs
```

Sau đó seed với **admin** URL (`ticket_dev` trên cùng DB), chạy API với **runtime** URL từ JSON bootstrap.

**DB đã tồn tại** (tạo trước khi có grant platform): một lần trên `ticket_d9_demo` với superuser:

```sql
GRANT ticket_platform_runtime TO d9_demo_rt;
```

**Chạy API local (ví dụ):**

```bash
pnpm --filter @ticket/backend build && pnpm --filter @ticket/api build
DATABASE_URL='postgresql://d9_demo_rt:<password>@127.0.0.1:55432/ticket_d9_demo' \
  OIDC_ISSUER='http://127.0.0.1:8080/realms/ticket' \
  node apps/api/dist/main.js
curl -sS 'http://127.0.0.1:3001/v1/public/events?limit=5' | jq '.items[].slug'
# kỳ vọng: mfest, studio-night (sau ./scripts/d9-demo-seed.sh)
curl -sS 'http://127.0.0.1:3001/v1/public/tenants/mfest-demo/events/mfest' | jq '.slug'
```

Slug UAT web: tenant `mfest-demo`, event `mfest` (legacy `demo-fun` / `fun-fest` đã rebrand — xem `D9_LEGACY_TENANT_SLUGS`).

Env:

| Variable | Meaning |
| --- | --- |
| `D9_DEMO_FORCE_MARKETING=1` | Save config version mới + publish dù event đã có `published_config_version` |
| `D9_SMOKE_BOOTSTRAP=0` | Smoke dùng `DATABASE_URL` / `D9_RUNTIME_DATABASE_URL` hiện có thay vì drop/create DB |

### FE UAT stack (Epic #715) — một quy trình

Script `./scripts/fe-uat-stack.sh` gom bootstrap + seed đúng thứ tự (tránh lệch so reviewer/UAT worker):

1. **Infra:** Compose Postgres `:55432` + Keycloak `:8080` healthy.
2. **`bootstrap`:** `node scripts/lib/d9-demo-bootstrap-db.mjs` → DB `ticket_d9_demo`, role `d9_demo_rt` có `ticket_runtime` **+** `ticket_platform_runtime`.
3. **Seed:** `./scripts/d9-demo-seed.sh` với `DATABASE_URL` **admin** (`ticket_dev`), **trước** khi staff/attendee login web — và bắt buộc `D9_DEMO_STAFF_SUBJECT` / `D9_DEMO_ATTENDEE_SUBJECT` lấy từ Keycloak (`scripts/lib/fe-uat-keycloak-tokens.mjs`). Chỉ chạy `d9-demo-seed.sh` tay sau khi user đã login OIDC có thể gắn membership vào row fixture `d9-demo-*-subject-fixture` thay vì `sub` thật → `/admin` / `/gate` deny.
4. **API :3001:** `DATABASE_URL` = **runtime** URL từ bootstrap; `CODE_HMAC_PEPPER` + `TICKET_CREDENTIAL_KEY` khớp seed; `SINGLE_CODE_RESOLVE_GLOBAL=1` nếu UAT `/redeem` không gắn query tenant/event.
5. **Web :3000:** `apps/web/.env.example` + `API_BASE_URL=http://127.0.0.1:3001`, `WEB_PUBLIC_ORIGIN=http://localhost:3000`; redeem tenant-bound: `/redeem?tenantSlug=mfest-demo&eventSlug=mfest` (hoặc bật `NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1` cho luồng một mã).

```bash
pnpm install
pnpm --filter @ticket/web-session build   # bắt buộc trước next dev (worktree mới)
./scripts/fe-uat-stack.sh bootstrap
./scripts/fe-uat-stack.sh print-env   # paste vào terminal API + web
# Terminal A: pnpm --filter @ticket/api... build && eval exports && node apps/api/dist/main.js
# Terminal B: apps/web — next dev -p 3000
./scripts/fe-uat-stack.sh check-api   # me/tickets, staff admin, published terms-v1
./scripts/fe-uat-stack.sh check-ui    # Playwright: redeem-terms-consent, wallet-ticket-grid, admin-workspace, gate-tabs
```

State local (gitignored): `.fe-uat-stack/env.sh`.

See evidence: [`docs/reviews/D9-DEMO-SEED.md`](../reviews/D9-DEMO-SEED.md).

## S6 / TestFlight catalog (27/10/2026)

Tên sự kiện `MFest · Demo` / `Studio Night · Demo` khớp catalog public trên TestFlight **1.0.0 (28)** (SHA nguồn `2645999f0ad535276b63a95c6c96bace9cff025e`) — launch PASS. Login OIDC trên bake 28 fail-closed; không dùng binary TF làm PASS attendee redeem. Persona local S6: [`docs/ops/UI925-LOCAL-PERSONA-FIXTURES.md`](../ops/UI925-LOCAL-PERSONA-FIXTURES.md), không seed prod (ADR-21).
