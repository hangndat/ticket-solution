# BA — Luồng khách (guest) app iOS production

**Ngày:** 2026-10-19\
**Nguồn:** User authority (Orca task) · working tree `apps/mobile` (chưa commit) · PRD/ROADMAP/D11\
**Role:** `product-ba` · **Architecture impact:** Không · **Không mở rộng MVP**

**Trạng thái artifact:** Nghiên cứu + AC/handoff — **không** code complete, **không** acceptance complete, **không** UAT/pilot ready.

---

## 1. Problem / outcome

| | |
| --- | --- |
| **Persona** | Attendee (khách) trên app Vemoki production — xem sự kiện, đổi mã, ví vé |
| **Outcome** | Khách **thấy** đầy đủ IA (tab Vé của tôi luôn hiện), hiểu cần đăng nhập để dùng ví/đổi mã; đăng nhập **từ ngữ cảnh** redeem/claim rồi **quay lại tác vụ**; không trang chết; không control demo đổi tổ chức trên production |
| **Pain hiện tại (WT)** | Tab ví **ẩn** khi anonymous; deep tab ví **redirect** sang Sự kiện; redeem/claim chỉ copy «vào Tài khoản» — không auth gate CTA; Sự kiện có thể báo «Chưa sẵn sàng tải sự kiện» khi thiếu slug tenant dù API đã bake |

---

## 2. In / out of scope

| In scope (đợt này) | Out of scope |
| --- | --- |
| Hành vi anonymous / verified / offline-display / logout / revoked (UI app) | Đổi contract API, OTP/magic link (UX-11 đã chốt Keycloak) |
| Auth intent + return (`/redeem`, `/claim`, ví) | Android, payment, Wallet pass, seat map |
| Native tab **disabled** vs **hidden** (SDK 58) | Submit App Store / deploy prod |
| Truy vết guard danh sách sự kiện (`events.tsx`) — **copy giữ nguyên** | Thêm tab staff / đổi 3 tab Nhập tay \| Scan \| Lịch sử |
| Bỏ demo/debug «Đổi tổ chức» (nếu còn sót) | Multi-tenant catalog trong một binary (chỉ ghi nhận gap cấu hình) |

---

## 3. Findings (working tree — file dẫn chứng)

### 3.1 Tab «Vé của tôi» — hidden ≠ disabled (lệch user authority)

| Layer | Hành vi WT | File |
| --- | --- | --- |
| Policy | `showMyTicketsTab` = attendee chrome **and** `hasWalletAccess` (verified **or** offline bound). Comment: «Anonymous guests never see the tab (hidden, not faux-disabled).» | `src/navigation/attendee-wallet-access.ts` |
| Tab bar | `NativeTabs.Trigger name="my-tickets" hidden={!myTicketsTab}` | `src/app/(tabs)/_layout.tsx` |
| Tab route | `!canAccess` → `<Redirect href="/(tabs)/(events)" />` — khách không vào stack ví | `src/app/(tabs)/my-tickets/index.tsx` |
| Screen | `!canAccess` → `WalletAccessNotice` (không nút đăng nhập; «Đăng nhập trong tab Tài khoản») | `src/screens/my-tickets.tsx`, `src/components/wallet-access-notice.tsx` |
| Tests | Assert tab hidden cho anonymous | `src/navigation/attendee-wallet-access.test.ts` |

**User authority:** Tab **luôn hiện** cho attendee; trạng thái **disabled** khi chưa đăng nhập (không hide). Nội dung tab = trạng thái chặn + hướng dẫn (PD chốt visual disabled).

### 3.2 Đăng nhập — một nút standalone ở Tài khoản; context redeem/claim auth gate

| Surface | WT | Gap vs authority |
| --- | --- | --- |
| **Tài khoản** | Nút «Đăng nhập» khi chưa verified; sau login `consumeSignInReturn()` → `router.replace` path đã park | `src/screens/account.tsx`, `src/navigation/sign-in-return-intent.ts` |
| **Redeem** | Park return `/redeem` + `redeem-draft-intent` khi anonymous; **không** CTA đăng nhập — chỉ `redeemCopy.authRequiredBody` | `src/screens/redeem.tsx`, `src/components/screen-state-copy.ts` |
| **Claim** | Park `/claim` + `claim-intent`; submit disabled khi `needsLogin`; **không** CTA đăng nhập | `src/screens/claim.tsx` |
| **Sự kiện CTA** | `router.push('/redeem')` — không kick auth | `src/screens/events.tsx` |
| **Helper** | `goToAccountForSignIn(returnPathname?)` park return rồi `router.push('/account')` | `src/navigation/go-to-account-sign-in.ts` |

