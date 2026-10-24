> Bản tổng hợp hiện hành: README.md và PD-HANDOFF.md; các bảng audit mô tả hiện trạng không phải copy UI được duyệt.
> Nghiên cứu được lập ngày 20/10/2026. Các bảng gap là baseline trước PR #586/#587/#597; xem README và Project #3 để biết tiến độ sau đó.

# BA Research — Refactor trải nghiệm production (mobile)

| Trường | Giá trị |
| --- | --- |
| **Issue** | [#580](https://github.com/hangndat/ticket-solution/issues/580) |
| **Run** | `run_526c9a272efd` |
| **Task** | `task_c8c825ae53bd` |
| **Persona** | Kazu · ba |
| **Pha** | Discovery / design — **không** code complete · **không** acceptance complete · **không** pilot ready |
| **Authority gói** | [README.md](./README.md) (thắng `archive/`) |
| **Base đọc code** | `main` + working tree mobile dirty (chỉ đọc, không sửa) |

---

## 1. Outcome (vấn đề cần giải)

Người dùng Vemoki trên iOS cần một app **production-grade**: khám phá **mọi sự kiện công khai đã publish** trên platform, đổi mã / ví vé / tài khoản rõ ràng theo vai trò, nhân viên cổng có workspace riêng, và thông báo chỉ xin **khi có giá trị** — không lộ cấu hình kỹ thuật, không CTA trùng, không giả trạng thái gửi tin.

**Persona PRD §3 trong phạm vi đợt:** Attendee (khách), Staff/Scanner (cổng), Supervisor (gián tiếp qua audit — không surface chi tiết trên Account).

---

## 2. Quyết định đã chốt (không hỏi lại)

| ID | Quyết định | Ghi chú triển khai |
| --- | --- | --- |
| **D-EVT-01** | Tab **Sự kiện** hiển thị catalog **toàn platform**: mọi event **công khai + published**, không phụ thuộc `EXPO_PUBLIC_TENANT_SLUG` / slug bake trên binary. | Hiện code + OpenAPI chỉ có `GET /v1/public/tenants/{tenantSlug}/events` — **cần contract mới** (xem §6). Không bypass RLS; chỉ projection public đã publish. |
| **D-API-01** | Runtime app **luôn** gọi `https://api.vemoki.com` (không đổi server theo env, không fallback local/demo trên thiết bị). | Test vẫn inject `fetchImpl` / transport. Production bake hiện đã có default trong `app.config.ts` — quyết định user là **không cho override runtime** ngoài test. |
| **D-NAV-01** | Staff: 3 tab **Nhập tay · Scan · Lịch sử**. Khách: ẩn **Vé của tôi** khi chưa có quyền ví. Đăng nhập tại **Tài khoản** + auth gate theo tác vụ (redeem one-shot). | Khớp `apps/mobile/src/app/(tabs)/_layout.tsx`, `attendee-auth-gate.ts`. |
| **D-ACC-01** | Redesign **Tài khoản** theo công việc người dùng; bỏ demo/debug, jargon cấu hình, CTA trùng. | Chi tiết đề xuất §4–§5 (PD implement). |
| **D-PUSH-01** | Nghiên cứu lại **thời điểm** xin quyền; tách rõ permission OS vs đăng ký thiết bị vs khả năng gửi backend. Không toggle giả “đã gửi”. | PRD M09; §5. |
| **D-SCR-01** | Single-code redemption vẫn là yêu cầu sản phẩm; gắn workstream riêng, **không** migration prod trong đợt này. | [single-code-redemption.md](../../architecture/single-code-redemption.md) |

---

## 3. Đề xuất (chờ Architect / Planner / PD — không phải quyết định)

| ID | Đề xuất | Owner gợi ý |
| --- | --- | --- |
| **P-API-02** | `GET /v1/public/events` (hoặc tương đương) + cursor, chỉ `PublishedEventSummary` đã publish; filter draft/private ở service/RLS. | Backend + Architect |
| **P-ACC-02** | Gom **Đổi mã** chủ yếu trên Sự kiện / luồng redeem; Account chỉ link phụ hoặc bỏ CTA trùng. | PD |
| **P-PUSH-02** | Luồng xin quyền **sau khi** phát hành vé thành công (hoặc lần đầu mở vé trong ví), không phải màn Tài khoản lạnh. | PD + iOS |
| **P-PUSH-03** | UI trạng thái 4 lớp (§5.2) thay một nút “Bật thông báo” gộp mọi thứ. | PD + iOS |

---

## 4. Hiện trạng màn Tài khoản (đọc source)

**File chính:** `apps/mobile/src/screens/account.tsx`\
**Route:** tab `/(tabs)/account` và stack `/account` (staff vẫn OIDC tại đây khi deep link).

### 4.1 Ma trận nội dung theo trạng thái

| Trạng thái | Điều kiện (code) | Nội dung / CTA hiện có | Đánh giá BA |
| --- | --- | --- | --- |
| **A. Build thiếu OIDC** | `!isOidcConfigured()` | Notice “Chưa cấu hình đăng nhập”, trạng thái chưa đăng nhập, **Push**, **Chính sách quyền riêng tư** | Production TF không nên gặp; copy “cấu hình bản dựng” = jargon ops — **ẩn khỏi user prod** hoặc generic “Chưa sẵn sàng đăng nhập”. |
| **B. Khách (guest)** | `identity !== verified`, offline không bound | Wordmark, giải thích phiên, nhãn “Chưa đăng nhập”, **Đăng nhập**, **Đổi mã lấy vé**, Push, Privacy, disclaimer quyền staff | **CTA trùng** với Sự kiện (đổi mã). Push + đăng ký token khi chưa login (backend `skipped-unsigned`) — **dễ hiểu nhầm**. |
| **C. Khách offline-bound** | `offline.status === bound`, chưa verified | Nhãn “Xem offline (chưa xác minh phiên)”, **Đăng nhập**, **Đăng xuất (xoá hiển thị offline)**, đổi mã, push, privacy | Giữ **logout offline** + copy phân biệt offline vs đăng nhập — **cần giữ** (PRD ví offline). Rút gọn giọng kỹ thuật “phiên xác minh máy chủ”. |
| **D. Attendee đã xác minh** | `verified`, không staff workspace | Email (+ “Email đã xác minh: có/chưa”), **Làm mới hồ sơ**, **Đăng xuất**, đổi mã, push, privacy, **Yêu cầu xóa tài khoản**, disclaimer staff | Giữ: logout, privacy, deletion (M02). Cân nhắc bỏ/giảm: “Làm mới hồ sơ” nếu focus refresh tự động; **email verified** dòng kỹ thuật — chuyển sang trạng thái ít jargon. |
| **E. Staff workspace** | `isStaffWorkspace` | Tab Tài khoản **ẩn**; stack `/account` vẫn có **Quay lại cổng**, OIDC, push… | Staff không cần đổi mã / deletion trên ca — **đề xuất** màn stack rút gọn: phiên + đăng xuất + (tuỳ chọn) privacy; không CTA attendee. |

### 4.2 Thông tin **giữ** (privacy / compliance / thật)

| Mục | Lý do |
| --- | --- |
| Đăng nhập / đăng xuất (Keycloak + xóa artifact ví) | M02, SessionBoundary |
| Chính sách quyền riêng tư (URL công khai) | App Store 5.1.1 |
| Yêu cầu xóa tài khoản (verified only) | M02; copy đã tránh “đã xóa ngay” — `account-deletion-copy.ts` |
| Không hiển thị disclaimer quyền nhân viên trên flow khách | Quyền được kiểm tra khi mở tác vụ nhân viên |
| Phân biệt offline cache vs phiên đăng nhập | M08 — không gộp thành “đã đăng nhập” |

### 4.3 Thông tin / pattern **loại bỏ hoặc thu gọn** (production UX)

| Mục | Hiện trạng | Hướng PD |
| --- | --- | --- |
| Jargon cấu hình | “Thiếu địa chỉ API”, “slug tổ chức”, “bản dựng” trên Events/Account | User-facing: “Không tải được danh sách” + Thử lại; chi tiết ops chỉ log nội bộ |
| CTA trùng | Đổi mã trên Account + Events | Một điểm chính (Events / post-auth redeem); Account: “Quản lý phiên” |
| Push trên Account lạnh | `SessionScopedPushStatus` luôn hiện | Chuyển sang ngữ cảnh có giá trị (§5) |
| “Làm mới hồ sơ” | Manual refresh `/v1/me` | Optional ẩn sau auto-refresh on focus |
| Demo / fixture | `showDemoEventCatalog()` non-prod | Không đổi fixture DB; prod không surface demo list |

### 4.4 Liên kết navigation đã chốt (không redesign tab)

| Chính sách | Source |
| --- | --- |
| Ẩn **Vé của tôi** khi guest không `hasWalletAccess` | `attendee-wallet-access.ts` |
| Auth gate redeem: park return → `/account` → OIDC one-shot | `attendee-auth-gate.ts` |
| Staff deny: `/staff-access` → Events | `staff-access.tsx` |

---

## 5. Thông báo đẩy — nghiên cứu & đề xuất UX

### 5.1 Nguồn chính thống (Apple)

- Xin quyền: [Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
- Trạng thái quyền: [`UNAuthorizationStatus`](https://developer.apple.com/documentation/usernotifications/unauthorizationstatus) — `notDetermined`, `denied`, `authorized`, `provisional`, `ephemeral` (provisional là quyền gửi yên lặng)
- HIG: [Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications) — xin quyền **in context**, giải thích **lợi ích cụ thể**, không spam prompt

**PRD M09:** xin quyền trong ngữ cảnh phù hợp; từ chối vẫn dùng vé; không gọi accepted = đã đọc.

### 5.2 Bốn lớp tách biệt (không gộp trên một toggle)

| Lớp | Ý nghĩa user | Hệ thống hiện tại | UI đề xuất |
| --- | --- | --- | --- |
| **L1 — Quyền hiển thị (iOS)** | “Cho phép Vemoki gửi thông báo trên màn hình?” | `registerApnsDeviceToken` **không** gọi `requestPermissionsAsync` (chỉ `getDevicePushTokenAsync`) — comment code: tách token vs alert auth | Pre-prompt VN → `requestPermissionsAsync` khi user đồng ý; map `getPermissionsAsync` → copy theo trạng thái |
| **L2 — Token thiết bị (APNs)** | Thiết bị có địa danh gửi tin | `getDevicePushTokenAsync` trong `apns-device-token.ts` | Không hiển thị token; chỉ “Đã liên kết thiết bị” nội bộ |
| **L3 — Đăng ký backend** | Máy chủ biết gửi tin cho ai | `POST /v1/me/device-tokens` khi verified | “Đã lưu thiết bị nhận tin” / “Cần đăng nhập để lưu” — **đã có** trong `summarizeRegistration` |
| **L4 — Gửi tin thực tế** | Khách có nhận email/push giao dịch | Worker APNs; trạng thái QUEUED/ACCEPTED/DELIVERED | **Không** claim “đã gửi” trên app — `push.ts` đã fail-closed |

### 5.3 Giá trị & trigger đề xuất (value-first)

| Moment | Giá trị user (copy gợi ý) | Ghi chú |
| --- | --- | --- |
| **Sau cấp vé thành công** | “Nhận nhắc khi vé sẵn sàng / cập nhật sự kiện” | Khớp transactional push M09; **không** bắt buộc để xem QR |
| **Lần đầu mở chi tiết vé** (fallback) | Cùng value prop | Nếu user bỏ qua sau redeem |
| **Không** | Mở app lần đầu, màn Tài khoản trống, trước login | Tránh HIG violation & từ chối cao |

**Từ chối / denied:** vé + QR vẫn dùng; Settings iOS — link “Mở Cài đặt” (`Linking.openSettings`) khi `denied`.

### 5.4 Ma trận trạng thái thông báo (AC UI)

| iOS permission | Đăng nhập | Backend registration | Copy user (đề xuất) | Hành động |
| --- | --- | --- | --- | --- |
| `notDetermined` | any | n/a | (Chỉ pre-prompt trong ngữ cảnh §5.3) | Primary: “Cho phép nhắc vé” |
| `denied` | verified | có/không | “Đã tắt thông báo trong Cài đặt iOS…” | Mở Cài đặt |
| `authorized` / `provisional` | guest | skipped | “Đăng nhập để lưu thiết bị nhận tin” | → Account login |
| `authorized` | verified | registered | “Sẽ nhận nhắc giao dịch trên thiết bị này” | Tuỳ chọn “Tắt trên máy chủ” **chỉ nếu** API có — **hiện không invent** |
| `authorized` | verified | failed | “Chưa lưu được thiết bị — thử lại” | Retry POST |
| Provider off | any | n/a | Giữ `PUSH_NOT_CONFIGURED` | Không nút bật giả |

**Không làm:** switch “đã nhận thông báo”; badge giả delivered; gộp permission denied với lỗi mạng.

---

## 6. Sự kiện — catalog platform (gap hiện trạng → quyết định D-EVT-01)

| | Hiện trạng | Mục tiêu (đã chốt) |
| --- | --- | --- |
| **Client** | `fetchPublishedEventList(tenantSlug)` + `getTenantSlug()` bắt buộc — `catalog-context.ts` | List không cần slug env; pagination cursor |
| **API** | Chỉ `GET /v1/public/tenants/{tenantSlug}/events` (OpenAPI) | Endpoint platform (đề xuất P-API-02) trả items đa tenant với `tenantSlug` trên mỗi row (đã có trên summary) |
| **An toàn** | 404 draft/unknown | Giữ: không lộ private/draft; không “SELECT *” bypass tenant |
| **Branding** | Theme từ event đầu list | PD: hero Vemoki platform vs brand event — không phụ thuộc một slug bake |

**AC catalog (acceptance — khi có API + client):**

1. **Given** ≥2 tenant có event published trên prod **When** mở tab Sự kiện trên build prod **Then** thấy event từ cả hai tenant, không cấu hình `EXPO_PUBLIC_TENANT_SLUG`.
2. **Given** event draft hoặc unpublish **When** gọi API public **Then** không xuất hiện trên list (kiểm tra API + UI).
3. **Given** mất mạng **When** tải list **Then** thông báo lỗi + Thử lại; **không** hiện fixture demo trên production.

---

## 7. API runtime `https://api.vemoki.com` (D-API-01)

| Lớp | Hiện trạng | Yêu cầu chốt |
| --- | --- | --- |
| Bake Release | `VEMOKI_PROD_PUBLIC.apiBaseUrl` trong `app.config.ts` | Giữ |
| Runtime | `getApiBaseUrl()` đọc `EXPO_PUBLIC_*` / extra — dev có thể trỏ khác | Mọi runtime app, kể cả Debug/Metro: **cố định** prod URL; test inject transport riêng |
| OIDC | Tương tự `auth.vemoki.com` | Cùng policy với API |

**AC:** **Given** build production cài trên thiết bị **When** packet capture hoặc log URL (UAT) **Then** mọi call nghiệp vụ attendee/staff tới `https://api.vemoki.com` (không localhost, không tenant slug trong host).

---

## 8. Workstream Single-code redemption (D-SCR-01)

Yêu cầu user: một ô mã, không chọn event/slug; resolve server → issue. Tài liệu kỹ thuật: [single-code-redemption.md](../../architecture/single-code-redemption.md).

| Gắn với refactor | Mô tả |
| --- | --- |
| **Account / Events** | CTA “Đổi mã” dẫn `/redeem`; auth gate one-shot đã có |
| **Không trong đợt discovery này** | DDL routing group, backfill, feature flag `single_code_resolve_global` |
| **Planner** | Story riêng BE resolve + iOS state machine; phụ thuộc D-EVT-01 / catalog chỉ cho marketing, không cho routing mã |

---

## 9. Acceptance criteria tổng hợp (Account + cross-cutting)

### 9.1 Tài khoản — theo persona

| ID | Given | When | Then |
| --- | --- | --- | --- |
| **AC-ACC-01** | Guest chưa login | Mở tab Tài khoản | Thấy đăng nhập + privacy; **không** bắt buộc push; **không** copy slug/API/env |
| **AC-ACC-02** | Guest | Hoàn tất redeem cần auth | Auth gate mở Account → OIDC → quay redeem; **một** lần đăng nhập |
| **AC-ACC-03** | Verified attendee | Mở Tài khoản | Có đăng xuất + xóa tài khoản + privacy; đổi mã không trùng 2 CTA cùng màn với Events (PD sign-off) |
| **AC-ACC-04** | Staff eligible | Dùng app | 3 tab cổng; không tab Tài khoản/Vé; đăng xuất vẫn từ flow stack nếu vào `/account` |
| **AC-ACC-05** | Verified | Gửi yêu cầu xóa | UI không nói “đã xóa tài khoản ngay”; trạng thái theo server (unit copy guards) |

### 9.2 Thông báo

| ID | Given | When | Then |
| --- | --- | --- | --- |
| **AC-PUSH-01** | Fresh install | Mở Tài khoản lần đầu | **Không** hiện system permission dialog (cho đến trigger §5.3) |
| **AC-PUSH-02** | Vừa nhận vé | User chấp nhận pre-prompt | System dialog; nếu authorized + logged in → POST device token thành công hoặc message lỗi tách bạch |
| **AC-PUSH-03** | Permission denied | Xem trạng thái | Vé vẫn dùng được; có đường mở Cài đặt iOS |
| **AC-PUSH-04** | Any | UI trạng thái | Không chữ “delivered” / “đã gửi thành công” cho push |

---

## 10. Scope bounds (PD / Planner — không vượt)

**In scope đợt refactor UX (design):**

- IA Account theo bảng §4; copy Tiếng Việt; 3–5 màn ưu tiên (Sự kiện, Tài khoản, Vé, Redeem, Staff scan shell).
- Push theo PD-HANDOFF: bốn lớp chỉ dùng nội bộ; Account opt-in trực tiếp, card theo ngữ cảnh có thể bỏ qua; không đưa bốn lớp kỹ thuật lên UI.
- Catalog platform sau khi Architect chốt path OpenAPI.

**Out of scope / non-goals:**

- Payment, Android, Wallet pass, seat map (PRD).
- Settings app tổng hợp (ngôn ngữ, theme…) **chưa có API** — không invent.
- Toggle “tắt marketing push” per channel nếu backend chưa có.
- Migration single-code / backfill routing.
- UAT giả — acceptance cần iPhone thật (README gói).

**Phân tầng:**

| Tầng | Ý nghĩa |
| --- | --- |
| Design complete | PD handoff + AC §9 được coordinator duyệt |
| Code complete | iOS/BE implement |
| Acceptance complete | UAT + evidence Issue |
| Pilot ready | Prod gate + store (D10) |

---

## 11. Dependencies & handoff

| Đội | Cần từ BA | Artifact |
| --- | --- | --- |
| **PD (Liv)** | §4.3, §5.3, wireframe 3–5 màn | [PD-HANDOFF.md](./PD-HANDOFF.md) |
| **Architect (Dexter)** | P-API-02 trust boundary catalog platform | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Planner** | AC map Story BE/iOS; SCR workstream tách epic | [ROADMAP.md](./ROADMAP.md) |
| **iOS (Zico)** | Gap push permission vs token; catalog client | [IOS-AUDIT.md](./IOS-AUDIT.md) (khi có) |

---

## 12. Evidence (đường đọc — không UAT)

| Nguồn | Path / link |
| --- | --- |
| Account UI | `apps/mobile/src/screens/account.tsx` |
| Push UI + register | `apps/mobile/src/push/push-status.tsx`, `apns-device-token.ts` |
| Tab / wallet / staff | `apps/mobile/src/app/(tabs)/_layout.tsx`, `attendee-wallet-access.ts`, `staff-workspace.ts` |
| Catalog client | `catalog-context.ts`, `published-event-api.ts`, `events.tsx` |
| API public hiện có | `apps/api/src/published-events.ts`, OpenAPI `PublishedEventsController_*` |
| Quyết định gói | [README.md](./README.md) |
| PRD M02/M08/M09 | [docs/PRD.md](../../PRD.md) |
| Single-code (lịch sử) | [single-code-redemption.md](../../architecture/single-code-redemption.md) |

---

*Cập nhật: 2026-10-20 — Kazu · ba · Issue #580.*
