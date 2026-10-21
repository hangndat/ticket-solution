# Prod seed media — inventory & art direction (Epic #686)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#686](https://github.com/hangndat/ticket-solution/issues/686) — Seed prod: 4 org, 6 event, staff, media |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../agents/roles/product-design.md) |
| Visual budget | **Có** — bám Live Pulse [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json) + freeze [`docs/design/visual-identity-v2/visual-notes.md`](../visual-identity-v2/visual-notes.md) |
| Dataset BA | `docs/demo/PROD-SEED-DATASET.md` — **chưa có trên branch**; bảng map placeholder §4 cập nhật khi BA push |
| Phạm vi task | Audit surface + kích thước tối thiểu + art direction — **không** tạo raster/SVG tại đây |
| Runtime limits | `ASSET_LIMITS` — [`packages/contracts/src/config.ts`](../../../packages/contracts/src/config.ts) |
| Ops checklist | [`docs/ops/MEDIA-ASSET-CHECKLIST.md`](../../ops/MEDIA-ASSET-CHECKLIST.md) |

---

## 0. Brand / visual budget (freeze cho prod seed)

**Art direction nền:** Live Pulse — ink `#0B1220`, paper `#F4F6F8`, signal `#E11D48`, focus `#2563EB`; display **Sora**, body **Be Vietnam Pro**. Event/org seed **không** invent palette thứ 5 — dùng `primaryColor` hex trên từng org/event như accent trên nền Live Pulse (CTA vẫn ưu tiên signal platform khi không override theme).

| Hạng mục | Chốt |
| -------- | ---- |
| Tokens | `brand/vemoki/tokens.json` |
| Typography | Sora (display) + Be Vietnam Pro (body); cấm Inter/Roboto/Arial hero |
| Surfaces | Banner = full-bleed plane, `object-fit: cover` (web) / `resizeMode: cover` (iOS); logo = `contain`, nền trong |
| Anti-patterns | Purple AI-default; card cluster che hero; badge sticker trên banner; SVG upload C-B; terracotta v1 `#9b3a18` |
| Motion | Hero fade ngắn; `prefers-reduced-motion` / Reduce Motion → tĩnh |
| Priority screens (media) | Web Home + event hero; iOS Events list + event detail + wallet ticket detail |
| Freeze | Implementer/graphics không lệch khối này; thiếu spec → escalate coordinator |

---

## 1. `ASSET_LIMITS` (ràng buộc upload event)

Nguồn: `packages/contracts/src/config.ts` → `ASSET_LIMITS`.

| Ràng buộc | Giá trị |
| --------- | ------- |
| `maxBytes` | 5 MiB |
| `maxWidthPx` / `maxHeightPx` | 4096 px |
| `maxPixels` | 16_000_000 |
| `maxAssetsPerEvent` | 20 (trạng thái QUARANTINE + READY) |
| `allowedMime` | `image/png`, `image/jpeg`, `image/webp` |

Pipeline: client [`apps/web/src/admin/config-assets.ts`](../../../apps/web/src/admin/config-assets.ts) → presigned PUT quarantine → server `sharp` re-encode [`packages/backend/src/config-assets.ts`](../../../packages/backend/src/config-assets.ts) → object ready  
`tenants/{tenantId}/events/{eventId}/assets/ready/{assetId}.{png|jpg|webp}` (bucket private, URL HTTPS khi projection bật).

**Org (tenant):** chỉ `logoAssetId` trên bảng `tenants` (API branding) — **không** `bannerAssetId` cấp org trong contract hiện tại.

---

## 2. Audit — mọi surface hiển thị ảnh event / org

Quy ước cột:

- **Hiển thị (@1x):** CSS px hoặc RN logical pt (width × height) tại viewport tham chiếu.
- **Tỉ lệ:** khung UI; ảnh nguồn nên khớp hoặc dư để crop an toàn.
- **Export tối thiểu:** master upload (≤ `ASSET_LIMITS`); **@3x buffer** gợi ý cho iOS retina khi khác master.
- **URL:** `https` hoặc `/` root-relative sau `sanitizeMediaUrl` / `sanitizeLogoUrl`; remote iOS chỉ `https`.

### 2.1 Web — attendee (`apps/web`)

