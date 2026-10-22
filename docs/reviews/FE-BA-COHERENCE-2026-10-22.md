# FE BA Coherence — web guest → portal (Epic #715 follow-up)

| Trường | Giá trị |
| --- | --- |
| Task | `task_008fae9e4308` · Role `product-ba` |
| Ngày | 2026-10-22 |
| Worktree SHA (đọc code) | `ad369787fb0712a0679651a7f6d50b7fc191b627` |
| Prod quan sát | `https://app.vemoki.com`, `https://portal.vemoki.com` (guest, không đăng nhập prod) |
| SoT hành vi/IA | `docs/plans/mobile-production-refactor/WEB-HANDOFF.md`, `web-prototype.html` |
| SoT phạm vi | `docs/PRD.md`, `docs/DECISION-LOG.md` (O10/O13/O16) |
| Evidence trước | `docs/reviews/FE-REFACTOR-*-2026-10-21.md`, `docs/reviews/UAT-PROD-WEB-2026-10-21.md` |
| Ảnh | `docs/reviews/assets/FE-BA-COHERENCE-2026-10-22/` (Playwright Chrome headless 1280×800, 390×844) |
| Phạm vi | **Docs-only** — không sửa `apps/*`, không commit |

## Tóm tắt điều phối

Rà soát toàn bộ surface web product (`apps/web`) và điểm chạm portal (`apps/portal` qua prod + design docs), đối chiếu mockup đã duyệt 20/10/2026 và UAT prod retest 13. Nhiều lệch **nghiệp vụ / IA / copy** vẫn còn: hai không gian quản trị (app legacy + portal Ant Design), thuật ngữ «lời mời» chồng chéo, nav trùng nhãn, demo seed trên catalog prod, và English lẫn tiếng Việt ở operator. Refactor chrome Epic #715 đã cải thiện catalog/gate/wallet so với gap UAT 21/10 nhưng **chưa đồng bộ design system** giữa app tự viết CSS và portal.

**Không mở rộng MVP:** payment, Android native, seat map, Wallet, browser push, platform-superadmin trong refactor mockup (theo PRD + WEB-HANDOFF).

---

## Phương pháp

1. Đọc PRD §non-goals, DECISION-LOG O13/O16, WEB-HANDOFF, PORTAL-ANTD-UX.
2. Rà `apps/web` routes (`app/**/page.tsx`), nav (`capabilities.ts`, `site-chrome.tsx`), copy lỗi/trống (`auth-notice`, `redeem/messages`, `published/copy`).
3. Đối chiếu artifact FE-REFACTOR + UAT prod (GO retest 13 @ `81bd804` — runtime có thể tiến thêm).
4. Chụp prod guest: Playwright `channel: chrome`, viewports theo task.

---

## Persona × job-to-be-done (phạm vi báo cáo)

| Persona | JTBD chính | Surface |
| --- | --- | --- |
| Khách (guest) | Tìm sự kiện, hiểu cách lấy vé | `/`, detail, `/redeem` |
| Người tham dự (attendee) | Ví, QR, đổi mã, nhận invite sự kiện | `/wallet`, ticket, `/redeem`, `/claim` |
| Nhân viên cổng | Check-in nhanh, rõ phạm vi | `/gate` (app) |
| Quản trị tổ chức | Event, import, members, branding | `portal.vemoki.com` (+ `/admin` legacy app) |
| Operator platform | Tenant provisioning | `/platform` (app) — **ngoài mockup refactor** |

---

## Nhóm chủ đề