**Đọc nghiệp vụ (không đổi contract):** «Chỉ nút login standalone ở Tài khoản» = **không** thêm nút «Đăng nhập» thứ hai trên tab Tài khoản; **context action** (Đổi mã / Nhận vé mời / CTA tương đương) **gọi cùng luồng OIDC** với `parkSignInReturn` trước khi mở Account **hoặc** mở Account với return đã park — sau verify quay `/redeem` \| `/claim` (đã có allow-list). Tránh trang chỉ có copy, không CTA.

**Đã có hạ tầng (code complete slice):** `sign-in-return-intent`, `redeem-draft-intent`, `claim-intent`, `navigateAfterSignIn` — **acceptance** còn thiếu wire CTA + tab disabled + bỏ redirect tab index.

### 3.3 Sự kiện — «Chưa sẵn sàng tải sự kiện»

| Điều kiện | Kết quả |
| --- | --- |
| `!getApiBaseUrl()` **hoặc** `!getTenantSlug()` | `publishedPhase = 'misconfigured'`, `publishedError = eventsCopy.misconfiguredBody` |
| Copy UI | Title: `eventsCopy.misconfiguredTitle` → **«Chưa sẵn sàng tải sự kiện»**; body: «Ứng dụng chưa được cấu hình đầy đủ…» |

**File:** `src/screens/events.tsx` (effect ~L92–118), `src/components/screen-state-copy.ts` (L70–72), `src/published/events-home.ts` (`initialPublishedListPhase`), `src/identity/config.ts` (`getTenantSlug` ← **chỉ** `EXPO_PUBLIC_TENANT_SLUG`, **không** bake trong `app.config.ts` `extra.ticketPublic`).

**Phân biệt:** Đây là **guard cấu hình client**, không phải lỗi API 5xx. Production Release bake `api.vemoki.com` nhưng **thiếu slug** → user vẫn thấy misconfigured. `.env.example` không liệt kê `EXPO_PUBLIC_TENANT_SLUG` (ghi nhận cho coordinator/build — **BA không đổi contract**).

**Nguồn danh sách:** `GET /v1/public/tenants/{tenantSlug}/events` — `src/published/published-event-api.ts`. Một slug / binary (platform app), không switch org trên UI.

### 3.4 Demo / «Đổi tổ chức»

| Finding | |
| --- | --- |
| Chuỗi «Đổi tổ chức demo» **không** còn trong `src/` WT — chỉ còn trong handoff cũ `D11-B3-ATTENDEE-IOS-HANDOFF.md` | |
| `showDemoEventCatalog()` tắt catalog demo trên production APS | `src/identity/config.ts` |
| Fixture demo events/media vẫn tồn tại cho dev (`src/data/demo-events.ts`, `demo-media.ts`) | |

**AC:** Production attendee UI **không** có control đổi tổ chức / debug tenant.

### 3.5 Staff (giữ nguyên — đối chiếu)

| Yêu cầu | WT |
| --- | --- |
| 3 tab Nhập tay \| Scan \| Lịch sử | `src/app/(tabs)/_layout.tsx` + `staff-manual` / `staff-scan` / `staff-history` |
| Event picker header theo quyền | `src/gate/staff-gate-workspace-context.tsx`, copy `scanCopy.eventPicker` |

Attendee tabs ẩn khi `staffWorkspace`; ví redirect staff → scan — không đổi trong scope guest review.

---

## 4. NativeTabs SDK 58 — `disabled` (không chọn hide thay user)

**Phiên bản:** `expo-router@58.0.21`, `expo@58.0.12` (`apps/mobile/package.json`).