| Surface | File nguồn | Kích thước hiển thị (@1x) | Tỉ lệ / crop | Export tối thiểu (master) | Ghi chú |
| ------- | ---------- | -------------------------- | ------------ | --------------------------- | ------- |
| Home — featured banner | `app/page.tsx` + `.home-featured-banner` (`globals.css`) | 100% × max **360** px cao; min-h **200**; `aspect-ratio: 16/9` | 16∶9 **cover** | **1200×630** WebP/JPEG | `EventBanner` intrinsic 1200×630 |
| Home — list row banner | `app/page.tsx` + `.event-banner-card` | 100% × max **220** px; 16∶9 box | 16∶9 **cover** | **1200×630** | Container ≤1200 px |
| Home — list row logo | `app/page.tsx` + `.event-logo-card` | max-h **40** px; max-w **200** px | **contain** | **760×200** PNG hoặc lockup ≤760×200 | Khớp `brand/vemoki/lockup.png` |
| Event detail — hero banner | `app/t/.../events/[eventSlug]/page.tsx` + `.event-banner-hero` trong `.poster-media` | Full bleed; min-h **clamp(220px, 38vw, 420px)** | **cover** center | **1200×630** (khuyến nghị **1600×840** nếu crop hero sâu) | `object-fit: cover` |
| Event detail — logo (nếu dùng class hero) | `.event-logo-hero` (CSS sẵn; trang hiện **không** render `EventLogo` trên hero) | max-h **56** px; max-w **240** px | **contain** | **760×200** | Gap UI: có CSS, chưa gắn component — seed vẫn nên có logo cho tương lai |
| Owner ticket (web) | `app/t/.../tickets/[ticketId]/page.tsx` | **Không** hiển thị event logo/banner | — | — | Chỉ QR + text |
| Site wordmark / tenant logo | `src/site-chrome.tsx` → `src/brand-mark.tsx` | Mark **~0.92em** (~30–34 px) hoặc img **64×64** box, `object-fit: contain` | **contain** | Org logo **512×512** hoặc lockup **760×200** | `branding.logoUrl` từ public tenant branding |
| Admin — upload preview | `app/admin/config-brand-panel.tsx` | Không render ảnh; chỉ hiện `logoAssetId` / `bannerAssetId` | — | Theo slot | Preview text: `src/content/config-renderer.tsx` |
| Demo fallback | `src/demo-media.ts` → `/public/demo/*.png` | Cùng component như trên | — | logo **760×200**, banner **1200×630** | Chỉ id/slug demo allowlist |

**Web breakpoint:** `.container` max-width **1200** px; hero bleed `100vw`. Banner master **1200×630** đủ cho 1x–2x; hero full-bleed trên màn 1440+ vẫn upscale nhẹ — chấp nhận hoặc export **1920×1008** nếu cần pixel-perfect (vẫn ≤4096, ≤5 MiB).

**Signed URL:** upload admin dùng presigned PUT (`config-assets`); hiển thị công khai kỳ vọng HTTPS CDN/BFF (contract `PublishedBrand.logoUrl` / `bannerUrl`). Backend projection [`packages/backend/src/published-events.ts`](../../../packages/backend/src/published-events.ts) hiện map `primaryColor` + `organizationName` — **chưa** resolve URL từ `logoAssetId`/`bannerAssetId` (Epic seed/BE cần bổ sung).

### 2.2 iOS — attendee (`apps/mobile`)

RN dùng **một** bundled PNG per slot; scale theo mật độ màn hình. Cột **@3x** = logical ×3 cho buffer export.

| Surface | File nguồn | Hiển thị (@1x pt) | @2x / @3x buffer (px) | Tỉ lệ / `resizeMode` | Export tối thiểu |
| ------- | ---------- | ----------------- | ---------------------- | -------------------- | ------------------ |
| Events list — card banner | `src/screens/events.tsx` → `EventBanner` | w **100%** (~353 pt iPhone 15), h **142** | ~706×284 / **1059×426** | **cover**, radius 0 | **1200×630** |
| Event detail — hero banner | `src/screens/event-detail.tsx` | w full bleed (~393 pt), h **220** | ~786×440 / **1179×660** | **cover** | **1200×630** |
| Event detail — logo | `event-detail.tsx` → `EventLogo` default | h **36**, w **115** (×3.2) | 72×230 / **108×345** | **contain** | **760×200** |
| Wallet — ticket row logo | `src/screens/my-tickets.tsx` | h **28**, w ~**90** | 56×180 / **84×270** | **contain** | Cùng logo master |
| Ticket detail — banner | `src/screens/ticket-detail.tsx` | w card, h **120** | 240×240 / **360×360** height-led | **cover** | **1200×630** |
| Ticket detail — logo | `ticket-detail.tsx` | h **32**, w ~**102** | 64×204 / **96×306** | **contain** | **760×200** |
| Tenant chrome | `src/theme/TenantLogo.tsx` | h **36** (default), w **108** | 72×216 / **108×324** | **contain** | Org `logoUrl` HTTPS |
| Demo bundle | `src/data/demo-media-assets.ts` | require `assets/demo/logo.png`, `banner.png` | — | — | Cùng kích thước web demo |

**Wallet / Apple Wallet pass:** không có surface ảnh event trong code hiện tại (chỉ QR). PassKit icon/strip — **out of scope** MVP.

### 2.3 Platform Vemoki (không gắn event/org seed)