### A — Hai «admin» và ranh giới host (O13 / O16)

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| BA-001 | `/admin` ↔ `portal.vemoki.com/admin` | Song song: banner «Portal admin đang chạy song song» trên app admin; redirect GET sang portal **mặc định tắt**. User bookmark `/admin` trên app vẫn thấy form legacy dài, khác IA sidebar portal Ant Design. | Org admin | **P1** | PD chốt **single SoT admin** cho pilot: portal-only + CTA rõ từ app; hoặc cutover flag + tắt legacy khi đủ parity. Banner thêm «Quản trị chính thức» vs «phiên bản cũ». | PD, FE, coordinator |
| BA-002 | Nav «Sự kiện» × 2 | Khi `showAdmin`, nav có **hai** link nhãn **«Sự kiện»**: `/` (catalog) và `/admin` (`capabilities.ts` `buildNavLinks`). | Org admin / attendee | **P1** | Đổi nhãn admin → «Quản trị» / «Tổ chức»; hoặc link admin → portal URL. | FE, PD |
| BA-003 | `/?notice=admin_denied` | Attendee/staff vào `/admin` bị đẩy home + notice «Không đủ quyền quản trị» — **không** gợi ý portal hay liên hệ owner có link. | Org admin (nhầm) | **P2** | Thêm CTA «Mở portal quản trị» (nếu có `PORTAL_ORIGIN`) + copy phân biệt «quản trị tổ chức» vs «tham dự sự kiện». | PD, FE |
| BA-004 | `app.vemoki.com/marketing` | Trang sales/GTM vẫn mount trên **product host** (`/marketing`) trong khi O13 chốt apex `vemoki.com` = sales. Guest prod thấy hai «thế giới» marketing. | Guest / buyer | **P2** | Redirect 301 marketing paths trên app → apex (đã có `decideHostRouting`); hoặc ẩn nav tới `/marketing` trên app. | FE, coordinator |
| BA-005 | Footer product | Footer luôn «Sự kiện · Đổi mã · Tài khoản» — `/account` guest → login; không có «Portal» cho staff. | All | **P3** | Footer phân vai: guest vs logged-in; link «Quản trị» khi `showAdmin`. | PD, FE |

### B — Thuật ngữ «mời» / «đổi mã» / CTA

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- |
| BA-010 | `/redeem` vs `/claim` vs `/invite` | Ba luồng: **đổi mã vé**, **nhận lời mời sự kiện** (guest claim), **nhận lời mời thành viên org** (`/invite`). Mockup web **không** có claim; nav guest **không** hiện «Nhận lời mời» (chỉ sau đăng nhập trong `PRODUCT_NAV_LINKS`). Email/link claim dễ vào `/claim` không qua nav. | Guest / attendee | **P1** | PD: một bảng thuật ngữ user-facing; guest nav thêm «Nhận lời mời» **hoặc** gộp vào redeem với subcopy. Trang `/claim` giữ disclaimer nhưng rút gọn. | PD, FE |
| BA-011 | Nav «Đổi mã» vs copy «Đổi mã lấy vé» | Nav/footer «Đổi mã»; H1/form «Đổi mã lấy vé» — chấp nhận nhưng mobile iOS có thể khác label. | Attendee | **P3** | Chuẩn hóa một cụm trong glossary (nav ngắn, title đủ). | PD |
| BA-012 | `/invite` title | «Nhận lời mời **thành viên**» vs `/claim` «**sự kiện**» — tốt có phân biệt; admin tab «Lời mời» (import batch) là nghĩa thứ ba. | Org admin / member | **P2** | Đổi nhãn admin → «Mời khách / đợt gửi» hoặc tách «Membership invite» trong portal. | PD, portal FE |
| BA-013 | Guest `/redeem` | Prod: auth gate «Tiếp tục đăng nhập» — **khớp** WEB-HANDOFF. Form kỹ thuật (UUID) chỉ sau login / «Tùy chọn nâng cao». | Guest | **P2** | Giữ gate; ẩn hoàn toàn UUID trên prod UI trừ support mode. | FE |
| BA-014 | Scoped redeem URL | `/redeem?tenantSlug=mfest-demo&eventSlug=mfest` — đúng UAT #731; copy lead «Một mã duy nhất» vẫn đúng nhưng nên hiện **tên sự kiện** khi scoped. | Attendee | **P2** | Hiển thị chip «MFest Demo» khi slug resolve OK. | FE, BE |

