# Gap audit PD — handoff / prototype / AC UI vs UI thật (web + iOS)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Ngày | 2026-10-18 |
| Exact SHA (worktree HEAD) | `a507b36a722f34ee65f19f6388254b44966568cb` |
| Tip message | `Merge pull request #367 from hangndat/hangndat/docs-ui-cleanup-reviews` |
| Evidence pin | Spot-check nav paths unchanged vs earlier tip `a8e70ca…` (tabs `_layout`, `site-chrome`, D11 §6.1) |
| Architecture impact | **Không** (audit design↔UI). **Đề xuất** Task `architect` chỉ nếu coordinator xác nhận thiếu permission **signal** client-ready — xem §3.2 |
| OUT | Không sửa `apps/**`; không tạo Issue; không claim pilot/production ready |
| Cross-ref BA | [`GAP-AUDIT-2026-10-18-BA.md`](./GAP-AUDIT-2026-10-18-BA.md) — O02/chrome trùng evidence; artifact này bổ sung góc **PD handoff → AC quan sát được** |

**Verdict ngắn:** Gap P0 rõ nhất vẫn là **D11 §6.1 «Staff ẩn/disabled nếu không có quyền»** vs iOS tab **Nhân viên luôn hiện** — PD đã ghi + ghi «escalate nếu thiếu flag» nhưng **không** thành Issue/Task AC (cùng pattern BA `GAP-BA-O02`). Khuyến nghị PD: **ưu tiên ẩn** (không disable-grey). Nhiều mục PRODUCTION-READINESS-UX (Nest BFF, fixture SoT, Gate web #232) đã **stale** trên tip này. Handoff PD còn «chữ trên giấy» chưa thành AC board: nav theo permission, SiteNav theo session, O13 sales residual tracking.

Phân loại: **Fact** (source @ SHA) · **Inference** · **NV** (chưa headless/device trên tip).

---

## 1. Phương pháp & nguồn PD

| Nguồn PD | Path | Dùng cho |
| --- | --- | --- |
| D11 production UX | `docs/design/D11-PRODUCTION-UX-UI.md` §6.1 · §4 · §7 | IA guest/admin/iOS Staff; UI AC; audit→gap |
| Prototype | `docs/design/d11-prototype/**` | State pattern (≠ runtime) |
| Event server-source | `docs/design/event-server-source/*` | Demo-vs-real / published states |
| O13 sales | `docs/design/o13-platform-sales/*` | Marketing chrome + demo nhãn |
| Readiness UX | `docs/plans/PRODUCTION-READINESS-UX.md` §4.4 residual nav | Known concern không có ID UX-NN |
| UI thật | `apps/web/src/site-chrome.tsx`, marketing `chrome.tsx`, `admin-form.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `screens/staff.tsx` | Đối chiếu |

Không chạy UAT app của worker khác; không GUI.

---

## 2. Nav / chrome — ẩn vs disable (ưu tiên ẩn)

### 2.1 Khuyến nghị PD (chốt trong audit này)

| Tình huống | Khuyến nghị | Lý do |
| --- | --- | --- |
| Attendee / guest **không** có quyền Gate/staff | **Ẩn** tab/menu Staff · Cổng · Admin · Platform | O02 «không cấp quyền mới chỉ vì đổi tab»; giảm privilege signaling; HIG: đừng để control vô hiệu nếu không hành động được |
| Có quyền nhưng thiếu context (chưa chọn event / offline) | **Giữ hiện** + empty/denied **trong** màn (đã có hướng `staff.tsx`) | Khác «không có quyền» |
| Deep-link `/staff` hoặc `/gate` khi không quyền | Fail-closed copy VI + không fake chrome «đã là staff» | Đồng bộ API deny |
| **Disable** (grey tab) | Chỉ fallback tạm nếu platform NativeTabs **không** ẩn được an toàn — ghi known gap; mặc định vẫn **ẩn** | Tránh «có tab nhưng bấm không vào» |

### 2.2 Fact — UI thật @ `a507b36…`

| Surface | PD handoff | UI thật | Khớp? |
| --- | --- | --- | --- |
| **iOS tabs** | D11 §6.1: 3 tab; **Staff ẩn/disabled nếu không có quyền** | `(tabs)/_layout.tsx` luôn `NativeTabs.Trigger` Sự kiện · Vé của tôi · **Nhân viên** — **không** đọc membership/permission | **Không** |
| **iOS Staff empty** | Denied/auth trong state matrix Gate | `staff.tsx` `resolveGateAuth` fail-closed khi thiếu bearer; copy «Đăng nhập staff…»; **tab vẫn luôn có** | API OK / chrome **không** |
| **Web SiteNav** | Guest: Đổi mã · (event) · Đăng nhập; Invite **thành viên** → Owner/admin | Variant **hardcode theo route**: guest=`/redeem|/claim|/auth|…`, staff=`/gate`, admin=`/admin|/account`, platform=`/platform` — **không** derive session | **Không** (O02) |
| **Guest «Nhận lời mời»** | §6.1/§7 lo «Invite trên guest» | `guest` có `/claim` «Nhận lời mời» (attendee claim) — **không** phải membership invite trong nav chính; `/invite` page vẫn `variant="guest"` (accept link) | **Một phần** — claim guest = OK; membership accept trên guest chrome = chấp nhận được nếu không lộ Admin |
| **Admin IA** | Job: Chuẩn bị \| Khách & mã \| Cổng \| Hỗ trợ | `ADMIN_JOBS` đủ 4 tab + `admin-job-nav` | **Có** (source) |
| **Marketing** | O13: brand · Demo · Quan tâm · Login · Privacy/Support | `marketing/chrome.tsx` khớp hướng PD | **Có** (source); NV deploy host `vemoki.com` vs `app.` |

### 2.3 Permission flag — PD từng ghi escalate

D11 §6.1: *«escalate nếu thiếu flag»*.

| Fact | Kết luận |
| --- | --- |
| `MeResponse` chỉ identity (userId/email…) — **không** permissions | Không đủ một mình để ẩn tab |
| Contract **đã có** `MeTenantsResponse.tenantPermissions` + `MeEventsResponse.permissions` (`packages/contracts`) | Flag **không thiếu hoàn toàn** ở API platform |
| iOS **không** gọi `/v1/me/tenants` (hoặc tương đương) để gate tab | Gap = **consumer + rule UI**, không nhất thiết invent permission string mới |
| Web `SiteNav` không đọc `tenantPermissions` | Cùng gap consumer |

**Đề xuất coordinator:** Task coding `ios` (+ `web` chrome) tiêu thụ permissions đã có. Spawn `architect` **chỉ khi** cần chốt permission string canonical cho «hiện Staff» (vd. bất kỳ `gate.*` / role Scanner|Supervisor trên `MeEvents` / `MeTenants`) hoặc mở rộng `/v1/me` aggregate — **không** block viết Issue AC UI.

---

## 3. PD đã ghi nhưng **không** escalate thành Issue / Task AC

> Đây là mục bắt buộc của Task PD gap audit. «Có trong docs/design» ≠ «có trên Project #3 với Given/When/Then».

| # | Nội dung PD | Nơi ghi | Issue / Task AC quan sát được? | Hệ quả UI |
| --- | --- | --- | --- | --- |
| **E1** | Staff tab ẩn/disabled theo quyền; escalate flag | D11 §6.1 | **Không** — `D11-B4-ios-staff-scan` AC chỉ states scan, **không** ẩn tab; không Issue O02 (xác nhận BA) | Tab Nhân viên luôn hiện |
| **E2** | Guest nav không Invite thành viên trên chrome khách | D11 §6.1 · §7 | Không Task riêng «tách claim vs membership invite chrome»; D6 chrome theo **route** đã đóng | Residual: `/invite` guest chrome; `/account` luôn admin chrome |
| **E3** | SiteNav / mode theo **permission** (O01/O02), không theo URL | O02 + PD readiness §4.4 «Kiểm lại sau attendee» | Dòng residual **không** có ID UX-NN; **không** Issue | Chrome gắn route |
| **E4** | UI AC AC-M3 job nav | D11 §4 | Admin jobs **đã** ship source; thiếu revalidate headless tip tích hợp trên SHA này = **NV** | Không P0 mới |
| **E5** | O13 sales GTM handoff đầy đủ | `docs/design/o13-platform-sales/` | BA: **không** Issue Task O13 trên board (cross-ref) | Marketing code có; tracking/DoD board lệch |
| **E6** | Prototype chip DUPLICATE | D11-PD-REVIEW known gap | Chấp nhận design-review; coding Gate đã có DUPLICATE phase — **không** bắt buộc Issue PD | Đóng góc PD |

**Pattern:** PD handoff «đủ design» + ghi escalate, nhưng planner/coding wave chỉ lấy AC scan/admin/home → **nav permission bị rơi xuống khe**.

---

## 4. Demo vs real labels

| Bề mặt | Fact @ `a507b36…` | Gap PD? |
| --- | --- | --- |
| Web home | Published catalog + `isExplicitDemoLabel` → « · Demo»; aside «Danh sách từ máy chủ» — **không** còn «Nest BFF» guest jargon | UX-02 **stale**; còn NV prod tip = SHA deploy |
| iOS events | `showDemoEventCatalog()` footer «Demo · dữ liệu mẫu»; Release ẩn fixture | OK hướng O15; NV TestFlight |
| O13 marketing | Copy/badge «Demo giả lập» trong PD + `MarketingChrome` demo link | OK design; BA thiếu Issue tracking |
| Gate/vé fixture | Prototype nhãn «KHÔNG dùng vào cổng» | Runtime: không claim vé demo = admit |

---

## 5. Gate / redeem / admin — state coverage residual

Đối chiếu D11 §2 matrix + AC §4 vs source (không claim UAT tip).

| Vùng | PD state / AC | Source tip | Residual |
| --- | --- | --- | --- |
| Redeem auth / unknown / issued | AC-A1…A4 | messages VI + fail-closed codes | OTP vs Keycloak = product (UX-11); không P0 nav |
| Gate iOS queued ≠ admit, CONFLICT | AC-G1…G3 | `staff.tsx` phases + queue | Venue camera / multi-device = **NV** (BA PR-09) |
| Gate web offline | AC-G4 | `GateOfflineShell` + disable confirm | #232 Hoàn thành (BA); NV revalidate |
| Admin readiness / publish | AC-M1…M3 | readiness helpers + job nav 4 | Sticky UUID progressive disclosure residual **P2**; a11y **NV** |
| Staff **tab** denied | §6.1 | Chỉ deny **trong** màn | **P0** — xem §6 |
| Staff empty (đã login, chưa session Gate) | idle EmptyState | Có `scanCopy.idle` | OK trong màn |

---

## 6. Gap list + UI AC Given/When/Then (mọi **P0**)

### 6.1 P0

#### GAP-PD-01 — iOS Staff tab luôn hiện (D11 §6.1 / O02)

| | |
| --- | --- |
| Evidence | `(tabs)/_layout.tsx` luôn Trigger `staff`; D11 §6.1; E1 không Issue |
| Rủi ro | Attendee thấy «Nhân viên» → privilege signaling; lệch O02 |
| Owner đề xuất | `ios` (primary); soft dep rule permission từ `me/tenants`\|`me/events` |
| Hide vs disable | **Ẩn** |

```text
Given người dùng chưa đăng nhập HOẶC đã đăng nhập nhưng không có quyền Gate/check-in (không membership Scanner/Supervisor/… theo rule chốt)
When mở shell tab iOS
Then tab «Nhân viên» không xuất hiện trong NativeTabs

Given cùng user deep-link vào route staff
When layout resolve
Then không vào được luồng quét; hiện empty/denied VI fail-closed (không camera admit)

Given người dùng có ≥1 tenant/event permission Gate đủ điều kiện
When mở shell tab iOS (sau khi permissions load xong; loading: không flash tab rồi biến mất nếu tránh được)
Then tab «Nhân viên» hiện và vào được StaffScreen
```

**Headless:** `scripts/sim-uat.sh` — session fixture không quyền → assert không có accessibility label «Nhân viên»; session có quyền → có tab. Exact SHA trên PR.

#### GAP-PD-02 — Web SiteNav theo route, không theo permission (O02 chrome)

| | |
| --- | --- |
| Evidence | `site-chrome.tsx` LINKS + `SiteNav variant=` hardcode per page; E3 |
| Rủi ro | Guest URL `/gate` vẫn chrome staff; `/account` luôn admin links |
| Owner | `web` |
| Hide vs disable | **Ẩn** link không đủ quyền |

```text
Given session không có quyền Gate
When render bất kỳ trang product (kể cả gõ URL /gate)
Then SiteNav không hiện link «Cổng» như thể đã có quyền; body vẫn fail-closed auth/API

Given session không có quyền admin tenant
When ở /redeem hoặc /
Then không hiện «Sự kiện» admin / «Platform» như staff đã login

Given session Owner/Manager đủ quyền
When ở /redeem
Then được phép có lối vào Admin (hoặc Tài khoản) theo IA — không bắt buộc chỉ khi URL = /admin
```

**Headless:** Playwright với cookie/session fixture permissions; assert `nav` link set.

#### GAP-PD-03 — Handoff Staff-ẩn không thành Task AC (process / board)

| | |
| --- | --- |
| Evidence | §3 E1; BA `GAP-BA-O02` |
| Rủi ro | Wave sau vẫn ship chrome không theo O02 |
| Owner | Coordinator / planner — **tạo Issue** với AC §6.1 (không bịa số ở đây) |

```text
Given PD D11 §6.1 và O02 đã chốt
When planner mở Task ios/web nav-permission
Then Issue body chứa AC Given/When/Then giống GAP-PD-01 và GAP-PD-02 (hoặc link artifact này + SHA)
And Definition of Done yêu cầu reviewer exact-SHA + sim-uat/web-uat chứng minh ẩn (không chỉ API deny trong màn)
```

### 6.2 P1 (tóm tắt — AC ngắn)

| ID | Gap | UI AC (rút) |
| --- | --- | --- |
| GAP-PD-11 | `/account` luôn `variant="admin"` | Given guest session When /account Then chrome không lộ Platform/Admin như đã có quyền |
| GAP-PD-12 | Chưa chốt permission string «hiện Staff» | Given architect/BA note When coding Then dùng canonical list (không đoán role UI) |
| GAP-PD-13 | O13 board tracking (cross-ref BA) | Given marketing surface When DoD Then AC O13-1… trong design README gắn Issue |
| GAP-PD-14 | A11y residual (live region queued/unknown) | Given Gate unknown/queued When SR Then assertive announce — NV axe/VO |
| GAP-PD-15 | UX-11 Keycloak vs OTP | Product pin — không nav |

### 6.3 P2 / stale (không spawn lại)

| ID gốc readiness | Tip `a8e70ca` | Ghi chú PD |
| --- | --- | --- |
| UX-01 fixture SoT | Board #254 family done; home published-first @ tip | Stale-as-open |
| UX-02 Nest BFF | Đã gỡ guest copy | Đóng source |
| UX-05 Gate web #232 | Hoàn thành | Stale |
| Admin job IA thiếu | 4 job đã có | Đóng design gap chính |

---

## 7. Map handoff → hành động coordinator (không tự dispatch)

| Ưu tiên | Việc | Role |
| --- | --- | --- |
| 1 | Tạo Issue(s) nav-permission O02 với AC GAP-PD-01 + GAP-PD-02 (+ GAP-PD-03 process) | Planner / BA + PD AC đã có |
| 2 | Optional spike: permission predicate từ `MeTenants`/`MeEvents` | `architect` chỉ nếu predicate chưa rõ |
| 3 | Coding ios ẩn tab ∥ web SiteNav theo session | `ios` ∥ `web` |
| 4 | Errata pointer PRODUCTION-READINESS-UX §4.4 nav → artifact này + BA audit | docs (coordinator) |
| 5 | O13 Issue tracking nếu còn GTM DoD | BA/web |

---

## 8. Checks đã chạy (docs / source only)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `a507b36a722f34ee65f19f6388254b44966568cb` |
| Đọc D11 §6.1, PRODUCTION-READINESS-UX §4.4, O02, site-chrome, tabs `_layout`, staff.tsx, marketing chrome, admin ADMIN_JOBS | Done |
| `MeResponse` vs `MeTenants`/`MeEvents` permissions | Flag API có; iOS tab không consume |
| `gh` / board cross-check qua BA artifact cùng ngày | Không Issue O02/staff-hide riêng |
| Runtime UAT / simulator | **Không chạy** (OUT) |

---

## 9. DoD role PD (task gap audit)

- [x] Đối chiếu PD handoff/prototype/AC vs UI web+iOS
- [x] Đặc biệt D11 §6.1 Staff ẩn vs tab luôn hiện
- [x] Khuyến nghị ẩn > disable
- [x] Demo vs real; Gate/redeem/admin residual
- [x] Liệt kê chỗ PD ghi nhưng không escalate Issue
- [x] Gap list + UI AC GWT cho mọi P0
- [x] Exact SHA trên artifact
- [x] Không implement UI

**Không:** commit/push bắt buộc bởi task (artifact local); spawn worker; tuyên bố production ready.
