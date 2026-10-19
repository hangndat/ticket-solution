# BA — Inventory i18n & phạm vi VI/EN (Issue #566)

| Trường | Giá trị |
| ------ | ------- |
| Issue | [#566](https://github.com/hangndat/ticket-solution/issues/566) |
| Role | `product-ba` · Kazu |
| Baseline SHA | `e828b137ce7052e83bcd7bd02a97f53d3071aacb` |
| Ngày | 2026-10-19 |
| Phạm vi đọc | `apps/web`, `apps/portal`, `apps/mobile` (chỉ inventory — **không** sửa code Task này) |
| Artifact | Chỉ `docs/design/i18n-audit/**` |

## 1. Tóm tắt điều hành

Vemoki áp dụng **chính sách lệch có chủ đích** giữa GTM và product: **marketing `vemoki.com` = VI+EN (O13)**, **product pilot (`app.`, portal staff, iOS attendee) = mặc định Tiếng Việt (O04)**. Portal đã ship **catalog VI+EN đối xứng (637 key)** + switch locale (P2 / #517); marketing dùng dictionary O13 (**116 key** VI+EN). **Product web và iOS** vẫn **hardcode / module copy VI** — không locale switch, không EN catalog — khớp O04 và handoff [ux-ui-revamp](../ux-ui-revamp/README.md) (copy khách **plain Tiếng Việt**).

Wave fix gần: **P0** giữ parity marketing + portal (test/`<html lang>`/metadata); **P1** chuẩn hóa product web attendee (dictionary nội bộ, chưa bật EN UI); **P2** defer EN attendee (web/iOS), email template EN, legacy `/admin` trên `app.`.

**Default locale (toàn platform):** `vi`. **EN additive** chỉ nơi đã chốt: marketing apex + portal staff (O17 §6).

---

## 2. Đối chiếu quyết định & design

| Nguồn | i18n liên quan | Ảnh hưởng inventory |
| ----- | -------------- | --------------------- |
| **O04** ([DECISION-LOG](../../DECISION-LOG.md)) | UI/email pilot **mặc định VI**; form schema versioned sẵn mở locale | Product + mobile **VI-only** là đúng policy, không phải “thiếu ngẫu nhiên” |
| **O13** §6 | Marketing **VI và EN**; product pilot VI trừ task riêng | Giải thích **có EN** sales/privacy/support; **không EN** redeem/home |
| **O16** | Portal Ant Design **VI trước**; admin tách `portal.` | Staff chrome ban đầu VI; EN là P2 additive |
| **O17** §6 | Portal EN **additive**, mặc định VI (O04) | Catalog EN + switch — in-scope Epic #491 |
| [copy-vi-en.md](../o13-platform-sales/copy-vi-en.md) | SoT string marketing | Map 1:1 `apps/web/src/marketing/copy.ts` |
| [PORTAL-P2-UX.md](../PORTAL-P2-UX.md) §PS3, §1.4 | Switch Tài khoản → Ngôn ngữ; fallback VI nếu thiếu key; `lang` + AntD locale | Portal implementation target |
| [PORTAL-ANTD-UX.md](../PORTAL-ANTD-UX.md) §10 | `ConfigProvider` `vi_VN` / `en_US` | Đã wire trong `apps/portal/src/components/providers.tsx` |
| [ux-ui-revamp](../ux-ui-revamp/README.md) §2 | State copy gợi ý **Tiếng Việt** attendee | **OUT** EN cho 4 priority screens revamp đợt #471 |
| [o13-marketing-app-subdomain.md](../../architecture/o13-marketing-app-subdomain.md) | Apex = sales + legal + i18n; `app.` = product | Host quyết định **trang nào** có locale path |

**Vì sao “có trang có / có trang không”:** quyết địch **audience** (buyer GTM vs attendee/staff) và **host** (apex vs `app.` vs `portal.`), không phải thiếu đồng bộ kỹ thuật đơn thuần.

---

## 3. Mô hình kỹ thuật (snapshot SHA baseline)

| Surface | Cơ chế | Locale | Default |
| ------- | ------- | ------ | ------- |
| Marketing web | `MarketingLocale` + `t()` — `apps/web/src/marketing/copy.ts` | `vi` \| `en` | `vi` (path `/`); EN path `/en/...` |
| Portal | `PortalLocale` + `messages.ts` + `usePortalLocale()` — Issue #517 | `vi` \| `en` | `vi` (`DEFAULT_PORTAL_LOCALE`) |
| Product web | String/module TS rải rác + `PUBLIC_EVENT_COPY`, `redeem/messages.ts`, `gate/*`, `platform/*` | Không | VI implicit |
| iOS | `*-copy.ts`, `a11y/announcements.ts` | Không | VI implicit |

---

## 4. Bảng inventory — Marketing web (`vemoki.com` / O13)

Host routing: apex marketing only (product path redirect `app.`). Dictionary: **116 keys × VI+EN** ([copy.ts](../../../apps/web/src/marketing/copy.ts)).

| Route / màn | Locale support | Kiểu | Ghi chú |
| ----------- | -------------- | ---- | ------- |
| `/` (sales) | **VI+EN dictionary** | Path `vi` implicit + `LocaleSwitch` | `SalesPage` + `t(locale, key)` |
| `/en` (sales EN) | **VI+EN dictionary** | Path `en` | Metadata EN SSR |
| `/privacy` | **VI+EN dictionary** | VI path | `PrivacyPage` |
| `/en/privacy` | **VI+EN dictionary** | EN path | |
| `/support` | **VI+EN dictionary** | VI path | `SupportPage` |
| `/en/support` | **VI+EN dictionary** | EN path | |
| Marketing layout chrome | **VI+EN dictionary** | `MarketingChrome`, `LocaleSwitch` | `lang` via `MarketingHtmlAttrs` |
| Form quan tâm API | N/A (server) | — | Copy lỗi/thành công trong dictionary `interest.*` |

**Gap P0:** headless UAT T13 (O13) — verify `/` và `/en` 200; không gap dictionary đã biết trên SHA baseline.

---

## 5. Bảng inventory — Product web (`app.vemoki.com`)

**Policy:** VI-only (O04). **Không** locale switch. Revamp UX/UI (#471) giữ copy VI.

| Route / màn | Locale support | Kiểu | Ghi chú |
| ----------- | -------------- | ---- | ------- |
| `/` Home catalog | **VI-only hardcode** + `PUBLIC_EVENT_COPY` | Mixed central + inline | Hero/CTA inline VI; empty/error dùng `published` copy module |
| `/redeem` | **VI-only** | `apps/web/src/redeem/messages.ts` | Outcome/decision plain VI |
| `/claim` | **VI-only hardcode** | Component strings | Guest claim flow |
| `/gate` | **VI-only** | `gate-outcome-copy.ts`, `offline-messages.ts` | Staff scan web (G1) |
| `/invite` | **VI-only hardcode** | `invite-accept.tsx` | |
| `/account` | **VI-only hardcode** | `account-panel`, `session-panel` | Xóa tài khoản copy VI |
| `/t/[tenantSlug]/events/[eventSlug]` | **VI-only** | Page + published content | Tên sự kiện = data server (không dịch) |
| `/t/.../tickets/...` | **VI-only** | Ticket UI | |
| `/admin` (legacy) | **VI-only hardcode** | `admin-form.tsx` (~2k LOC) | Dual-run; parity chuyển **portal** — không ưu tiên i18n admin legacy |
| `/platform` | **VI-only** | `platform-console.tsx`, `invite-messages.ts` | Operator zone |
| `/auth` | Redirect | — | Không UI copy (ux-ui-revamp) |
| `loading.tsx`, `not-found`, `error` | **VI-only** | Global | |
| Site chrome `SiteNav` | **VI-only** | `site-chrome` | Không marketing switch |

**Gap P1 (chất lượng, chưa bật EN):** gom copy attendee vào một catalog nội bộ (pattern portal/marketing) để revamp #471 không rải string; vẫn **không** expose EN UI đến khi product task riêng.

**Defer P2:** EN product web attendee; đồng bộ với App Store locale nếu mở.

---

## 6. Bảng inventory — Portal (`portal.vemoki.com`)

Dictionary: **637 keys** VI = EN parity (`apps/portal/src/i18n/messages.ts`, test `apps/portal/tests/i18n.test.ts`). Switch: `PortalShell` → Tài khoản → Ngôn ngữ. AntD: `vi_VN` / `en_US` (`providers.tsx`).

| Route / màn | Locale support | Kiểu | Ghi chú |
| ----------- | -------------- | ---- | ------- |
| `/auth` | **VI+EN dictionary** | `t()` | OIDC errors keyed |
| `/` home redirect | **VI+EN dictionary** | `t()` | |
| `/onboarding`, `/onboarding/[tenantId]` | **VI+EN dictionary** | PENDING copy | PS5 |
| `/t/[tenantId]` org overview | **VI+EN dictionary** | | |
| `/t/[tenantId]/events`, `/events/new` | **VI+EN dictionary** | Wizard | |
| `/t/[tenantId]/analytics` | **VI+EN dictionary** | O12 labels EN/VI | PS1 |
| `/t/[tenantId]/members` | **VI+EN dictionary** | Presets PS4 | |
| `/t/[tenantId]/settings` | **VI+EN dictionary** | | |
| `/t/.../e/[eventId]` (+ setup, guests, gate, config, quota, sources, support, audit, types) | **VI+EN dictionary** | 22/23 page dùng `usePortalLocale` | |
| `/platform` (operator) | **VI+EN dictionary** | | |
| `/account/security` | **VI+EN dictionary** | | Label `"Cookie"` hardcode EN — **P2** cosmetic |
| Root `layout.tsx` | **Partial** | `html lang="vi"` cố định; metadata VI | **P0:** `lang` theo locale; metadata EN **P1** |
| `layout.tsx` (root) | Provider only | Không `t()` | Expected |

**Gap P0:** `<html lang>` không đổi khi staff chọn EN (PORTAL-P2-UX § a11y) — fix portal web.

**Gap P1:** document title/description EN khi locale EN.

**Không gap dictionary:** parity test CI đã cover missing EN → fallback VI.

---

## 7. Bảng inventory — Mobile iOS (`apps/mobile`)

**Policy:** VI-only (O04, O02 staff cùng app). Không `MarketingLocale` / `PortalLocale`.

| Màn / route (`src/app`) | Locale support | Kiểu | Ghi chú |
| ----------------------- | -------------- | ---- | ------- |
| `(tabs)/(events)/` Events home | **VI-only** | `screen-state-copy.ts` → `eventsCopy` | |
| `(tabs)/my-tickets`, `[ticketId]` | **VI-only** | `walletCopy` + ticket UI | Primary ví |
| `redeem.tsx` | **VI-only** | `redeemCopy`, `attendee-outcome-copy.ts` | |
| `claim.tsx` | **VI-only** | Claim screens | |
| `events/[tenantSlug]/[slug].tsx` | **VI-only** | Event detail | Published server content |
| `membership-invite.tsx` | **VI-only** | | |
| `staff-access.tsx` + `(tabs)/staff/` Gate | **VI-only** | `gate-outcome-copy.ts`, `scanCopy` | Staff mode O02 |
| Account / deletion | **VI-only** | `account-deletion-copy.ts` | |
| Push / notifications UI | **VI-only** | `push-status.tsx` | Payload server — ngoài scope UI catalog |
| `a11y/announcements.ts` | **VI-only** | VoiceOver strings | |

**Defer P2:** EN iOS (App Store secondary locale ≠ in-app switch); giữ ASC metadata EN (D10) tách khỏi in-app UI.

---

## 8. Ngoài bảng (awareness, không user surface Task #566)

| Hạng mục | Locale | Ghi chú |
| -------- | ------ | ------- |
| Email worker / SMTP template | **VI pilot** (O04) | Task BE/worker riêng |
| Push notification body | Server/worker | UI app chỉ hiển thị |
| Nest API error codes | Opaque / EN kỹ thuật | Client map sang VI |
| Form field labels (versioned JSON) | Theo event config | Locale field schema — chưa productize EN |

---

## 9. Đề xuất ưu tiên

### P0 — đợt gần (policy đã chốt, rủi ro a11y/parity)

| # | Hạng mục | Owner đề xuất |
| - | -------- | ------------- |
| P0-1 | Portal: `<html lang>` + (tuỳ chọn) `dir` sync với `usePortalLocale` | **web** (`apps/portal`) |
| P0-2 | Marketing: giữ CI/playwright T13 `/` + `/en` + legal paths | **web** (đã có — revalidate UAT) |
| P0-3 | Portal: không regress `apps/portal/tests/i18n.test.ts` trên PR touch `messages.ts` | **web** + **coordinator** CI |

### P1 — chuẩn bị scale copy (vẫn VI default UI)

| # | Hạng mục | Owner đề xuất |
| - | -------- | ------------- |
| P1-1 | Product web: catalog nội bộ `apps/web/src/i18n/` (hoặc tương đương) gom `PUBLIC_EVENT_COPY`, redeem/gate/account — **chưa** switch EN | **web** |
| P1-2 | Portal: metadata `title`/`description` theo locale | **web** (`apps/portal`) |
| P1-3 | iOS: align key naming với web catalog where shared flows (redeem/wallet) | **ios** |
| P1-4 | ux-ui-revamp implement: mọi string mới đi qua catalog VI (AC trong artifact revamp) | **web** ∥ **ios** |

### P2 — defer

| # | Hạng mục | Lý do defer |
| - | -------- | ----------- |
| P2-1 | EN UI `app.vemoki.com` attendee | O04 + không AC buyer; mở khi có task product riêng |
| P2-2 | EN UI iOS in-app | Cùng policy attendee |
| P2-3 | i18n legacy `/admin` trên `app.` | Sunsetting → portal |
| P2-4 | Email template EN | O04 pilot VI |
| P2-5 | Portal label hardcode rời (`Cookie`, v.v.) | Cosmetic |

---

## 10. Non-goals (Issue #566 / O10)

- Android native locale.
- Payment / refund copy đa ngôn ngữ.
- Portal ↔ app **shared** locale cookie (host-only invariant ADR-20).
- Dịch nội dung sự kiện do tenant publish (brand/event name giữ nguyên).
- Tự động dịch form dynamic JSON.
- Merge catalog portal với marketing (audience khác).

---

## 11. Acceptance criteria — wave fix i18n (Given / When / Then)

Dùng cho Task coding sau #566; default locale luôn **VI** trừ khi AC nói rõ EN.

### AC-MKT-1 (Marketing parity O13)

- **Given** host apex marketing và dictionary `copy.ts` đủ key  
- **When** user mở `/`, `/en`, `/privacy`, `/en/privacy`, `/support`, `/en/support`  
- **Then** mỗi URL 200; copy khớp locale path; `LocaleSwitch` đổi path VI↔EN; không raw key.

### AC-POR-1 (Portal switch)

- **Given** staff đã đăng nhập portal  
- **When** chọn English trong Tài khoản → Ngôn ngữ  
- **Then** chrome nav + trang hiện tại dùng EN catalog; AntD widgets EN; refresh giữ preference (`localStorage`); default lần đầu VI.

### AC-POR-2 (Portal a11y locale)

- **Given** locale EN đang active  
- **When** render bất kỳ trang portal  
- **Then** `<html lang="en">`; khi VI → `lang="vi"`.

### AC-POR-3 (Missing key fail-closed)

- **Given** key không tồn tại hoặc EN rỗng  
- **When** gọi `t('en', key)`  
- **Then** staff thấy bản VI (không blank, không raw key prod); dev warn.

### AC-PRD-1 (Product VI default)

- **Given** user mở `app.` redeem/home/ví web  
- **When** không có query locale  
- **Then** toàn bộ chrome/outcome **Tiếng Việt**; không hiện switch EN.

### AC-PRD-2 (Catalog refactor — P1)

- **Given** PR gom copy product web  
- **When** chạy test/UAT redeem + home states  
- **Then** copy không đổi nghĩa so với baseline VI; không thêm EN UI.

### AC-IOS-1 (Mobile VI)

- **Given** build iOS attendee  
- **When** duyệt Events / Redeem / Ví / Gate staff  
- **Then** copy tiếng Việt; announcements a11y VI.

---

## 12. Map ownership Task sau (không spawn)

| Task đề xuất | Owner | Phụ thuộc |
| ------------ | ----- | --------- |
| Portal `lang` + metadata locale | **web** (`apps/portal`) | AC-POR-2 |
| Marketing UAT revalidate T13 | **web** | AC-MKT-1 |
| Product web copy catalog (VI) | **web** (`apps/web`) | AC-PRD-2, Epic #471 |
| iOS copy align + a11y | **ios** (`apps/mobile`) | AC-IOS-1, Epic #471 |
| CI gate `i18n.test.ts` / marketing e2e | **coordinator** | P0-3 |
| EN attendee (web/iOS) — **chỉ khi mở scope** | **web** + **ios** + BA AC mới | P2 — O04 change |

---

## 13. Evidence lệnh (baseline SHA)

```bash
# Portal catalog parity
node --import tsx --test apps/portal/tests/i18n.test.ts

# Đếm key (snapshot)
# VI/EN portal: 637 keys mỗi locale (messages.ts)
# Marketing CopyKey: 116 keys (copy.ts)
```

---

*Tài liệu BA — handoff coordinator / Epic planner. PD artifact song song không ghi đè file này.*