### C — IA catalog / ví / tài khoản (mockup 20/10)

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- |
| BA-020 | `/` catalog | **Đã có** search + filter «Sắp diễn ra» + grid (`HomeCatalogGrid`) — tiến so với FE-REFACTOR-GAP 21/10. Prod hiển thị sự kiện `mfest-demo`, `demo-studio`. | Guest | **P2** | PD xác nhận layout 3 cột desktop vs code; owned count trên card khi đăng nhập (handoff). | PD, FE |
| BA-021 | Demo trên prod catalog | Tenant slug `mfest-demo`, `demo-studio` là **D9 seed** — không nhãn «Demo» nổi trên card trừ tên org có «· Demo». Khách có thể nhầm sự kiện thật. | Guest | **P1** | Badge «Demo» trên card + filter ẩn demo (env); hoặc tách host preview. | PD, BE, coordinator |
| BA-022 | `/wallet` | Route **đã có** (mockup inventory 21/10 ghi «chưa có» — **lỗi thời**). Nav guest: không «Vé của tôi» — đúng handoff. | Attendee | **P3** | Cập nhật inventory docs; kiểm tra filter `?event=` UX vs mockup chip. | PD, FE |
| BA-023 | `/account` + `/privacy` | Account có shell 2 cột qua `AccountShell` cho privacy — **cải thiện**. Thông báo web = copy tĩnh (đúng non-goal push). | Attendee | **P3** | PD: sidebar đủ nhóm mockup (Thông báo / Quyền riêng tư) nếu còn thiếu mục. | PD, FE |
| BA-024 | Event detail `/t/.../events/...` | Tenant chrome (wordmark org) vs global nav mockup — handoff cho phép tenant branding; sidebox «Đổi mã» cần đối chiếu visual PD. | Guest | **P2** | Ticket FE refactor detail 2 cột + sticky sidebox. | PD, FE |
| BA-025 | Ticket detail | Intro hiển thị **slug** tenant (`tenantSlug`) thay vì tên org thân thiện. | Attendee | **P2** | Dùng `orgName` từ API; slug chỉ trong «chi tiết kỹ thuật». | FE, BE |

### D — Cổng / quyền / thông báo lỗi

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- |
| BA-030 | `/?notice=gate_denied` | Copy rõ; thiếu «Bạn vẫn có thể xem vé tại Vé của tôi». | Attendee | **P3** | Thêm link `/wallet`. | FE |
| BA-031 | `/gate` | Tab Quét / Nhập / Lịch sử **đã có** (Slice G). Link portal C03 «Mở cổng quét trên app» — đúng. | Staff | **P3** | iOS vs web: PD note ưu tiên quét mobile tại cổng. | PD |
| BA-032 | Auth notices | `auth_failed` → «Không đăng nhập được» + Thử lại — **không** map `admin_denied` qua `authNoticeFromParam` (đúng kỹ thuật); user chỉ thấy staff notice riêng. | All | **P3** | — | — |
| BA-033 | Redeem errors | Nhiều mã BFF — copy trong `redeem/messages.ts` khá đủ; một số vẫn kỹ thuật («biểu mẫu», «điều khoản»). | Attendee | **P2** | PD pass plain-language cho top 5 lỗi prod (D02/D03 UAT). | PD, FE |
| BA-034 | `/gate` dev copy | Gate page dev-only «Chi tiết kỹ thuật» — prod ẩn; OK. | — | **P3** | — | — |

### E — Design system / parity web · portal · mobile

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- |
| BA-040 | `app` vs `portal` | App: ~2k dòng `globals.css`, radius 2px «ops». Portal: Ant Design token map — **cùng brand** nhưng cảm giác khác hẳn. User feedback «không hợp lý» gắn với **không một framework**. | All | **P1** | Epic design system: token shared (`brand/vemoki/tokens.json`) + component spec; portal SoT admin, app SoT attendee/gate. | PD, FE, architect |
| BA-041 | `/platform` | Title/metadata **English** «Platform console»; body lẫn VI/EN («Status PENDING», «invites=»). Ngoài mockup refactor. | Operator | **P2** | Việt hóa hoặc chốt EN-only operator UI; không lộ trên nav thường. | PD, FE |
| BA-042 | Mobile parity | iOS: redeem/claim/wallet flows riêng; web có `/claim` public, iOS deep link — cần cùng glossary. | Attendee | **P2** | BA checklist cross-surface (O10). | PD, mobile |
| BA-043 | Responsive nav | `site-chrome.tsx` có mobile menu + active state — **đã có** so với gap 21/10; cần UAT 390px trên prod sau deploy. | Guest | **P3** | Re-chụp sau release. | FE |

### F — Portal (guest observe + docs)

