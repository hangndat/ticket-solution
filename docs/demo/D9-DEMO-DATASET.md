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

## Idempotency

- Upsert tenant/event theo **stable UUID + slug** (name / venue / brand snapshot luôn cập nhật trên re-seed).
- Inventory: insert-or-skip theo fixed type/source/quota IDs; `issuance_sources.name` **UPDATE** trên conflict; codes insert-or-skip theo HMAC.
- Membership / assignment: skip nếu đã active cho `(tenant, user)` / `(tenant, event, membership)`.
- **Marketing config:** lần đầu seed → save + publish. Re-seed mặc định **skip** nếu `published_config_version` đã có (tránh bump version vô ích). Sau khi đổi copy seed, **phải force republish** (xem dưới).

## Commands

```bash
# Requires migrated DATABASE_URL + CODE_HMAC_PEPPER
./scripts/d9-demo-seed.sh
./scripts/d9-demo-seed.sh   # second run must be safe (marketing skip nếu đã publish)

# Sau khi cập nhật DEMO_MARKETING / venue / FAQ trong demo-seed.ts — bắt buộc trên DB đã seed:
D9_DEMO_FORCE_MARKETING=1 ./scripts/d9-demo-seed.sh

# API smoke (login / me/tenants / redeem / me/tickets)
./scripts/d9-demo-seed-smoke.sh
```

Env:

| Variable | Meaning |
| --- | --- |
| `D9_DEMO_FORCE_MARKETING=1` | Save config version mới + publish dù event đã có `published_config_version` |

See evidence: [`docs/reviews/D9-DEMO-SEED.md`](../reviews/D9-DEMO-SEED.md).
