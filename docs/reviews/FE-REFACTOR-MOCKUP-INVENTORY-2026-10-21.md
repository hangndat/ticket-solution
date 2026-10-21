# FE Refactor — Kiểm kê mockup web (Slice C)

| Trường | Giá trị |
| --- | --- |
| Task | `task_b72b9b852947` · Role `product-design` |
| Worktree audit | `/Users/admin/orca/workspaces/main/FE-refactor` (read-only `apps/*`) |
| Mockup SoT đọc | `/Users/admin/orca/workspaces/main/fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/` |
| Ngày | 2026-10-21 |
| Web local (quan sát) | `http://localhost:3010` — HTML tip dùng Live Pulse inline (`--ink`/`--signal` khớp `globals.css`) |

---

## 1. Chốt nguồn mockup (SoT) và rủi ro mất

| Nguồn | `web-prototype.html` | `WEB-HANDOFF.md` | Gói liên quan |
| --- | --- | --- | --- |
| **fix-prod-redeem-gate-1021** | Có · SHA256 `de50a15b…` · ~31 KB · sửa 2026-10-21 13:26 | Có · untracked | `prototype.html`, `full-prototype.html`, README, PD-HANDOFF, … **toàn bộ** `docs/plans/mobile-production-refactor/*` = **`git status ??` (chưa commit)** |
| **FE-refactor (repo hiện tại)** | **Không có file** | **Không có** | Chỉ [`docs/plans/mobile-production-refactor/ROADMAP.md`](../plans/mobile-production-refactor/ROADMAP.md) (tracked) |

**Kết luận SoT:** Mockup web desktop/mobile **mới nhất và đầy đủ** nằm ở worktree **fix-prod-redeem-gate-1021**, không phải bản copy trong FE-refactor. FE-refactor chỉ giữ roadmap Epic #580; **không** mirror `web-prototype.html` / `WEB-HANDOFF.md`.

**Rủi ro mất:** Cao nếu chỉ dựa vào git `main` / FE-refactor — artifact PD web **chưa được track**. Mất worktree local hoặc `git clean` trên fix-prod-redeem-gate-1021 sẽ xóa SoT. `full-prototype.html` (mobile-first) và `prototype.html` cùng thư mục, cũng untracked.

**Phân vai file HTML:**