| ID | Route / flow | Mô tả | Persona | Sev | Đề xuất | Owner |
| --- | --- | --- | --- | --- | --- |
| BA-050 | `portal.vemoki.com/` guest | Ảnh prod: landing login Keycloak — **đúng** thiết kế staff-only. Attendee login portal → copy «Portal quản trị chỉ dành cho nhân sự» (UAT B06). | Attendee | **P2** | Trang từ chối có link «Về app.vemoki.com» nổi bật. | portal FE, PD |
| BA-051 | Onboarding org | UAT C01 Aurora — ngoài phạm vi guest screenshot; coherence: tên «Night Org» vs event thật. | Org admin | **P3** | Seed naming guideline D9. | PD |

---

## Top 10 ưu tiên (trước cutover design system)

| Rank | ID | Lý do |
| --- | --- | --- |
| 1 | BA-040 | Nguyên nhân gốc phản hồi user — hai stack UI |
| 2 | BA-001 | Hai admin gây nhầm quyền và bookmark sai |
| 3 | BA-002 | Nav trùng «Sự kiện» — lỗi IA rõ ràng trong code |
| 4 | BA-010 | Ba nghĩa «lời mời» + claim khó tìm |
| 5 | BA-021 | Demo seed trên prod catalog |
| 6 | BA-003 | `admin_denied` không dẫn portal |
| 7 | BA-004 | Marketing trên app host trái O13 |
| 8 | BA-012 | Admin «Lời mời» vs membership invite |
| 9 | BA-025 | Ticket hiện slug thay tên org |
| 10 | BA-033 | Lỗi redeem cần copy hướng dẫn hành động |

---

## Câu hỏi cần user / PD quyết (không tự mở MVP)

1. **Admin SoT:** Pilot có **bắt buộc** mọi quản trị trên `portal.vemoki.com` và ẩn `/admin` app, hay giữ dual-run đến khi nào? Có bật redirect flag prod không?
2. **Claim trên web:** `/claim` có là **first-class** (nav guest) hay chỉ deep link email (như mockup không có)?
3. **Catalog prod:** Demo tenants (`mfest-demo`, `demo-studio`) có **hiển thị công khai** vô thời hạn hay cần badge/toggle env?
4. **Marketing host:** `app.vemoki.com/marketing` có redirect hẳn sang `vemoki.com` trước store launch?
5. **Gate web vs iOS:** Staff tại cổng — web quét có là parity bắt buộc hay «nice to have» sau iOS?
6. **Platform console:** Tiếp tục EN nội bộ hay Việt hóa — ai là audience duy nhất?
7. **Design system:** Một DS cho app attendee **+** portal admin, hay portal giữ Ant Design và app refactor token-only?
8. **Event detail nav:** Global `SiteNav` hay tenant wordmark only (mockup vs branding D8)?

---

## Epic #715 — gợi ý follow-up Task

| Task gợi ý | Phụ thuộc | Owner |
| --- | --- | --- |
| PD glossary + nav IA (BA-002, BA-010, BA-012) | User trả lời Q1–Q2 | PD |
| FE: nav labels + denied notices + scoped redeem chip | Glossary | FE |
| FE: marketing redirect hardening O13 | Q4 | FE |
| Portal: attendee rejection page CTA | BA-050 | portal FE |
| DS epic (token + component parity) | Q7 | PD + architect + FE |
| Demo catalog policy | Q3 | BE + coordinator |

---

## Evidence ảnh (prod guest)

| File | Nội dung |
| --- | --- |
| [home-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/home-desktop.png) | Catalog + nav guest |
| [home-mobile.png](assets/FE-BA-COHERENCE-2026-10-22/home-mobile.png) | Catalog mobile |
| [event-mfest-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/event-mfest-desktop.png) | Chi tiết MFest demo |
| [redeem-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/redeem-desktop.png) | Auth gate đổi mã |
| [redeem-scoped-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/redeem-scoped-desktop.png) | Redeem scoped slug |
| [claim-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/claim-desktop.png) | Nhận lời mời sự kiện |
| [invite-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/invite-desktop.png) | Membership invite |
| [account-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/account-desktop.png) | Tài khoản guest |
| [marketing-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/marketing-desktop.png) | Sales trên app host |
| [portal-home-desktop.png](assets/FE-BA-COHERENCE-2026-10-22/portal-home-desktop.png) | Portal login |