| Surface | File | Hiển thị | Export (đã có trong repo) |
| ------- | ---- | ------- | ------------------------- |
| Web favicon | `apps/web/app/icon.png` | 512×512 box | **512×512** |
| Apple touch | `apps/web/app/apple-icon.png` | touch icon | theo Next metadata |
| OG mặc định | `apps/web/app/opengraph-image.png` | share card | **1200×630** (`brand/vemoki/og.png`) |
| iOS app icon | `apps/mobile/assets/icon.png` | home screen | **1024×1024** (`tokens.surfaces.iosAppIcon`) |
| iOS splash | `apps/mobile/assets/splash-icon.png` | splash | theo Expo |
| Email header platform | `brand/vemoki/email-header.png` | ~600 px wide email | **600×160** |
| Wordmark lockup | `brand/vemoki/lockup.png` | marketing | **760×200** |
| Mark | `brand/vemoki/mark.svg` | vector chrome | SVG — **không** upload C-B |

### 2.4 Open Graph / social

| Surface | File | Ghi chú |
| ------- | ---- | ------- |
| Root metadata | `app/layout.tsx` | `metadataBase` → `app.vemoki.com`; **không** per-event `og:image` trên trang event (`generateMetadata` chỉ title/description) |
| Share khi seed prod | — | Nếu cần OG theo event: dùng banner **1200×630**; follow-up BE/Next `opengraph-image` động — **ngoài** inventory consumer hiện tại |

### 2.5 Email

| Surface | Nguồn | Kích thước |
| ------- | ----- | ---------- |
| Header platform | `brand/vemoki/email-header.png` | **600×160** PNG |
| Template notification | DB `notification_template_versions.body_html` | HTML allowlist — **không** embed event banner trong code consumer; designer giữ header 600×160 nếu dùng ảnh tĩnh |

---

## 3. Bộ kích thước tối thiểu cần sản xuất

### 3.1 Mỗi **event** (public catalog + admin C-B)

| Asset | Slot API | Kích thước master | Định dạng | Dùng lại trên |
| ----- | -------- | ----------------- | --------- | ------------- |
| Banner | `bannerAssetId` | **1200×630** (khuyến nghị max **1600×840** nếu crop hero web/iOS) | JPEG/WebP ưu tiên (PNG nếu cần) | Web home, event hero, iOS list/detail/ticket, OG tương lai |
| Logo | `logoAssetId` | **760×200** lockup (hoặc **512×512** vuông + safe padding) | PNG/WebP nền trong | Web card/logo, iOS detail/wallet/ticket, admin brand |

**Tối đa 2 file raster / event** cho MVP media (1 logo + 1 banner) — dưới ngưỡng 20 asset/event.

### 3.2 Mỗi **org** (tenant)

| Asset | Slot API | Kích thước master | Ghi chú |
| ----- | -------- | ----------------- | ------- |
| Logo org | `tenants.logo_asset_id` / branding `logoAssetId` | **760×200** hoặc **512×512** | Hiện UI chủ yếu wordmark + `TenantLogo` khi có `logoUrl`; org **không** có banner riêng — banner theo từng event |

Org **prod-org-delta** (0 event) vẫn cần **logo org** cho branding API / chrome tương lai.

### 3.3 Checklist trước upload

- [ ] ≤ 5 MiB, ≤ 4096 px, ≤ 16M pixel  
- [ ] PNG / JPEG / WebP only  
- [ ] Banner safe area: không đặt text/logo quan trọng trong **~10%** mép (crop `cover`)  
- [ ] Logo: nền trong, đủ contrast trên paper `#F4F6F8`  

---

## 4. Map dataset prod (cập nhật khi BA push)