| File | Phạm vi |
| --- | --- |
| `web-prototype.html` | **Web** guest/user/staff/admin + desktop/mobile toggle (Slice C) |
| `full-prototype.html` | Mobile app flows (Epic #580 mobile) |
| `prototype.html` | Mobile Tài khoản / thông báo (PD mobile) |

User đã duyệt gói 20/10/2026 ([WEB-HANDOFF](file:///Users/admin/orca/workspaces/main/fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/WEB-HANDOFF.md), [README](file:///Users/admin/orca/workspaces/main/fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/README.md)).

---

## 2. Khung review trong mockup

- **Vai trò (`role`):** `guest` · `user` · `staff` · `admin` (đổi qua `choose(role, page)` hoặc luồng đăng nhập mock).
- **Viewport (`device`):** `desktop` · `mobile` (class `browser mobile` trên khung, ~390px).
- **13 preset review** (`states` array — thanh `reviewnav`): shortcut PD đã kiểm 144 tổ hợp (WEB-HANDOFF §Kiểm tra mockup) = preset × desktop/mobile × biến thể nav/role, cộng màn phụ (detail, login, ticket, modal…).

---

## 3. Bảng màn / state → route `apps/web`

**Chú thích route:** `có` = `app/**/page.tsx` hoặc route handler rõ; `một phần` = cùng URL nhưng IA/layout lệch mockup; `chưa có route` = không có surface product tương ứng.

### 3.1 Khách / người dùng (catalog, vé, đổi mã, tài khoản)

| ID mockup | Tiêu đề UI | Vai trò | State / biến thể trong mockup | Route `apps/web` | Ghi chú đối chiếu production (localhost:3010 / code) |
| --- | --- | --- | --- | --- | --- |
| `events` | Hẹn bạn ở trải nghiệm tiếp theo | guest, user, admin (nav công khai) | Search + filter thời gian; grid 3 cột desktop / 1 cột mobile; **guest** ẩn owned count trên card | **`/`** (`app/page.tsx`) | Có catalog; layout mockup (grid poster 3 cột, owned chip) **chưa** khớp — PD production handoff ghi ops chrome / letterbox ([PD-PRODUCTION-WEB-HANDOFF](../design/production-web-review/PD-PRODUCTION-WEB-HANDOFF.md) T1–T8). |
| `detail` | Chi tiết sự kiện | all (từ card) | Hero art + 2 cột + sidebox «Đổi mã»; owned strip | **`/t/[tenantSlug]/events/[eventSlug]`** | Có; mockup full-bleed hero + sidebox gần P0-4 handoff production hơn tip hiện tại. |
| `redeem` | Đổi mã lấy vé | guest → auth gate; user | Form mã; guest CTA «Đăng nhập để tiếp tục» (`intent=true` → login) | **`/redeem`** | Có; auth gate khớp hướng Epic #580 / WEB-HANDOFF. |
| `login` | Đăng nhập | guest | Subcopy khi `intent` (quay redeem) vs mặc định; mock OIDC | **`/auth`** (`app/auth/route.ts` + session UI) | Có (redirect OIDC); mockup là **màn in-flow** — production tách trang auth session ([PD-PRODUCTION-WEB-HANDOFF](../design/production-web-review/PD-PRODUCTION-WEB-HANDOFF.md) §2.3). |
| `wallet` | Vé của tôi | user (nav); guest ẩn tab | List theo sự kiện; **filter** `walletFilter` (chip MFest); đếm «3 vé · 2 sự kiện» | **chưa có route** (list ví) | **Gap lớn:** mockup có nav «Vé của tôi»; web chỉ **`/t/…/tickets/[id]`** (chi tiết). visual-identity-v2 ghi ví web là «list phụ» — chưa implement route list. |
| `ticket` | Chi tiết vé + QR | user | QR grid mock; meta vé; back → wallet | **`/t/[tenantSlug]/tickets/[ticketId]`** | Có QR surface; thiếu list upstream trong web. |
| `account` | Tài khoản | guest / user | Sidebar: Thông tin · Quyền riêng tư; nhóm **Bạn / Thông báo / Quyền riêng tư & dữ liệu**; đăng xuất | **`/account`** | **Một phần:** có session + xóa tài khoản; **không** có sidebar 2 cột; thông báo web = notice tĩnh (khớp WEB-HANDOFF — không browser push). |
| `privacy` | Chính sách quyền riêng tư | từ account | Prose minh họa | **một phần** — link product `/privacy` trong account; page thực tế **`/marketing/privacy`** (marketing chrome) | IA mockup = in-product; app link `/privacy` **không** có `app/privacy/page.tsx` (gap routing/content). |
| `delete` | Yêu cầu xóa tài khoản | user | Modal xác nhận 2 bước | **một phần** — section trong **`/account`** (`account-panel`) | Mockup tách page; web gộp account. |

**Luồng mockup không có trong web-prototype (có trên production):**

| Production route | Mockup web |
| --- | --- |
| **`/claim`** | Không mô phòng (WEB-HANDOFF guest có redeem, không nhắc claim) |
| **`/invite`** | Không (admin «Lời mời» ≠ membership invite accept) |

### 3.2 Nhân viên cổng

| ID | Tiêu đề | State trong mockup | Route | Ghi chú |
| --- | --- | --- | --- | --- |
| `scan` | Quét vé | Camera + scan line animation; toast hợp lệ / **warn** đã dùng | **một phần** **`/gate`** | Production: một màn «Cổng check-in» + `GateForm`, **không** 3 tab Scan/Manual/History như mockup. |
| `manual` | Nhập tay | Form mã + modal «Vé hợp lệ» | **một phần** **`/gate`** | Cùng gap IA. |
| `history` | Lịch sử quét | Bảng 12→15 rows, **Tải thêm**, modal chi tiết; copy «trên trình duyệt này» | **chưa có route** (history UI) | BFF gate có API; **không** có page lịch sử web như mockup. |

Gate bar mockup: «MFest · Cổng chính · Sẵn sàng» + đổi sự kiện (modal).

### 3.3 Quản trị tổ chức

| ID | Tiêu đề | State / modal | Route | Ghi chú |
| --- | --- | --- | --- | --- |
| `dashboard` | Tổng quan | Stats 3 ô + list sự kiện rút gọn | **một phần** **`/admin`** | Mockup: sidebar admin 6 mục; production: **một** `AdminForm` tổng hợp (`app/admin/page.tsx`). |
| `admin-events` | Sự kiện | Bảng published/draft; modal «Bản nháp» | **một phần** **`/admin`** | Chức năng có qua form; **không** IA sidebar. |
| `imports` | Nhập danh sách | CSV drop + preview modal «120 dòng / 2 lỗi» | **một phần** **`/admin`** + BFF imports | Preview flow mockup; wiring có API. |
| `invites` | Lời mời | Bảng đợt gửi; modal tạo / xem trước | **một phần** **`/admin`** | Khác **`/invite`** (accept membership). |
| `members` | Thành viên | Bảng role/phạm vi; modal quyền | **một phần** **`/admin`** + BFF members | |
| `settings` | Cấu hình tổ chức | Form branding (màu `#E11D48`); modal preview | **một phần** **`/admin`** | |

**Ngoài phạm vi mockup (có trên web):** **`/platform`** (platform admin) — WEB-HANDOFF: không mở rộng superadmin trong refactor này.

### 3.4 Overlay / modal (không phải route)

| Loại | Ví dụ trong mockup | Route |
| --- | --- | --- |
| Modal xác nhận | Đổi mã: Chưa có mã, Đã tìm thấy vé; Xóa TK; Import preview; Mời thành viên; … (15 `modal(`) | State UI in-page |
| Toast cổng | Vé hợp lệ / vé đã dùng (`toast()` / `toast(true)` warn) | In-page |
| Mobile menu | `menu()` overlay nav | Chrome |
| Empty search | `filterEvents` ẩn card | In-page |

---

## 4. Ma trận vai trò × điều hướng (mockup)

| Vai trò | Nav chính (desktop/mobile) | Màn chỉ đạo |
| --- | --- | --- |
| **guest** | Sự kiện · Đổi mã · Tài khoản (không Vé của tôi) | `events`, `redeem`→`login`, `account` signed-out |
| **user** | + Vé của tôi | `wallet`, `ticket`, redeem lookup → wallet filter |
| **staff** | Quét · Nhập tay · Lịch sử · Tài khoản | `scan`, `manual`, `history` |
| **admin** | Quản trị tổ chức · Sự kiện công khai · Tài khoản + sidebar 6 mục | `dashboard`…`settings` |

---

## 5. Đối chiếu brand tokens vs mockup

### 5.1 Bảng màu / focus

| Token | `brand/vemoki/tokens.json` (v2 Live Pulse) | `web-prototype.html` `:root` | `apps/web/app/globals.css` (FE-refactor tip) | `PD-PRODUCTION-WEB-HANDOFF.md` |
| --- | --- | --- | --- | --- |
| ink | `#0B1220` | `#0b1220` (`--ink`) | `#0B1220` | `#22241f` (**O09 cũ**) |
| paper | `#F4F6F8` | `#f4f6f8` (`--paper`) | `#F4F6F8` | `#f7f6f1` (**ấm cũ**) |
| signal/accent | `#E11D48` | `#e11d48` (`--red`, primary CTA) | `#E11D48` (`--signal`) | `#9b3a18` (**terracotta cũ**) |
| focus | `#2563EB` | `#2563eb` (outline) | `#2563EB` | `#235fd0` |

**Kết luận:** Mockup web **khớp Live Pulse v2** (`tokens.json` + `visual-identity-v2` + `globals.css` trên FE-refactor). **Mâu thuẫn:** [`PD-PRODUCTION-WEB-HANDOFF.md`](../design/production-web-review/PD-PRODUCTION-WEB-HANDOFF.md) vẫn mô tả palette **O09 / Syne** — **lỗi thời** so với freeze #487 và mockup MPR web.

### 5.2 Typography

| Nguồn | Display | Body |
| --- | --- | --- |
| tokens.json / visual-identity-v2 | **Sora** | **Be Vietnam Pro** |
| web-prototype.html | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (system) | Cùng stack |
| apps/web (tip) | Sora via `next/font` | Be Vietnam Pro |

**Mâu thuẫn:** Mockup **không** load Sora/Be Vietnam Pro — preview màu đúng, **hierarchy type sai** so với SoT brand. Radius mockup ~7–14px card; brand web `--radius-sm: 2px` (sắc) — mockup **mềm hơn** freeze.

### 5.3 Nội dung brand khác

- Mockup wordmark `vemoki↗` + logo đỏ — khớp hướng signal.
- Footer mockup: «Một nơi cho mọi trải nghiệm» — không «cổng kiểm soát» (khớp WEB-HANDOFF / PD production P0-2).
- Admin settings demo màu `#E11D48` — khớp signal v2.

---

## 6. WEB-HANDOFF.md — tóm tắt đối chiếu

| Chủ đề WEB-HANDOFF | Khớp mockup? | Production web hiện tại |
| --- | --- | --- |
| Catalog platform published | Có (copy MFest demo) | Có `/` — tenant-scoped data path; Epic #580 đòi `GET /v1/public/events` |
| Guest ẩn ví / owned count | Có trong JS | Partial — nav capabilities, không có `/wallet` |
| Redeem auth gate + return task | Có `intent` | Có pattern `/auth` |
| Staff 3 màn + phạm vi cổng | Có | **Lệch** — single `/gate` |
| Admin sidebar 6 mục | Có | **Lệch** — monolithic `/admin` |
| Responsive desktop/mobile | Có toggle | Production responsive nhưng **layout** khác mockup |
| Không platform superadmin | Không trong mockup | `/platform` tồn tại (out of scope MPR) |

---

## 7. Tổng hợp gap (ưu tiên cho web refactor)

| Ưu tiên | Gap | Mockup | Web tip |
| --- | --- | --- | --- |
| P0 | Ví / list vé | Nav + `wallet` | **Chưa có route** |
| P0 | IA cổng 3 tab | scan/manual/history | `/gate` đơn |
| P0 | IA admin sidebar | 6 section pages | `/admin` form hub |
| P1 | Home/catalog layout | Grid poster + search | Row list + ops copy (PD prod handoff) |
| P1 | In-product privacy | Account sub-page | Marketing `/marketing/privacy` + link `/privacy` mơ hồ |
| P1 | Typography | System font | Sora/BVP đã trên app — **cần align layout mockup** |
| P2 | Claim flow | — | `/claim` không trong mockup web |
| Docs | SoT commit | fix-prod-redeem-gate untracked | FE-refactor thiếu HTML handoff |

---

## 8. Khuyến nghị (chỉ audit — không thực hiện trong task)

1. **Commit hoặc copy** `web-prototype.html` + `WEB-HANDOFF.md` (+ README) vào repo tracked (FE-refactor hoặc `main`) để tránh mất SoT.
2. **Cập nhật** `PD-PRODUCTION-WEB-HANDOFF.md` palette/type sang Live Pulse v2 hoặc ghi banner «superseded by visual-identity-v2».
3. Lập **route map ADR** cho `/wallet` (hoặc chủ đích gộp vào account) trước khi implement IA mockup.
4. Implementer web: dùng mockup **layout/IA** + `tokens.json` **font/radius** (không copy system font từ file HTML).

---

## 9. Artifact

- File này: `docs/reviews/FE-REFACTOR-MOCKUP-INVENTORY-2026-10-21.md`
- Đọc mockup: `file:///Users/admin/orca/workspaces/main/fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/web-prototype.html`
- Không sửa `apps/*`, không commit, không push (theo task spec).