(Mobile: cùng tên `*-mobile.png`.)

---

## Bảng đầy đủ (tra cứu)

| ID | Route/flow | Mô tả ngắn | Persona | Sev | Đề xuất | PD | FE | BE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BA-001 | admin dual-run | Hai admin app+portal | Org admin | P1 | Chốt SoT + cutover | ✓ | ✓ | — |
| BA-002 | nav | Hai link «Sự kiện» | All | P1 | Đổi nhãn admin | ✓ | ✓ | — |
| BA-003 | admin_denied | Thiếu CTA portal | Org admin | P2 | Link portal | ✓ | ✓ | — |
| BA-004 | /marketing | Sales trên app host | Guest | P2 | Redirect apex | — | ✓ | — |
| BA-005 | footer | Nav footer tĩnh | All | P3 | Phân vai | ✓ | ✓ | — |
| BA-010 | claim/redeem/invite | Thuật ngữ chồng | Guest | P1 | Glossary + nav | ✓ | ✓ | — |
| BA-011 | redeem labels | Đổi mã vs đổi mã lấy vé | Attendee | P3 | Chuẩn hóa | ✓ | ✓ | — |
| BA-012 | admin invites | Ba nghĩa mời | Org admin | P2 | Đổi nhãn admin | ✓ | ✓ | — |
| BA-013 | redeem UUID | Advanced kỹ thuật | Guest | P2 | Ẩn prod | — | ✓ | — |
| BA-014 | scoped redeem | Thiếu tên event | Attendee | P2 | Chip tên | — | ✓ | ✓ |
| BA-020 | catalog | Layout vs mockup | Guest | P2 | PD sign-off | ✓ | ✓ | — |
| BA-021 | demo prod | Seed công khai | Guest | P1 | Badge/filter | ✓ | ✓ | ✓ |
| BA-022 | wallet | Doc lỗi thời | Attendee | P3 | Update docs | ✓ | ✓ | — |
| BA-023 | account | Sidebar | Attendee | P3 | PD checklist | ✓ | ✓ | — |
| BA-024 | event detail | Layout 2 cột | Guest | P2 | Refactor | ✓ | ✓ | — |
| BA-025 | ticket slug | Hiện slug | Attendee | P2 | Tên org | — | ✓ | ✓ |
| BA-030 | gate_denied | Thiếu link ví | Attendee | P3 | Link wallet | — | ✓ | — |
| BA-031 | gate tabs | Đã có Slice G | Staff | P3 | iOS note | ✓ | — | — |
| BA-032 | auth notice | Tách staff/auth | All | P3 | — | — | — | — |
| BA-033 | redeem errors | Copy kỹ thuật | Attendee | P2 | Plain language | ✓ | ✓ | — |
| BA-034 | gate dev | OK | — | P3 | — | — | — | — |
| BA-040 | DS split | CSS vs Ant Design | All | P1 | DS epic | ✓ | ✓ | — |
| BA-041 | platform EN | English console | Operator | P2 | VI hoặc EN | ✓ | ✓ | — |
| BA-042 | mobile | Parity glossary | Attendee | P2 | Cross-surface | ✓ | ✓ | — |
| BA-043 | mobile nav | Cần UAT 390 | Guest | P3 | QA | — | ✓ | — |
| BA-050 | portal guest | CTA về app | Attendee | P2 | Link app | ✓ | ✓ | — |
| BA-051 | seed names | Demo naming | Org admin | P3 | Guideline | ✓ | — | ✓ |

---

## Ghi chú so với UAT prod 21/10

- Retest 13 **GO** cho catalog/redeem/gate core — các issue BA ở đây **không** lật GO kỹ thuật mà là **coherence / pilot UX**.
- E01/E07 gate loading đã xử lý trên tip `81bd804`; báo cáo này không re-validate runtime — coordinator dùng SHA deploy hiện tại khi spawn fix.

**Verdict BA:** **FAIL coherence** (nhiều P1/P2 IA & DS) — **không chặn** merge kỹ thuật đơn lẻ; **chặn** «pilot ready» và đồng bộ UI user yêu cầu cho đến khi Q1/Q7 có quyết định và top 10 có owner.