`docs/demo/PROD-SEED-DATASET.md` **chưa có**. Dùng placeholder cho **4 org** / **6 event** (phân bổ 1+2+3+0 theo Epic #686).

### 4.1 Organizations (placeholder)

| Org key | Tên giữ chỗ | `tenantSlug` (TBD) | Số event | Logo org | Ghi chú art |
| ------- | ----------- | ------------------ | -------- | -------- | ----------- |
| `prod-org-alpha` | Tổ chức Alpha (prod) | `TBD-alpha` | 1 | Bắt buộc | Accent xanh lá sâu · motif lưới sự kiện |
| `prod-org-beta` | Tổ chức Beta (prod) | `TBD-beta` | 2 | Bắt buộc | Accent teal · motif sóng âm |
| `prod-org-gamma` | Tổ chức Gamma (prod) | `TBD-gamma` | 3 | Bắt buộc | Accent tím than · motif đèn lồng |
| `prod-org-delta` | Tổ chức Delta (prod) | `TBD-delta` | 0 | Bắt buộc | Accent cam đất · motif đường chạy |

Khi BA publish dataset: thay cột slug/tên; giữ **org key** ổn định cho đường dẫn asset.

### 4.2 Events (placeholder)

| Event key | Tên giữ chỗ | Org | `eventSlug` (TBD) | Banner + logo |
| --------- | ----------- | --- | ----------------- | ------------- |
| `prod-event-01` | Sự kiện Alpha One | alpha | `TBD-e01` | Bộ §3.1 |
| `prod-event-02` | Sự kiện Beta Night | beta | `TBD-e02` | Bộ §3.1 |
| `prod-event-03` | Sự kiện Beta Day | beta | `TBD-e03` | Bộ §3.1 |
| `prod-event-04` | Sự kiện Gamma A | gamma | `TBD-e04` | Bộ §3.1 |
| `prod-event-05` | Sự kiện Gamma B | gamma | `TBD-e05` | Bộ §3.1 |
| `prod-event-06` | Sự kiện Gamma C | gamma | `TBD-e06` | Bộ §3.1 |

---

## 5. Art direction — 6 event + 4 org (palette, type, motif)

Ràng buộc chung: typography consumer = **Sora + Be Vietnam Pro** (không embed font vào PNG). Ảnh raster = photography/texture/gradient + motif; chữ marketing trong ảnh tối thiểu (UI render title). Mọi accent event `primaryColor` phải đọc được trên paper và không trùng signal platform `#E11D48` trừ CTA Vemoki.

### 5.1 Bảng org

| Org | `primaryColor` gợi ý | Palette ảnh | Motif | Kiểu chữ trong lockup |
| --- | -------------------- | ------------- | ----- | --------------------- |
| Alpha | `#1B4332` | Rừng tối + paper sáng | Lưới chấm pulse (echo Live Pulse) | Sans đậm, chữ hoa ngắn |
| Beta | `#0F766E` | Teal + mint | Sóng âm đồng tâm | Sans hẹp, title case |
| Gamma | `#4C1D95` | Tím than + hồng khói | Đèn lồng / halo | Display nhẹ một dòng |
| Delta | `#C2410C` | Cam đất + ink | Đường chạy / timeline | Sans geometric |

### 5.2 Bảng event (banner mood + logo)

| Event | Banner mood (1200×630) | Logo lockup (760×200) | `primaryColor` event |
| ----- | ------------------------ | ---------------------- | -------------------- |
| Alpha One | Ảnh không gian xanh, ánh sáng lọc | Mark org + tên sự kiện một dòng | `#245B47` |
| Beta Night | Gradient teal → ink, bokeh | Logo Beta monochrome trắng trên transparent | `#0D9488` |
| Beta Day | Sáng, texture giấy, silhouette đám đông | Logo Beta full color | `#14B8A6` |
| Gamma A | Tím + ánh đèn vàng | Gamma mark + subtitle nhỏ | `#6D28D9` |
| Gamma B | Tối, smoke, một vệt signal **nhỏ** (org accent, không Vemoki signal) | Lockup trắng | `#7C3AED` |
| Gamma C | Minimal paper + band màu gamma | Icon-only + wordmark | `#5B21B6` |

### 5.3 Anti-patterns (seed graphics)

1. Stock “conference crowd” generic với overlay text dài  
2. Logo viền trắng dày trên banner busy  
3. Banner portrait hoặc 1∶1 — sẽ bị crop mất chủ thể  
4. Upload SVG/HTML qua C-B  
5. Dùng terracotta / cream palette v1  

---

## 6. Gap / phụ thuộc Epic (cho BE & Web asset worker)

| # | Gap | Owner gợi ý |
| - | --- | ----------- |
| G1 | `PublishedBrand` chưa populate `logoUrl` / `bannerUrl` từ asset READY | Backend publish/projection |
| G2 | Public tenant branding chưa resolve `logoAssetId` → `logoUrl` | Backend + BFF |
| G3 | Web event hero chưa render `EventLogo` dù CSS `.event-logo-hero` sẵn | Web (optional polish) |
| G4 | Per-event OG image | Web/BE follow-up |
| G5 | `PROD-SEED-DATASET.md` | BA — cập nhật §4 |

---

## 7. DoD artifact PD (Epic #686 media task)

- [x] Audit surface web + iOS + platform + email header + admin upload  
- [x] Bảng `ASSET_LIMITS` và export tối thiểu / event + / org  
- [x] Art direction 6 event + 4 org bám `tokens.json` / Live Pulse  
- [x] Map placeholder + chờ `PROD-SEED-DATASET.md`  
- [x] Visual budget mục 0  
- [ ] Raster production — task riêng (Web/asset worker)  

**UAT sau khi có ảnh:** đối chiếu surface §2 trên staging prod seed; Playwright `event-banner` / `event-logo` test ids; iOS `pub-media-*` / `ticket-detail-banner`.
