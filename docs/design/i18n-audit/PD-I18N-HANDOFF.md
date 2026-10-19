# PD handoff — i18n / locale UX (Issue #566)

**Persona:** Liv · pd  
**Issue:** [#566](https://github.com/hangndat/ticket-solution/issues/566)  
**Visual budget:** Không — dùng token hiện hành (`brand/vemoki/tokens.json`, font portal/web/mobile đã chốt); không redesign brand.  
**BA artifact:** Chưa có `BA-*.md` trong `docs/design/i18n-audit/` tại thời điểm handoff — inventory dưới đây lấy từ code; giả định nghiệp vụ redeem/portal giữ nguyên copy VI hiện có, EN là bản dịch parity (portal đã có test parity).

**Mục tiêu đợt:** Thống nhất *cách* user đổi locale và *cách* UI xử lý loading / thiếu key / mixed language trên **3–5 surface ưu tiên**, không i18n toàn app một lần.

---

## 0. Tóm tắt inventory (đọc code — không chờ BA)

| Surface | Path / mechanism | Locale | Switcher | `lang` / a11y |
| ------- | ---------------- | ------ | -------- | ------------- |
| Marketing (apex) | `apps/web/src/marketing/*`, route `/` · `/en` · legal | `vi` \| `en` | `LocaleSwitch` — link đổi path | `MarketingHtmlAttrs` + middleware header `x-vemoki-locale` |
| Portal (organizer) | `apps/portal/src/i18n/*` | `vi` \| `en`, default **VI** | Account menu → Ngôn ngữ → VI \| EN | Cookie + `localStorage` `vemoki_portal_locale`; `document.documentElement.lang` sau hydrate |
| Product web (attendee) | `apps/web/app/redeem`, `src/redeem/messages.ts`, `site-chrome` | **VI hardcode** | **Không** | Root `apps/web/app/layout.tsx` `lang="vi"` cố định |
| iOS (attendee + staff) | `apps/mobile/src/**/**-copy.ts`, screens | **VI hardcode** | **Không** | Chưa có layer locale; copy tập trung file `*-copy.ts` |
| API / server messages | Contracts + mapped UX | Theo caller | — | — |

**Redeem copy:** `apps/web/src/redeem/messages.ts` — toàn bộ title/detail tiếng Việt; map mã lỗi contract → UX tiếng Việt. Trang `apps/web/app/redeem/page.tsx` metadata + H1 + intro + nút VI.

**Portal i18n chất lượng:** Catalog `messages.ts` ~1900 dòng; test `apps/portal/tests/i18n.test.ts` bắt parity VI/EN, fallback EN→VI, unknown key `[VI] <key>`, không leakage VI trong EN (trừ `locale.vi`).

**Khoảng trống cross-surface (cố ý ghi để wave sau không “fix ngầm”):**

1. User đọc marketing **EN** (`vemoki.com/en`) rồi bấm Đăng nhập → `app.vemoki.com` **không** đọc locale marketing (path-based vs cookie portal).
2. Portal EN + product web VI trên cùng origin `app.vemoki.com` nếu user chỉ dùng `/redeem` — không có switcher product web.
3. Mobile không đồng bộ pref với portal cookie (chưa có pref).

---

## 1. User flow — đổi locale

### 1.1 Persona: Khách / Attendee (marketing + redeem)

```mermaid
flowchart LR
  subgraph mkt [Marketing apex]
    A[Land / hoặc /en] --> B{LocaleSwitch}
    B -->|VI link| C[/ path VI]
    B -->|EN link| D[/en path EN]
  end
  subgraph prod [Product app.vemoki.com]
    E[Login / Redeem / Wallet web] --> F[UI VI only hiện tại]
  end
  D -->|loginHref product| E
  C -->|loginHref product| E
```

| Bước | Hành vi mong muốn (PD) | Hiện trạng code |
| ---- | ------------------------ | --------------- |
| M1 | Trên marketing, đổi VI↔EN **giữ trang** (sales / privacy / support) và **hash** (vd. `#interest`) | Đúng — `localeSwitchHref` + `LocaleSwitch` |
| M2 | Sau đổi locale marketing, `<html lang>` khớp `vi` hoặc `en` | Client `MarketingHtmlAttrs` |
| M3 | CTA sang product (đăng nhập, demo, redeem) **không** hứa ngôn ngữ product khác marketing | Product luôn VI — cần copy expectation (xem §3) |
| M4 | Redeem: một ngôn ngữ nhất quán end-to-end (form, lỗi, polling) | VI only — OK cho wave 1 nếu chốt default VI |

**Nhánh lỗi / hủy (marketing):** Đổi locale không submit form; interest form validation copy theo locale trang (`copy.ts`).

### 1.2 Persona: Event Manager / staff portal

```mermaid
flowchart TD
  P[Portal load] --> H{Hydrate locale}
  H -->|SSR/first paint| VI[Default VI]
  H -->|cookie/localStorage| L[Stored vi/en]
  L --> S[Shell Account menu]
  S --> T[Chọn Tiếng Việt hoặc English]
  T --> U[Persist cookie + localStorage]
  U --> V[document.lang + toàn shell t()]
```

| Bước | Hành vi mong muốn | Hiện trạng |
| ---- | ----------------- | ---------- |
| P1 | Pref lưu qua reload/tab mới (AC-C1) | `writeStoredPortalLocale` |
| P2 | Switch **không** logout, **không** đổi route | Menu onClick `setLocale` |
| P3 | Toàn vùng shell + trang đã wired `usePortalLocale` / `t(locale,…)` đổi ngay | Phần lớn portal ops/prep/nav — xem gap implementer |

**Nhánh denied:** Không áp locale lên quyền API; chỉ copy UI.

### 1.3 Persona: Attendee iOS

| Bước | PD wave sau (chưa implement) | Hiện trạng |
| ---- | ---------------------------- | ---------- |
| I1 | Locale mặc định **VI**; tùy chọn EN trong Settings (hoặc theo system `expo-localization` — **quyết định wave iOS**, không chốt trong đợt web/portal) | Không có switch |
| I2 | Copy ví / redeem / events dùng catalog thay literal rải rác | Đã gom `screen-state-copy.ts`, `gate-outcome-copy.ts`, v.v. — tiếng Việt |

### 1.4 Điểm chạm web vs iOS (cùng nghiệp vụ)

| Nghiệp vụ | Web product | iOS |
| --------- | ----------- | --- |
| Đổi mã | `/redeem` + `messages.ts` | `screens/redeem.tsx` + redeem copy |
| Ví vé | (web hạn chế) | `my-tickets.tsx` + `walletCopy` |
| Cổng scan | — | `staff.tsx` + `scanCopy` |

**Chính sách đợt 1:** Parity *nghĩa* (cùng state machine UX), không bắt buộc parity *ngôn ngữ* cho đến khi mobile có catalog EN.

---

## 2. Trạng thái giao diện (locale UX)

Chi tiết matrix theo surface: [`states.md`](./states.md).

Tóm tắt policy:

| State | Khi nào | UI / copy |
| ----- | ------- | --------- |
| **locale_loading** (portal) | First client paint trước `hydrated` | Giữ default VI; **không** flash EN→VI nếu stored=VI (đã đúng); **có thể** flash VI→EN nếu stored=EN — implementer wave portal polish: suppress visible swap hoặc inline script đọc cookie trước paint (không redesign) |
| **locale_ready** | Sau hydrate / marketing layout | `lang` attribute khớp locale active |
| **missing_key** (portal) | Key thiếu EN | Fallback VI; dev warn; prod không blank |
| **unknown_key** (portal) | Key không trong catalog | `[VI] <key>` — **không ship** user-facing unknown keys |
| **mixed_language** | EN locale + fallback VI string lẫn EN | Portal: chỉ khi thiếu EN — test chặn leakage; product: tránh chèn EN trong body VI (API message raw) |
| **marketing_only_en** | User EN marketing, product VI | Hiển thị product VI nhất quán; optional future: banner “Giao diện quản trị / đổi mã hiện tiếng Việt” — **out of scope** đợt 1 trừ AC ghi nhận |

Redeem-specific (product web): giữ phân tách `success` \| `pending` \| `unknown` \| `verifying` — copy đã tiếng Việt trong `messages.ts`; khi thêm EN sau này, **cùng kind**, không đổi semantics.

---

## 3. Copy policy

### 3.1 Ngôn ngữ mặc định

- **VI** là default cho portal, product web, mobile, marketing path `/`.
- **EN** là additive (marketing path `/en…`, portal menu).

### 3.2 Quy tắc dịch

| Quy tắc | Portal | Marketing | Product web / mobile (khi có i18n) |
| ------- | ------ | --------- | ----------------------------------- |
| Parity key | 1:1 key `MessageKey` | 1:1 `CopyKey` | Đề xuất reuse namespace redeem + shell chung |
| Placeholder | `{{var}}` giữ tên biến | Giữ | Giữ |
| Locale names | `locale.vi` / `locale.en` native | `nav.locale.vi` / `.en` | Giữ native |
| API / mã lỗi | Map code → catalog; không show raw code cho user | — | `messageForApiError` |
| Forbidden claims | — | `FORBIDDEN_COPY_PATTERNS` | Không copy marketing claim sang redeem |

### 3.3 Tone

- Portal EN: operational, concise (đã test no VI chars in EN).
- Redeem / attendee: cảnh báo rõ **chưa phải vé** khi pending/unknown — bất kể locale sau này.

### 3.4 Anti-patterns (bắt buộc tránh)

1. **Locale switch chỉ marketing** trong khi portal/user path khác ngôn ngữ **không có cách đổi** hoặc không nói rõ — gây “EN site, VI app”.
2. **Hardcode EN** trong trang default VI (nav aria, metadata) khi user chọn VI.
3. **Hardcode VI** trong trang EN marketing / portal EN (leakage).
4. **Flash sai locale:** `<html lang="en">` một frame rồi VI (portal SSR `lang="vi"` + client EN).
5. **Mixed trong một câu:** tiêu đề EN + detail fallback VI không đánh dấu — portal phải hoàn thiện EN catalog trước khi quảng bá EN portal.
6. **Đổi locale = navigation marketing** trên product host — product chưa có URL locale; không fake `/en/redeem` nếu chưa implement routing.

---

## 4. Accessibility

| Hạng mục | Marketing | Portal | Product web (đợt 1) |
| -------- | --------- | ------ | ------------------- |
| `html lang` | `MarketingHtmlAttrs` | Client update; SSR `vi` — xem flash | Cố định `vi` |
| Switcher | `role="group"`, `aria-label`, `aria-current` trên locale active | Submenu Ant Design — cần accessible name từ `t('locale.label')` | N/A đợt 1 |
| Focus | Link VI \| EN keyboard reachable | Menu keyboard theo Ant Design | — |
| Screen reader | Đổi locale = navigation (marketing) / menu (portal) | Announce language change **không bắt buộc** đợt 1; không silent mixed lang | Nav `aria-label` VI |
| Contrast / motion | Token hiện hành | Token Ant Design portal | Token web |

**Manual vs automated:** Parity `lang` + switcher `aria-current` → Playwright; leakage EN/VI → `apps/portal/tests/i18n.test.ts` (mở rộng khi thêm surface).

---

## 5. Priority surfaces (3–5 màn / shell)

| # | Surface | Lý do | Owner wave |
| - | ------- | ----- | ---------- |
| 1 | **Marketing sales + `LocaleSwitch`** | Canonical pattern URL locale + a11y | `apps/web` marketing |
| 2 | **Portal shell + account language submenu** | Organizer EN/VI đã ship; polish hydrate/flash | `apps/portal` |
| 3 | **Redeem (`/redeem` + messages)** | Attendee critical path; nhiều state | `apps/web` |
| 4 | **Portal auth + onboarding** | First-run; đã `usePortalLocale` | `apps/portal` |
| 5 | **iOS wallet + redeem screens** | Copy đã gom; thiếu EN layer | `apps/mobile` |

**Non-goals đợt 1:** Admin web sâu, gate scanner iOS EN, đồng bộ cookie marketing↔product, Android.

---

## 6. Tiêu chí nghiệm thu (UI) — implementer web / portal / iOS

### 6.1 Marketing

- **AC-M1:** Given path `/`, When user bấm EN trên `LocaleSwitch`, Then URL `/en` (hoặc `/en/privacy` tương ứng) và `document.documentElement.lang === 'en'`.
- **AC-M2:** Given hash `#interest`, When đổi locale, Then hash preserved (`localeSwitchHref`).
- **AC-M3:** Given locale EN, When đọc sales hero, Then không có chuỗi tiếng Việt (trừ proper noun Vemoki).

### 6.2 Portal

- **AC-P1:** Given stored `vemoki_portal_locale=en`, When reload portal, Then menu account và nav chính hiển thị EN (`t('en', …)`).
- **AC-P2:** Given user chọn English trong submenu, When không reload, Then `document.documentElement.lang === 'en'` và cookie set.
- **AC-P3:** Given locale EN, When key tồn tại EN, Then không hiển thị chuỗi VI (test leakage hiện có).
- **AC-P4:** Given unknown key (dev only), Then `[VI] key` — không production catalog gap.

### 6.3 Product web — redeem (VI consistency đợt 1)

- **AC-R1:** Given `/redeem`, Then H1 + intro + `messages.ts` outcomes cùng ngôn ngữ VI (không đoạn EN lẫn).
- **AC-R2:** Given outcome `unknown`, Then copy có hướng dẫn «Kiểm tra lại» khớp `unknownMessage`.
- **AC-R3:** `html lang` root layout `vi` trên redeem.

### 6.4 iOS (chuẩn bị catalog — có thể wave riêng)

- **AC-I1:** Given build hiện tại, Then `screen-state-copy` strings tiếng Việt trên wallet empty/loading.
- **AC-I2 (future):** When EN locale enabled, Then không mixed trong một `Notice` title/body.

### 6.5 UAT mapping

| AC | Gợi ý check |
| -- | ----------- |
| M1–M3 | Marketing UAT / Playwright `data-testid` privacy/sales |
| P1–P2 | `portal-locale-en` / `portal-locale-vi` testid |
| R1–R3 | `scripts/web-uat.sh` redeem path |
| I1 | `scripts/sim-uat.sh` wallet |

---

## 7. Hướng dẫn triển khai

### 7.1 Thứ tự đề xuất (sau handoff)

1. **Portal:** Giảm locale flash (cookie read sớm hoặc `suppressHydrationWarning` có kiểm soát) — không đổi vị trí switcher.
2. **Product web:** Tách redeem + shell strings vào module i18n (pattern portal `t` / marketing `copy`) — **EN optional wave 2**.
3. **Cross-surface:** Document login CTA; optional query `?lang=en` **chỉ khi** coordinator chốt contract — **không implement trong task PD**.
4. **iOS:** `MobileLocaleProvider` + migrate `*-copy.ts` → dict EN parity — wave iOS.

### 7.2 Contract phụ thuộc

- Không cần BE locale schema đợt 1 (portal wave-1 comment: no BE schema).
- API error `message` tiếng Anh từ upstream: product web phải map qua `messageForApiError`, không render raw vào UI VI.

### 7.3 Good enough MVP

- Marketing + Portal EN/VI ổn định, không leakage, không flash gây hiểu nhầm.
- Redeem + mobile **VI nhất quán**; EN attendee là enhancement có AC riêng wave sau.

### 7.4 Freeze

Implementer **không** invent visual switcher mới ngoài `LocaleSwitch` / portal account submenu; thiếu token copy → escalate coordinator.

---

## 8. Tham chiếu code (inventory)

| Mục | Path |
| --- | ---- |
| Portal provider | `apps/portal/src/components/providers.tsx` |
| Portal switcher | `apps/portal/src/components/portal-shell.tsx` (account → language) |
| Portal t / fallback | `apps/portal/src/i18n/t.ts` |
| Marketing switch | `apps/web/src/marketing/locale-switch.tsx` |
| Marketing copy | `apps/web/src/marketing/copy.ts` |
| Redeem UX messages | `apps/web/src/redeem/messages.ts` |
| Redeem page copy | `apps/web/app/redeem/page.tsx` |
| Mobile copy hub | `apps/mobile/src/components/screen-state-copy.ts` |
| i18n tests | `apps/portal/tests/i18n.test.ts` |

---

*Artifact PD cho wave implementer; cập nhật khi BA publish inventory hoặc khi chốt cross-surface locale contract.*