| Nguồn | Kết luận |
| --- | --- |
| `expo-router/build/native-tabs/types.d.ts` | `NativeTabOptions.disabled?: boolean` — **@platform android, @platform iOS** |
| `NativeTabTrigger.d.ts` / `convertTabPropsToOptions` | Prop `disabled` map xuống native options |
| `types.d.ts` `NativeTabNavigationEventMap` | `tabPress` có `isPrevented: true` khi tab `disabled` — **không navigate** |
| `NativeTabsView.android.js` | `preventNativeSelection: options.disabled` |
| `appearance.ios.js` | State `disabled` trong appearance |

**Khuyến nghị BA (chốt với PD):** Dùng `disabled={!hasWalletAccess}` (hoặc tương đương «chưa đăng nhập và không offline bound») trên trigger `my-tickets`, **`hidden={false}`** cho attendee (chỉ hide khi staff workspace). **Không** dùng `hidden={!myTicketsTab}` cho anonymous attendee.

**Limitation cần PD/iOS xác nhận trên device:** Visual «greyed out» phụ thuộc `react-native-screens` + iOS 26 tab bar; cần 1 screenshot TF cho disabled + VoiceOver label (gợi ý: «Vé của tôi, cần đăng nhập»). Nếu disabled không đạt a11y, fallback **vẫn hiện tab** + cho phép vào màn `WalletAccessNotice` (không redirect) — **không** quay lại hide.

---

## 5. Ma trận hành vi (đề xuất chốt PD)

Legend: **WT** = working tree hiện tại · **Target** = user authority + bảng này.

| Trạng thái | Tab Sự kiện | Tab Vé của tôi | Tab Tài khoản | Đổi mã / Claim | Ví nội dung |
| --- | --- | --- | --- | --- | --- |
| **Anonymous** (signed-out, offline none) | Mở | **WT:** hidden · **Target:** visible, **disabled**, tap → màn chặn (hoặc vẫn vào màn chặn nếu disabled không focusable) | Mở; **chỉ đây** có nút «Đăng nhập» standalone | **Target:** CTA primary → park return + OIDC (qua Account) → resume draft/intent | `WalletAccessNotice` |
| **Verified** | Mở | Enabled; sync API | Mở; logout | Submit redeem/claim | Danh sách vé + QR detail |
| **Offline display** (bound, chưa verified) | Mở | **WT:** enabled (hasWalletAccess) | Mở; «Đăng xuất (xoá hiển thị offline)» | Cần verified để submit mới | Cache vé; banner offline |
| **Logout** | Mở | **Target:** disabled lại | Chưa đăng nhập | Draft/intent cleared (`wallet-logout`) | Clear session artifacts |
| **Revoked / 401 vé** | Mở | Enabled nhưng lỗi + `logoutAndClearWalletArtifacts` path | Đăng nhập lại | Theo session | Không dùng cache khi unauthorized |

**Staff eligible:** Hàng attendee trong bảng thay bằng workspace 3 tab cổng (không có Vé/Tài khoản attendee).

---

## 6. Acceptance criteria (iOS handoff)

### AC-G1 — Tab ví anonymous

- **Given** attendee, `identity.status !== 'verified'`, offline `none`
- **When** xem tab bar
- **Then** «Vé của tôi» **hiển thị** và ở trạng thái **disabled** (native) hoặc tương đương PD; **không** `hidden`
- **And** không `Redirect` sang Sự kiện từ `my-tickets/index.tsx`

### AC-G2 — Nội dung tab ví guest

- **Given** anonymous mở được màn ví (tap tab hoặc deep link allow-list)
- **Then** `walletCopy.guestWalletBlockedTitle/Body` + hướng dẫn; **không** nút «Đăng nhập» trên màn ví (chỉ Tài khoản standalone)

### AC-G3 — Redeem anonymous

- **Given** chưa verified, đang `/redeem` (từ Sự kiện hoặc ví)
- **When** user chọn hành động đổi mã (CTA primary PD — không chỉ copy)
- **Then** park `sign-in-return` `/redeem` + `redeem-draft-intent`; mở luồng đăng nhập; sau verify **quay `/redeem`** với draft restored (`resumeRedeemDraftIntent`)

### AC-G4 — Claim anonymous

