# D9 demo dataset (fixture) — multi-tenant

**Issue:** #136 (T1) → Story #135 → Epic #134  
**Marker:** mọi tenant/event name chứa chuỗi `· Demo` hoặc `(fixture)`. **Không** dùng secrets/production credentials.

## Mục tiêu

≥2 tenant demo với event PUBLISHED, mã redeem, quota, staff membership + event assignment — đủ UAT demo (web/iOS/API) mà không lẫn dữ liệu thật.

## Stable fixture IDs

| Entity | Slug / label | UUID (ổn định) |
| --- | --- | --- |
| Tenant A | `demo-fun` | `d9d9f001-0001-4000-8000-000000000001` |
| Tenant B | `demo-studio` | `d9d9f001-0001-4000-8000-000000000002` |
| Event A | `fun-fest` @ demo-fun | `d9d9f001-0002-4000-8000-000000000001` |
| Event B | `studio-night` @ demo-studio | `d9d9f001-0002-4000-8000-000000000002` |
| Ticket type A | General (demo-fun) | `d9d9f001-0003-4000-8000-000000000001` |
| Ticket type B | General (demo-studio) | `d9d9f001-0003-4000-8000-000000000002` |
| Source A | Demo VIP (fixture) | `d9d9f001-0004-4000-8000-000000000001` |
| Source B | Demo GA (fixture) | `d9d9f001-0004-4000-8000-000000000002` |
| Quota EVENT A | — | `d9d9f001-0005-4000-8000-000000000001` |
| Quota TYPE A | — | `d9d9f001-0005-4000-8000-000000000011` |
| Quota SOURCE A | — | `d9d9f001-0005-4000-8000-000000000021` |
| Quota EVENT B | — | `d9d9f001-0005-4000-8000-000000000002` |
| Quota TYPE B | — | `d9d9f001-0005-4000-8000-000000000012` |
| Quota SOURCE B | — | `d9d9f001-0005-4000-8000-000000000022` |

Slug cặp **khớp** catalog fixture iOS (`apps/mobile/src/data/demo-events.ts`: `demo-fun` / `demo-studio`). Web marketing fixtures (`sunburst` / `northline`) là catalog tĩnh riêng — không ghi đè bởi seed này.

## Roles & identities (Keycloak realm demo)

| Role | Email (realm import) | Password (local only) | Scope |
| --- | --- | --- | --- |
| Owner + event ops | `staff@example.com` | `staff-demo` | Membership Owner trên **cả hai** tenant; event assignment với quyền Owner-event |
| Attendee | `attendee@example.com` | `attendee-demo` | Không membership — redeem mã → My Tickets |

Issuer lấy từ `OIDC_ISSUER` (phải khớp Keycloak discovery). Seed gắn membership cho **mọi** `users` row cùng email (hỗ trợ issuer `127.0.0.1` và LAN IP).

## Inventory (plaintext codes — fixture only)

Pepper: `CODE_HMAC_PEPPER` (local placeholder). Codes lưu HMAC only.

| Tenant | Event | Quota EVENT | Codes (uppercase) |
| --- | --- | --- | --- |
| demo-fun | fun-fest | 50 | `DEMO-FUN-001` … `DEMO-FUN-010` |
| demo-studio | studio-night | 50 | `DEMO-STUDIO-001` … `DEMO-STUDIO-010` |

## Idempotency

- Upsert tenant/event theo **stable UUID + slug**.
- Inventory: insert-or-skip theo fixed type/source/quota IDs; codes insert-or-skip theo HMAC.
- Membership / assignment: skip nếu đã active cho `(tenant, user)` / `(tenant, event, membership)`.

## Commands

```bash
# Requires migrated DATABASE_URL + CODE_HMAC_PEPPER
./scripts/d9-demo-seed.sh
./scripts/d9-demo-seed.sh   # second run must be safe

# API smoke (login / me/tenants / redeem / me/tickets)
./scripts/d9-demo-seed-smoke.sh
```

See evidence: [`docs/reviews/D9-DEMO-SEED.md`](../reviews/D9-DEMO-SEED.md).
