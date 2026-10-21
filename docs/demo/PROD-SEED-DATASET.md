# Prod seed dataset — 4 org, 6 event (Epic #686)

**Epic:** [#686](https://github.com/hangndat/ticket-solution/issues/686) — Seed prod: 4 org, 6 event, staff, media đủ kích thước  
**Marker:** **không** dùng chuỗi `· Demo` trên bất kỳ trường UI (org, event, venue, source, marketing). Dữ liệu production-like; chạy trên prod DB chỉ sau review PASS + xác nhận owner lần cuối.  
**Anchor ngày giờ:** `2026-10-21` (Thứ Ba, ICT `Asia/Ho_Chi_Minh`) — mọi khung giờ dưới đây tính từ mốc này.

## Mục tiêu

| Hạng mục | Mục tiêu |
| --- | --- |
| Tenant | 4 org độc lập (thương hiệu VN + quốc tế, copy UI tiếng Việt) |
| Event | Phân bố **1 + 2 + 3 + 0** → **6** event `PUBLISHED` |
| Thời gian | 6 khung giờ **khác nhau**, phủ quá khứ xa/gần, đang diễn ra, hôm nay, sắp tới gần/xa |
| Staff | Roster đủ vai theo `MembershipRole` (`packages/backend/src/role-map.ts`) + event assignment |
| Identity | Email thật plus-address `hangndat+<org>-<role>@gmail.com` (owner đồng ý) |
| Inventory | Ticket types, nguồn phát hành, quota EVENT/TYPE/SOURCE + mã redeem (HMAC) |
| Media | Logo + banner per event, đủ surface web + iOS (xem AC media) |

**Không** trùng UUID/slug với D9 fixture (`d9d9f001-*`, `mfest-demo`, `demo-studio`). Prod seed namespace: `686f0001-*`.

## Phân bố event theo org

| Org | Slug | Số event | Event slugs |
| --- | --- | ---: | --- |
| 1 · Lục Bảo Live | `luc-bao-live` | 1 | `dem-am-indie` |
| 2 · Saigon Pulse | `saigon-pulse` | 2 | `pulse-afterhours`, `pulse-rooftop` |
| 3 · Di sản Hội An | `heritage-hoi-an` | 3 | `pho-co-dem`, `song-thu-workshop`, `festival-an-song` |
| 4 · Mekong Makers | `mekong-makers` | 0 | — (org + staff only; kiểm tra empty catalog / portal) |

## Stable UUID namespace (`686f0001`)

Quy ước segment: `686f0001-00{kind}-4000-8000-0000000000{nn}`.

### Tenants

| # | Name (UI) | Slug | UUID |
| ---: | --- | --- | --- |
| 1 | Lục Bảo Live | `luc-bao-live` | `686f0001-0001-4000-8000-000000000001` |
| 2 | Saigon Pulse | `saigon-pulse` | `686f0001-0001-4000-8000-000000000002` |
| 3 | Di sản Hội An | `heritage-hoi-an` | `686f0001-0001-4000-8000-000000000003` |
| 4 | Mekong Makers | `mekong-makers` | `686f0001-0001-4000-8000-000000000004` |

### Events

| UUID | Org | Slug | Name (UI) | Venue (UI) | Khung giờ (ICT) | Trạng thái (tại 2026-10-21) |
| --- | --- | --- | --- | --- | --- | --- |
| `686f0001-0002-4000-8000-000000000001` | 1 | `dem-am-indie` | Đêm Nhạc Indie Lục Bảo | Nhà hát Lớn Hà Nội | **Bắt đầu** 2026-09-05 19:30 · **Kết thúc** 2026-09-05 22:30 | Quá khứ xa |
| `686f0001-0002-4000-8000-000000000002` | 2 | `pulse-afterhours` | Pulse Afterhours | The Observatory, Quận 1, TP.HCM | 2026-10-18 22:00 → 2026-10-19 04:00 | Quá khứ gần |
| `686f0001-0002-4000-8000-000000000003` | 2 | `pulse-rooftop` | Pulse Rooftop Session | Chill Skybar, Quận 1, TP.HCM | 2026-10-20 17:00 → 2026-10-22 23:59 | Đang diễn ra |
| `686f0001-0002-4000-8000-000000000004` | 3 | `pho-co-dem` | Phố Cổ Về Đêm | Khu phố cổ Hội An, Quảng Nam | 2026-10-21 18:00 → 2026-10-21 23:00 | Hôm nay (sắp tới trong ngày) |
| `686f0001-0002-4000-8000-000000000005` | 3 | `song-thu-workshop` | Workshop Sông Thu | An Nhiên Garden, Hội An | 2026-11-08 09:30 → 2026-11-08 16:30 | Sắp tới gần |
| `686f0001-0002-4000-8000-000000000006` | 3 | `festival-an-song` | Festival Ăn Sống Hội An | Công viên An Bàng, Hội An | 2027-02-14 08:00 → 2027-02-16 22:00 | Sắp tới xa (nhiều ngày) |

**Seed BE:** lưu `starts_at` / `ends_at` (hoặc tương đương schema) đúng ISO-8601 `+07:00`. Đặt `redemption_opens_at` / `check_in_opens_at` ≥ 2h trước `starts_at` và đóng sau `ends_at` (cùng pattern `demo-seed.ts`).

### Mô tả sự kiện (VI / EN)

| Event slug | Mô tả VI (marketing hero) | Description EN |
| --- | --- | --- |
| `dem-am-indie` | Đêm nhạc độc lập với lineup nghệ sĩ Việt — không gian intime tại Nhà hát Lớn. | An intimate indie night featuring Vietnamese artists at the Hanoi Opera House. |
| `pulse-afterhours` | Afterparty điện tử đến sáng — bass, ánh sáng và cộng đồng Pulse. | Electronic afterhours until dawn — bass, lights, and the Pulse community. |
| `pulse-rooftop` | Sunset-to-late rooftop: house & disco trên tầng thượng Sài Gòn. | Sunset-to-late rooftop house and disco above Saigon. |
| `pho-co-dem` | Dạo phố cổ về đêm: ẩm thực, nghệ nhân và âm nhạc đường phố. | Old-town night walk: food, artisans, and street music. |
| `song-thu-workshop` | Buổi học làm gốm và nếm trà bên dòng Thu Bồn. | Pottery and tea tasting workshop along the Thu Bon river. |
| `festival-an-song` | Lễ hội ẩm thực sống lành mạnh — ba ngày chef pop-up và chợ nông trại. | Three-day clean-eating festival with chef pop-ups and farm market. |

## Ticket types, nguồn phát hành, quota

Mỗi event có **đúng một** ticket type và **đúng một** issuance source (đủ UAT; có thể mở rộng sau). Quota bucket UUID ổn định theo event index `E01`…`E06`.

| Event | Ticket type (UI) | Type UUID | Source (UI) | Source UUID | Quota EVENT | Quota TYPE | Quota SOURCE | Event cap |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| E01 `dem-am-indie` | Vé Thường | `686f0001-0003-4000-8000-000000000001` | Phát hành Website | `686f0001-0004-4000-8000-000000000001` | `…000501` | `…000511` | `…000521` | 120 |
| E02 `pulse-afterhours` | Vé Cửa | `…000002` | Đối tác Pulse Club | `…000002` | `…000502` | `…000512` | `…000522` | 200 |
| E03 `pulse-rooftop` | Vé Rooftop | `…000003` | Phát hành Website | `…000003` | `…000503` | `…000513` | `…000523` | 80 |
| E04 `pho-co-dem` | Vé Đi bộ | `…000004` | Quầy vé Phố cổ | `…000004` | `…000504` | `…000514` | `…000524` | 300 |
| E05 `song-thu-workshop` | Vé Workshop | `…000005` | Form đăng ký | `…000005` | `…000505` | `…000515` | `…000525` | 40 |
| E06 `festival-an-song` | Vé Ngày | `…000006` | Early Bird Online | `…000006` | `…000506` | `…000516` | `…000526` | 1500 |

Đầy đủ quota UUID (thay `…`):

- EVENT: `686f0001-0005-4000-8000-000000000501` … `000506`
- TYPE: `686f0001-0005-4000-8000-000000000511` … `000516`
- SOURCE: `686f0001-0005-4000-8000-000000000521` … `000526`

### Mã redeem (plaintext — owner test only)

Pepper: `CODE_HMAC_PEPPER` prod (không commit). Plaintext **không** surface trên marketing FAQ. Prefix `VEM-` (không `DEMO-`).

| Event | Mã mẫu (10 vé / event) |
| --- | --- |
| E01 | `VEM-LUCBAO-001` … `VEM-LUCBAO-010` |
| E02 | `VEM-PULSE-AH-001` … `VEM-PULSE-AH-010` |
| E03 | `VEM-PULSE-RT-001` … `VEM-PULSE-RT-010` |
| E04 | `VEM-HOIAN-PC-001` … `VEM-HOIAN-PC-010` |
| E05 | `VEM-HOIAN-WS-001` … `VEM-HOIAN-WS-010` |
| E06 | `VEM-HOIAN-FEST-001` … `VEM-HOIAN-FEST-010` |

## Staff roster & event assignment

### Vai trò (model hiện tại)

| UI (VI) | `MembershipRole` | Tenant perms (`tenantPermissionsForRole`) | Event perms khi assigned (`eventPermissionsForRole`) |
| --- | --- | --- | --- |
| Chủ tổ chức | `Owner` | `tenant.profile`, `members.manage`, `event.create`, `event.list` | Full ops: config, publish, inventory, gate, CS, report |
| Quản trị (Admin) | `Manager` | `event.create` | Config, publish, inventory, redemption, report |
| Hỗ trợ khách (Support) | `CS` | — | `cs.lookup`, `cs.resend` |
| Trưởng cửa | `Supervisor` | — | `gate.confirm`, `gate.undo`, `ticket.revoke` |
| Soát vé (Door / check-in) | `Scanner` | — | `gate.confirm` |

### Email & identity (Keycloak / OIDC)

Pattern: `hangndat+<orgKey>-<roleKey>@gmail.com`

| roleKey | Role |
| --- | --- |
| `owner` | Owner |
| `admin` | Manager |
| `support` | CS |
| `door-lead` | Supervisor |
| `door` | Scanner |

| orgKey | Org |
| --- | --- |
| `lucbao` | Lục Bảo Live |
| `saigon` | Saigon Pulse |
| `hoian` | Di sản Hội An |
| `mekong` | Mekong Makers |

**Stable user UUID** (gợi ý seed `users.id` + Keycloak `sub` khi import):  
`686f0001-0007-4000-8000-{org3}{role2}` — `org3` = `001`…`004`, `role2` = `01` Owner … `05` Scanner.

Ví dụ: org1 Owner → `686f0001-0007-4000-8000-00010101` (`001` + `01` + pad).

Issuer: prod `OIDC_ISSUER` (Keycloak realm). Seed gắn membership cho **mọi** `users` row cùng email (multi-issuer giống D9).

### Roster theo org (20 staff = 4×5)

| Org | Owner | Admin | Support | Door lead | Door |
| --- | --- | --- | --- | --- | --- |
| lucbao | `hangndat+lucbao-owner@gmail.com` | `…-admin@…` | `…-support@…` | `…-door-lead@…` | `…-door@…` |
| saigon | `hangndat+saigon-owner@gmail.com` | … | … | … | … |
| hoian | `hangndat+hoian-owner@gmail.com` | … | … | … | … |
| mekong | `hangndat+mekong-owner@gmail.com` | … | … | … | … |

### Event assignment (active)

Ghi `event_assignments` với permissions = `eventPermissionsForRole(role)`.

| Event | Owner | Manager | CS | Supervisor | Scanner |
| --- | --- | --- | --- | --- | --- |
| E01 | lucbao owner | lucbao admin | lucbao support | lucbao door-lead | lucbao door |
| E02 | saigon owner | saigon admin | saigon support | saigon door-lead | saigon door |
| E03 | saigon owner | saigon admin | saigon support | saigon door-lead | saigon door |
| E04 | hoian owner | hoian admin | hoian support | hoian door-lead | hoian door |
| E05 | hoian owner | hoian admin | hoian support | hoian door-lead | hoian door |
| E06 | hoian owner | hoian admin | hoian support | hoian door-lead | hoian door |
| (org4) | mekong * | — | — | — | — |

\* Org4: **chỉ** tenant membership, **không** event assignment (0 event). Owner vẫn có quyền tạo event sau seed.

**Cross-tenant:** không gán staff org A sang event org B.

## Brand snapshot (per event)

| Org / event | `primaryColor` | `organizationName` |
| --- | --- | --- |
| Lục Bảo / E01 | `#1B4D3E` | Lục Bảo Live |
| Saigon Pulse / E02–E03 | `#E85D04` | Saigon Pulse |
| Di sản Hội An / E04–E06 | `#8B4513` | Di sản Hội An |
| Mekong Makers | `#2A6F97` | Mekong Makers |

Published marketing config (ADR-19): hero + info + redeem + FAQ + terms — copy VI ưu tiên, EN trong FAQ item phụ khi cần. Re-seed: skip publish nếu đã có `published_config_version` trừ khi `PROD_SEED_FORCE_MARKETING=1` (mirror `D9_DEMO_FORCE_MARKETING`).

## Media inventory (6 event × logo + banner)

Tham chiếu giới hạn: [`docs/ops/MEDIA-ASSET-CHECKLIST.md`](../ops/MEDIA-ASSET-CHECKLIST.md), `ASSET_LIMITS` trong `packages/contracts`.

| Vai trò | Kích thước | Format | Surface |
| --- | --- | --- | --- |
| Logo (`logoAssetId`) | 760×200 PNG (lockup) hoặc 512×512 | PNG/WebP | Web card 36px height contain; iOS `EventLogo` |
| Banner (`bannerAssetId`) | **1200×630** | JPEG/WebP/PNG | Web hero ~full width; iOS `EventBanner` height 140 cover |
| OG / share | 1200×630 | cùng file banner | Web meta, link preview |

**Manifest đề xuất:** `brand/prod/manifest.json` (song song `brand/demo/manifest.json`) — map `tenantId` + `eventId` UUID bảng trên → file nguồn trong `brand/prod/{orgKey}/` → object key ready:

```text
tenants/{tenantId}/events/{eventId}/assets/ready/{assetId}.{ext}
```

Stable `assetId` gợi ý: `686f0001-0008-4000-8000-00{EE}{AA}` — `EE` = 01…06 event, `AA` = `01` logo, `02` banner.

| Event | Logo asset UUID | Banner asset UUID |
| --- | --- | --- |
| E01 | `686f0001-0008-4000-8000-00010101` | `686f0001-0008-4000-8000-00010102` |
| E02 | `…00020101` | `…00020102` |
| E03 | `…00030101` | `…00030102` |
| E04 | `…00040101` | `…00040102` |
| E05 | `…00050101` | `…00050102` |
| E06 | `…00060101` | `…00060102` |

Org4 (không event): optional logo tenant-level trong manifest (`tenantBrand.logo`) — không bắt buộc AC media event.

**Không** đăng ký UUID prod trong `apps/web/src/demo-media.ts` / mobile demo pack — prod dùng URL MinIO signed từ DB (`logoAssetId` / `bannerAssetId`).

## Idempotency (BE seed)

- Upsert tenant/event theo **stable UUID + slug**; cập nhật name, venue, thời gian, brand snapshot mỗi re-seed.
- Inventory: insert-or-skip theo fixed type/source/quota IDs; codes insert-or-skip theo HMAC.
- Membership / assignment: skip nếu đã active cho `(tenant, user)` / `(tenant, event, membership)`.
- Marketing: lần đầu publish; re-seed skip nếu đã publish (force flag ở trên).
- **Fail-closed:** refuse overwrite UUID trùng với tenant/event không thuộc namespace `686f0001-*`.

## Commands (dự kiến — BE implement)

```bash
# Sau migrate + CODE_HMAC_PEPPER prod (chỉ trên môi trường được ủy quyền)
./scripts/prod-seed.sh              # idempotent data
PROD_SEED_FORCE_MARKETING=1 ./scripts/prod-seed.sh

# Media (MinIO) — mirror d9-seed-media
./scripts/prod-seed-media.sh
./scripts/prod-seed-media.sh --smoke-only
```

Script names có thể đổi theo ADR prod seed; dataset UUID/copy **không đổi** trừ khi amend doc + Epic.

---

## Acceptance criteria

### A. Dataset document (this PR)

- [ ] File `docs/demo/PROD-SEED-DATASET.md` tồn tại, link Epic #686.
- [ ] 4 org + 6 event + 0 event org4; không có `· Demo`.
- [ ] 6 khung giờ ICT phân biệt, anchor `2026-10-21`.
- [ ] Bảng UUID đầy đủ cho tenant, event, type, source, quota, staff, media asset.

### B. Backend seed (`packages/backend` — task follow-up)

- [ ] Hằng số `PROD_SEED` (hoặc tương đương) khớp **100%** UUID/slug/copy/thời gian trong doc.
- [ ] `runProdSeed()` idempotent; báo cáo inserted/skipped (pattern `D9DemoSeedReport`).
- [ ] 20 user rows + membership + assignment như ma trận; org4 không assignment.
- [ ] 6 event `PUBLISHED` + inventory + 10 mã HMAC/event; publish marketing lần đầu.
- [ ] Unit test: UUID namespace, role permissions, không đụng `D9_DEMO` IDs.
- [ ] CLI/script documented; **không** gọi prod từ CI mặc định.

### C. Media seed (web / asset pipeline — task follow-up)

- [ ] `brand/prod/manifest.json` + 12 file raster (6 logo + 6 banner) đúng kích thước checklist.
- [ ] Upload ready keys trên `MINIO_BUCKET_ASSETS`; DB `events` / config trỏ `logoAssetId` + `bannerAssetId`.
- [ ] Smoke: `HEAD` object + API published event trả URL hợp lệ.
- [ ] Web: banner `naturalWidth` 1200 trên catalog + detail (Playwright hoặc script smoke).
- [ ] iOS: banner + logo hiển thị trên published list/detail với AX label `Ảnh banner sự kiện` / `Logo sự kiện` (UAT headless hoặc manual evidence).

### D. Safety / prod gate

- [ ] PR implement seed **không** chạy script trên prod trong pipeline.
- [ ] Chạy prod DB chỉ sau DoD reviewer + owner explicit (Epic #686).

## Out of scope (Epic #686)

- Merge seed vào `main` production deploy trong task docs-only này.
- Tạo Keycloak user prod (ops/import riêng; doc chỉ liệt kê email/sub UUID).
- Attendee wallet mẫu (có thể thêm `hangndat+attendee-prod@gmail.com` ở task BE nếu cần redeem UAT).

## Liên quan

- Mẫu fixture: [`D9-DEMO-DATASET.md`](./D9-DEMO-DATASET.md)
- Media ops: [`docs/ops/MEDIA-ASSET-CHECKLIST.md`](../ops/MEDIA-ASSET-CHECKLIST.md)
- Roles: `packages/backend/src/role-map.ts`