- **Given** deep link claim hợp lệ, chưa verified
- **When** user chọn hoàn tất nhận vé (CTA)
- **Then** park `/claim` + guest claim intent; sau login resume (`claim-intent.ts`)

### AC-G5 — Không trang chết

- **Given** bất kỳ màn redeem/claim/wallet guest
- **Then** luôn có **ít nhất một** CTA hợp lệ (đổi mã gated, về Sự kiện, hoặc auth context) — không chỉ Notice

### AC-G6 — Sự kiện misconfigured (copy frozen)

- **Given** thiếu API base hoặc `EXPO_PUBLIC_TENANT_SLUG`
- **Then** vẫn hiện title **«Chưa sẵn sàng tải sự kiện»** và body hiện tại — không đổi copy trong task này
- **Evidence:** `eventsCopy` tests `src/components/screen-state-copy.test.ts`

### AC-G7 — Production không đổi tổ chức demo

- **Given** `getApsEnvironment() === 'production'`
- **Then** không UI «Đổi tổ chức» / switch tenant demo trên attendee home

### AC-G8 — Staff unchanged

- **Given** staff workspace
- **Then** 3 tab cổng + event picker header; không regression từ guest work

**Kiểm chứng gợi ý (không claim UAT):** `pnpm --filter @ticket/mobile test` (navigation + screen-state-copy); simulator manual script trong handoff iOS; device TF cho NativeTabs disabled.

---

## 7. Handoff iOS (implementation slice)

| Ưu tiên | Thay đổi | Files chính |
| --- | --- | --- |
| P0 | Tab ví: `hidden` → luôn show attendee; thêm `disabled` khi `!hasWalletAccess` | `(tabs)/_layout.tsx` |
| P0 | Bỏ redirect anonymous khỏi `my-tickets/index` | `(tabs)/my-tickets/index.tsx` |
| P0 | Cập nhật `showMyTicketsTab` / tests: anonymous **vẫn** show tab | `attendee-wallet-access.ts`, `.test.ts` |
| P1 | Redeem/claim/events: CTA auth context (`goToAccountForSignIn`) | `redeem.tsx`, `claim.tsx`, `events.tsx` (PD label) |
| P2 | Doc/build: `EXPO_PUBLIC_TENANT_SLUG` cho prod catalog (coordinator — ngoài BA contract) | `.env.example`, release checklist |

**Không sửa:** API routes, Keycloak contract, staff gate logic, copy misconfigured.

---

## 8. Handoff PD (cần chốt matrix §5)

| Chủ đề | Câu hỏi PD |
| --- | --- |
| Tab disabled | Icon/label opacity, badge «Cần đăng nhập»? |
| Redeem/claim CTA | Label nút khi anonymous: «Đăng nhập để đổi mã» vs giữ «Đổi mã» + subcopy? |
| Wallet guest | Có thêm link «Mở tài khoản» (không phải nút Đăng nhập) hay chỉ text? |
| Misconfigured events | CTA «Liên hệ hỗ trợ» hay chỉ error panel? (không đổi title/body) |

PD cập nhật cùng path hoặc `PD-*` sibling khi chốt — matrix §5 là draft BA.

---

## 9. Code complete vs acceptance complete

| | |
| --- | --- |
| **Code complete (WT)** | Staff 3-tab split; published events API; return intent + redeem/claim draft parking; wallet offline/verified paths; NativeTabs shell |
| **Chưa acceptance** | Tab hide/redirect vs user authority; thiếu auth CTA trên redeem/claim; prod catalog có thể misconfigured thiếu slug; chưa evidence device disabled tab |
| **Pilot ready** | Không claim — cần D5 device UAT + build signed |

---

## 10. Dependencies

- **Cấu hình release:** `EXPO_PUBLIC_TENANT_SLUG` + `EXPO_PUBLIC_TENANT_ID` (vé) — coordinator/build, không đổi API
- **UX-11 / DECISION-LOG:** Keycloak only
- **PD:** Visual disabled + CTA naming

---

*Artifact: `docs/design/mobile-production-ux/BA-GUEST-FLOW-REVIEW.md` — worker BA docs-only, 2026-10-19.*
