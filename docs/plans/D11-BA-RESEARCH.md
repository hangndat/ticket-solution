# D11 — Nghiên cứu BA: mở rộng MVP theo hướng UX/UI production-ready

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này (`docs/plans/D11-BA-RESEARCH.md`) |
| Ngày soạn | 2026-10-18 |
| Tracking Project #3 | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story [#223](https://github.com/hangndat/ticket-solution/issues/223) → Task BA [#224](https://github.com/hangndat/ticket-solution/issues/224) · PD [#225](https://github.com/hangndat/ticket-solution/issues/225) · Planner [#226](https://github.com/hangndat/ticket-solution/issues/226) |
| Ủy quyền | User 2026-10-18: nghiên cứu + thiết kế ổn cho production — **không** feature coding / deploy / store submit. Định hướng mở rộng đã authorized; **proposal chi tiết cần user review trước coding**. |
| Ngôn ngữ | Tiếng Việt (giữ ID, API, SHA, URL nguyên bản) |
| Trạng thái | **Đề xuất để user review** — **không** tự nâng thành scope đã duyệt; worker không đóng Issue / không sửa ROADMAP·PRD·DECISION-LOG |

### Ranh giới tuyên bố (bắt buộc)

| Được | Không được |
| --- | --- |
| Phân biệt **quan sát** / **suy luận** / **giả thuyết** | Bịa phỏng vấn user, metrics đã đo, UAT chưa có |
| Đề xuất P0/P1/P2 + stories/AC | Claim “pilot ready” / “production ready” / store live |
| Benchmark từ trang chính thức (public) | Tạo account / trial / scrape có đăng nhập |
| Liên hệ PD qua coordinator | Sửa `apps/**`, contract, lockfile; spawn worker con |
| Tách **fix** vs **mở rộng** | Hồi sinh Android / payment / refund / transfer / seat / Wallet |

**Bối cảnh board (theo task ủy quyền 2026-10-18):** D0–D10 đã **Hoàn thành** trên Project #3 live (100/101 item; [#7](https://github.com/hangndat/ticket-solution/issues/7) hủy). `docs/ROADMAP.md` còn mô tả trạng thái cũ hơn board — **board thắng** cho Status động.

---

## 1. Vấn đề / outcome

**Vấn đề:** Sau D0–D10, nền tảng Vemoki đã có đủ module MVP mở rộng (O10) về chức năng + polish D6 + offline Gate D7 + white-label D8 + demo/media D9 + metadata store prep D10. User muốn **đẩy mạnh UX/UI** và làm rõ hướng nghiệp vụ cho trải nghiệm “ổn cho production” — tức acceptance/ops gates và cải tiến trải nghiệm có ưu tiên, **không** đồng nghĩa đã sẵn sàng pilot/production.

**Outcome mong muốn (đề xuất):** Có bản nghiên cứu BA đủ để (1) user quyết định phạm vi D11+, (2) PD thiết kế UI/IA, (3) Epic planner tách Story/Task — với non-goals rõ và metrics đo được sau này.

---

## 2. Phương pháp & hạn chế bằng chứng

| Bước | Nguồn | Loại |
| --- | --- | --- |
| Personas / journeys | [`docs/PRD.md`](../PRD.md) §3, §5, §7 | Quan sát (tài liệu sản phẩm) |
| Quyết định / non-goals | [`docs/DECISION-LOG.md`](../DECISION-LOG.md) O01–O10, ADR liên quan | Quan sát |
| UX plan đã làm | [`docs/plans/D6-UX-UI-PLAN.md`](./D6-UX-UI-PLAN.md) | Quan sát (audit D6 + DoD) |
| Pain / known gaps | `docs/reviews/D4-*`, `D5-*`, `D6-*`, `D7-*`, `D8-*`, `D10-*` | Quan sát (DoD/UAT artifacts) |
| Kiến trúc | code-review-graph-ticket `get_architecture_overview_tool` | Quan sát có hạn chế (graph **stale**: built SHA ≠ HEAD) |
| Benchmark | Trang chính thức Eventbrite, Ticketbox, Accelevents, Fever, Splash — **ngày truy cập 2026-10-18** | Quan sát public web |
| JTBD / ưu tiên | Tổng hợp từ trên | **Suy luận** BA; cần user chốt |

**Không có:** nghiên cứu user thật, analytics production, A/B, heatmap, interview transcript.

**Hạn chế graph:** overview 14 communities; `head_matches_build=false` tại thời điểm đọc — không dùng graph để suy hành vi runtime; pain points lấy từ docs/reviews.

Đọc source **có giới hạn** (đối chiếu IA admin + follow-up coordinator): `apps/web/app/admin/admin-form.tsx` (~1930 dòng, một surface) — không sửa code; không claim đã UAT admin runtime trên `main` trong phiên này.

### 2.1 Evidence tươi từ coordinator (2026-10-18) — quan sát

| Quan sát | Nguồn | Phân loại |
| --- | --- | --- |
| `https://vemoki.com/` HTTP 200, title Vemoki (headless `scripts/web-uat.sh` → `/tmp/d11-baseline-public.png`) | Coordinator mailbox | Quan sát public, không auth |
| `https://vemoki.com/privacy` → **HTTP 404** (curl, 2026-10-18) | Coordinator mailbox | Quan sát — xác nhận lại gap D10 G1 bằng evidence tươi |
| Screenshot lịch sử D8 `docs/reviews/d8-uat/web/d8-admin.png`: form rất dài, nhiều task quản trị trên một trang | Coordinator xem trực tiếp + file artifact | **Evidence lịch sử D8** — chưa tự chứng minh pixel runtime `main` hôm nay |
| Screenshot lịch sử D8 `d8-home.png`: copy demo / disclaimer kỹ thuật (fixture, Nest BFF, `/auth`) | Artifact + mô tả ảnh | Evidence lịch sử D8; cần PD copy production-lite |

### 2.2 Đối chiếu source admin hiện tại (quan sát code, 2026-10-18)

File `apps/web/app/admin/admin-form.tsx` vẫn là **một component khổng lồ** gom nhiều job trên một trang, với section headings kiểu kỹ thuật, ví dụ (grep source):

- `Tạo / liệt kê event trong tenant`
- `Metadata & lifecycle (C-E)` — mã đợt/kỹ thuật lộ trên UI
- `Ticket type & source`
- `ImportPanel` / báo cáo / `NotificationsPanel` / `ConfigBrandPanel`
- `Duyệt yêu cầu đổi mã`
- `CS — tra cứu và gửi lại email`

**Suy luận:** IA “một trang làm hết” khớp pain coordinator mô tả; ưu tiên **progressive disclosure theo job** (Setup / Guests / Gate / Support) là P0/P1 UX — không chỉ đổi màu/bo góc. **Không** suy pixel layout từ screenshot D8 bằng với DOM `main` chưa chụp lại.

---

## 3. Audit 7 personas & journeys hiện có

Nguồn personas: PRD §3. Journeys demo: PRD §7 (10 bước). Ma trận platform: PRD §5.

### 3.1 Persona × công việc × bề mặt

| Persona | JTBD cốt lõi (rút từ PRD) | Web | iOS | Journey PRD §7 liên quan |
| --- | --- | --- | --- | --- |
| **Platform Operator** | Tạo/kích hoạt tenant, hạn mức, không lẫn dữ liệu | `/platform` | — | Bước 1, 10 |
| **Tenant Owner** | Membership, nhận diện org, quyền nội bộ | Admin tenant + invite | Account (nếu staff) | Bước 1 |
| **Event Manager** | Event → loại vé/nguồn/quota → import → publish → export | `/admin` | Staff tóm tắt | Bước 2–3, 9 |
| **CS** | Tìm vé/yêu cầu, resend email, không sửa quota | Admin CS | Tra cứu theo quyền | Bước 9 |
| **Supervisor** | Ngoại lệ cổng, audit lý do | Gate/admin | Supervisor | Bước 8 |
| **Scanner** | Quét nhanh, kết quả rõ, không trùng | `/gate` dự phòng | Staff scan | Bước 7–8 |
| **Attendee** | Đổi mã → QR → vào cổng (web hoặc app) | Event/redeem/claim | Ví / redeem | Bước 4–6 |

### 3.2 Hành trình end-to-end (PRD §7) — trạng thái acceptance (quan sát từ reviews, không claim “đã pilot”)

| # | Luồng | Evidence / ghi chú | Loại |
| --- | --- | --- | --- |
| 1 | Hai tenant độc lập + Owner | D4 Tenant-2 prod UAT PASS with known gap — [`D4-TENANT2-PROD-UAT.md`](../reviews/D4-TENANT2-PROD-UAT.md) | Quan sát |
| 2–3 | Event + brand + import + publish | Cùng D4; FORM_VERSION_STALE lần đầu redeem đã ghi | Quan sát |
| 4 | Redeem web + email QR | D4 redeem PASS; email delivery = gap lịch sử Mailpit/outbox | Quan sát |
| 5 | Cùng user thấy vé trên app | [#200](https://github.com/hangndat/ticket-solution/issues/200): [`D9-E2E-WEB-IOS-TICKET-DOD.md`](../reviews/D9-E2E-WEB-IOS-TICKET-DOD.md), seed local web redeem → cùng user thấy vé trên iOS | Quan sát evidence lịch sử local; không re-run |
| 6 | Offline ví QR | PRD yêu cầu; D7 tập trung offline **Gate** staff — phân biệt ví offline vs Gate offline | Quan sát (phạm vi D7) |
| 7–8 | Scan + chống trùng + Supervisor | D3 + D7 offline queue/replay PASS (sim) — [`D7-S4-UAT.md`](../reviews/D7-S4-UAT.md) | Quan sát (Simulator ≠ venue thật) |
| 9 | CS resend + export | CS list PASS D4; MinIO export từng 503 | Quan sát |
| 10 | Tenant 2 brand khác | D8 UAT ≥2 tenant brand — [`D8-S4-T1-UAT-DOD.md`](../reviews/D8-S4-T1-UAT-DOD.md) PASS with known gap (chrome fallback Vemoki) | Quan sát |

### 3.3 Gap UX đã ghi nhận trước D11 (từ D6 plan + DoD)

Từ [`D6-UX-UI-PLAN.md`](./D6-UX-UI-PLAN.md) §3.4 (audit trước polish) và DoD D6/D8/D10:

| Gap | Evidence | Fix vs mở rộng |
| --- | --- | --- |
| Chrome/POC từng lệch brand (`ticket↗`, eyebrow đợt) | D6 plan audit; D6 DoD #92 PASS with known gap (AuthPoc nội bộ còn) | Fix (phần lớn đã làm D6; residual naming) |
| Admin mật độ cao / IA một trang | D6 plan §3.2; source `admin-form.tsx` ~1930L (2026-10-18); screenshot lịch sử D8 `d8-admin.png` | Fix IA (**nâng P0**) — progressive disclosure, ẩn ID thô |
| Home public còn copy demo/kỹ thuật | Screenshot lịch sử D8 `d8-home.png`; baseline `vemoki.com` 200 (chưa re-audit copy trên live trong task) | Fix copy/IA (P0/P1) — brand đủ chất lượng, không chỉ skin |
| White-label chrome iOS/web fallback Vemoki | D8-S4-T1 DoD known gap | Fix (P0/P1 tùy mức brand-test) |
| Privacy URL 404; ASC/TF chưa upload | D10 G1–G8 + **curl privacy 404 xác nhận lại 2026-10-18** | Fix ops (P0) — **không** = coding feature mới |
| Invite CSRF / prod revalidation | D4 gap + D5 PR #100 DoD: prod UAT invite còn mở | Fix |
| FORM_VERSION_STALE khi redeem sau publish | D4 evidence intermediate | Fix UX + copy/state (P1) |
| Push: ACCEPTED ≠ DELIVERED (lịch sử); D5 đã có DELIVERED evidence device | [`D5-APNS-DEVICE-UAT-STATUS.md`](../reviews/D5-APNS-DEVICE-UAT-STATUS.md) | Đã cải thiện; còn polish copy trạng thái (P2) |
| O06 retention chưa chốt số | DECISION-LOG O06 | Quyết định chính sách (chặn production data) |

---

## 4. Benchmark 3–5 sản phẩm (public, ngày truy cập 2026-10-18)

Không tạo account/trial. Chỉ trang marketing / Help Center / store listing công khai. So sánh **theo lens Vemoki** (multi-tenant, mã miễn phí, Gate, white-label cấu hình, **không** payment trong MVP).

### 4.1 Bảng tổng hợp

| Sản phẩm | Nguồn đã đọc (2026-10-18) | Điểm mạnh UX/ops liên quan Vemoki | Không áp dụng / ngoài phạm vi MVP |
| --- | --- | --- | --- |
| **Eventbrite Organizer** | [Check-in Help](https://www.eventbrite.com/help/en-us/articles/741083/how-to-check-in-attendees-at-the-event-with-eventbrite-organizer/), [Check-in feature](https://www.eventbrite.com/organizer/features/organizer-check-in-app/), [Roles](https://www.eventbrite.com/help/en-us/articles/509534/how-to-manage-roles-and-permissions/) | Role “Check-in only”; scan + manual search; scan modes (check-in / check-out / validate-only); multi-device sync (claim store listing); feedback rõ khi đã check-in | Payment onsite, Android app, marketplace discovery |
| **Ticketbox (VN)** | [Event Manager Play](https://play.google.com/store/apps/details?hl=en_GB&id=ticketbox.eventmanager) (updated 25 Aug 2026), [ticketbox.vn](https://ticketbox.vn/), App Store listing | Offline scan; manual code entry; đếm check-in theo loại vé; app staff tách / app khách | Seat map, bán vé, Android native (Vemoki hủy) |
| **Accelevents White-label** | [White-label](https://www.accelevents.com/platform/white-label), [Admin check-in](https://support.accelevents.com/en/articles/443011-check-in-attendees-through-the-admin-app), [Kiosk](https://support.accelevents.com/en/articles/6993576-activating-ipad-kiosk-mode) | Brand xuyên đăng ký–email–kiosk–app; kiosk PIN; search + QR; badge print | Custom domain email, CSS tùy ý, app store per-brand, payment walk-in |
| **Fever (Partners)** | [business.feverup.com](https://business.feverup.com/), [Validate ticket](https://feverpartners.zendesk.com/hc/en-us/articles/24421647446930-How-to-validate-a-ticket), [Event mgmt](https://business.feverup.com/en/event-management-software/) | Offline validation; tìm vé bằng email/ID/QR; force validate có cảnh báo; dynamic QR / chống fraud (claim marketing) | Marketplace bán vé, Wallet, transfer, POS |
| **Splash** | [Events platform](https://splashthat.com/platform/events), [Design](https://splashthat.com/platform/design), [Ticketing](https://splashthat.com/platform/ticketing) | Brand library một lần → mọi touchpoint; Host app offline sync claim; kiosk self check-in | Drag-drop builder phức tạp, payment, badge print hardware |

### 4.2 Insight áp dụng Vemoki (suy luận BA)

1. **Scanner UX chuẩn ngành:** chế độ scan rõ (admit / validate-only); tìm thủ công khi camera fail; role tối thiểu chỉ check-in — khớp PRD Scanner + O02 (một app, quyền server).
2. **Offline là hygiene Gate:** Ticketbox + Fever + Splash đều nhấn offline; Vemoki đã có D7 — D11 nên ưu tiên **khả năng hiểu trạng thái queue** (pending/applied/conflict) hơn feature mới.
3. **White-label “đủ tin”:** Accelevents/Splash đo bằng **mọi touchpoint** (web, email, kiosk, chrome app). D8 known gap chrome fallback Vemoki = khoảng cách brand-test còn lại.
4. **Attendee journey tối giản:** Eventbrite/Fever tối ưu “scan → confirm rõ”; Splash tối ưu brand guest. Vemoki guest = redeem + QR — nên ưu tiên **giảm bước / copy trạng thái** hơn thêm module.
5. **Không copy:** payment, seat, Wallet, Android, custom CSS tùy ý, billing — khớp O10 / PRD ngoài phạm vi.

---

## 5. JTBD (Jobs To Be Done) — đề xuất ưu tiên

Mỗi job: persona → khi … → muốn … → để …

| ID | Job | Persona | Ghi chú |
| --- | --- | --- | --- |
| J1 | Khi đứng cổng đông / mạng kém, muốn quét và biết ngay “đã vào / chờ đồng bộ / từ chối vì lý do gì”, để không tạo hàng và không vào trùng | Scanner | Có D7 kỹ thuật; UX trạng thái còn room |
| J2 | Khi khách cầm mã/email, muốn đổi vé và mở QR trong ≤ vài bước trên web hoặc app, để vào cổng mà không cần hiểu “tenant/quota” | Attendee | Core MVP; polish states |
| J3 | Khi cấu hình event, muốn preview brand + publish không làm khách redeem lỗi phiên bản form, để ra mắt sạch | Event Manager | FORM_VERSION_STALE evidence |
| J4 | Khi hỗ trợ khách, muốn tìm vé / gửi lại email / thấy timeline mà không đụng quota, để giải quyết nhanh | CS | Module có; IA/export gaps |
| J5 | Khi chạy multi-tenant / agency, muốn mỗi event/org nhìn đúng brand trên web+app (không lộ chrome platform sai ngữ cảnh), để khách tin đây là sự kiện của họ | Owner / Manager | D8 gap chrome |
| J6 | Khi chuẩn bị phát hành iOS, muốn privacy URL + media + TF path đủ gate, để không bị chặn submit sau này | Platform Operator / Owner sản phẩm | D10 G1–G8 — **ops**, không feature |
| J7 | Khi xử lý nhầm cổng, muốn ghi lý do và đảo trạng thái có audit, để chịu trách nhiệm vận hành | Supervisor | PRD; cần kiểm chứng UX |

---

## 6. Rủi ro usability / task (persona × task)

| Risk | Persona | Severity | Evidence | Mitigation đề xuất |
| --- | --- | --- | --- | --- |
| Không hiểu queue offline vs đã vào cổng | Scanner | Cao | D7 UAT dùng label `OFFLINE_ENQUEUED` / pending — kỹ thuật; chưa có UAT venue | Copy VI + màu + haptics; validate-only mode (benchmark Eventbrite) |
| Redeem 409 FORM_VERSION_STALE gây bỏ cuộc | Attendee | Trung bình | D4 prod evidence | Soft-reload form + copy “cấu hình vừa cập nhật, thử lại” |
| Invite Owner fail CSRF trên UI | Owner | Cao (onboarding) | D4 gap; D5 #100 chưa revalidate prod | Prod UAT invite sau deploy; copy lỗi hành động được |
| Brand chrome fallback Vemoki trên event tenant | Attendee / Manager | Trung bình | D8 DoD | ThemeProvider gắn slug; brand-test PD |
| Admin nav dài → nhầm quyền / nhầm event | Manager / CS | Trung bình | D6 audit | IA theo job (Setup / Guests / Gate / Support) |
| Privacy 404 / ASC chưa điền | Operator | Cao cho store path | D10 checklist | Host `/privacy`; checklist ASC UI |
| Headless/sim PASS ≠ camera/venue | Scanner | Cao nếu claim pilot | ROADMAP §1.1; uat-headless | Gate device thật trước pilot |
| O06 retention chưa chốt | Mọi persona (pháp lý) | Chặn production data | DECISION-LOG | Quyết định user trước dữ liệu thật |

---

## 7. Đề xuất cải tiến nghiệp vụ phục vụ UX

Chỉ đề xuất phục vụ UX — **không** mở payment/seat/Wallet/Android.

| # | Đề xuất nghiệp vụ | Phục vụ UX | Fix / Mở rộng | Phụ thuộc |
| --- | --- | --- | --- | --- |
| B1 | Chuẩn hóa **mã lỗi/user-facing** redeem + Gate (kèm action gợi ý) | Attendee/Scanner hiểu bước tiếp | Fix | BE message catalog + web/iOS copy |
| B2 | **Validate-only** scan mode (không confirm) cho Supervisor đào tạo cổng | Giảm rủi ro quét nhầm lúc setup | Mở rộng nhỏ | Contract Gate + UI mode |
| B3 | **Manual lookup** (mã hiển thị / email đã xác thực) khi camera fail | Scanner không kẹt | Mở rộng nhỏ | Authz Scanner; không lộ PII thừa (PRD M07) |
| B4 | Publish flow: cảnh báo “khách đang mở form cũ” + auto-refresh client | Giảm FORM_VERSION_STALE | Fix | Web redeem + admin publish UX |
| B5 | White-label: quy tắc **khi nào** chrome Vemoki vs tenant (shell store vs event surface) | Brand trust | Fix + PD | D8 residual |
| B6 | CS: nhóm “Tìm → Hành động (resend) → Timeline” một panel | Giảm cognitive load admin | Fix IA | Web admin |
| B7 | Ops: host privacy + hoàn tất ASC/TF path (ngoài coding feature) | Store/production path | Fix ops | Ủy quyền riêng |
| B8 | Policy O06 (retention/region) ghi số | Production data gate | Quyết định | User |

**Non-goals giữ nguyên (O10):** Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet; custom domain/sender (O07); workflow builder / SSO / billing (sau MVP).

---

## 8. Ma trận ưu tiên Impact / Effort / Risk

Thang: Impact H/M/L · Effort S/M/L · Risk (kỹ thuật/phạm vi) L/M/H.
**P0** = nên làm trước khi tuyên bố gần production/pilot path. **P1** = đợt UX tiếp. **P2** = backlog có chủ đích.

| ID | Hạng mục | Loại | Impact | Effort | Risk | Prio | Persona chính |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0-1 | Prod revalidate invite/CSRF + copy lỗi | Fix | H | S | L | **P0** | Owner |
| P0-2 | Host `/privacy` + điền ASC fields (ops) | Fix ops | H | S–M | L | **P0** | Operator |
| P0-3 | Gate offline: copy/state VI rõ pending/applied/conflict | Fix | H | M | M | **P0** | Scanner |
| P0-4 | Brand-test white-label: hết fallback chrome sai ngữ cảnh (AC đo được) | Fix | H | M | M | **P0** | Attendee/Manager |
| P0-5 | Chốt O06 retention (số ngày/region tối thiểu) | Quyết định | H | S | — | **P0** | All |
| P0-6 | Admin IA theo job + progressive disclosure (bỏ “một form dài”; ẩn UUID/mã đợt trên chrome chính) | Fix | H | M–L | M | **P0** | Manager/CS |
| P0-7 | Guest home: gỡ copy demo/Nest BFF khỏi đường khách (hoặc nhãn demo cực rõ nếu giữ fixture) | Fix | H | S–M | L | **P0** | Attendee |
| P1-1 | Redeem: xử lý FORM_VERSION_STALE UX | Fix | M | S | L | **P1** | Attendee |
| P1-2 | Admin deep polish (readiness states, tenant/event context sticky) sau P0-6 | Fix | M | M | M | **P1** | Manager/CS |
| P1-3 | Validate-only + manual lookup Gate | Mở rộng | M | M | M | **P1** | Scanner/Supervisor |
| P1-4 | Email template preview brand + trạng thái delivery user-facing CS | Fix | M | M | M | **P1** | CS/Manager |
| P1-5 | Guest home: product landing vs demo directory (quyết định + PD) | Fix/IA | M | S–M | L | **P1** | Attendee |
| P2-1 | Motion/polish residual D6/D9 | Fix | L | S | L | **P2** | All |
| P2-2 | Supervisor exception UX polish | Fix | L | S | L | **P2** | Supervisor |
| P2-3 | Metrics instrumentation (events analytics) | Mở rộng | M | L | M | **P2** | Operator |
| — | Payment / seat / Wallet / Android | — | — | — | — | **Reject** | — |

---

## 9. Stories đề xuất + AC (Given / When / Then)

**Chưa duyệt scope.** Ownership gợi ý cho planner.

### S-P0-A — Onboarding Owner không kẹt invite

**Persona:** Tenant Owner
**Given** tenant mới tạo và Owner nhận link `/invite` trên `vemoki.com`
**When** chấp nhận invite bằng UI chuẩn (cookie/BFF đúng origin)
**Then** membership ACTIVE và vào được admin tenant; nếu lỗi thì message VI có bước khắc phục (không chỉ mã CSRF nội bộ).
**Evidence:** HTTP 2xx + Project comment; không dùng SQL `accept_membership_invite` làm đường chính.

### S-P0-B — Scanner hiểu offline queue

**Persona:** Scanner
**Given** phiên Gate verified và thiết bị mất mạng sau khi quét
**When** xem màn Staff sau quét offline
**Then** UI phân biệt rõ: đã xếp hàng chờ đồng bộ / đã áp dụng / xung đột (kèm mã conflict thân thiện); retry không tạo check-in trùng (giữ invariant D7).
**Evidence:** sim-uat + (khi ủy quyền) device UAT; artifact path + SHA.

### S-P0-C — Brand-test multi-tenant

**Persona:** Attendee + Manager
**Given** ≥2 tenant/event đã publish brand khác nhau
**When** mở web event + iOS surface event tương ứng
**Then** bỏ chrome platform trong crop review vẫn nhận đúng org/event brand; không fallback wordmark Vemoki trên surface event đã resolve brand.
**Evidence:** headless screenshots ≥2 tenant (mẫu D8) + brand-test checklist PD.

### S-P0-D — Privacy & store prep gates

**Persona:** Platform Operator
**Given** docs ASC đã có (D10)
**When** kiểm tra `https://vemoki.com/privacy` và checklist ASC
**Then** privacy HTTP 200; checklist ASC có evidence đã điền (screenshot che secret) **hoặc** ghi rõ còn thiếu — không claim submit.
**Evidence:** curl + docs; submit vẫn cần ủy quyền riêng.

### S-P1-A — Redeem sau publish không “bí ẩn”

**Persona:** Attendee
**Given** Event Manager vừa publish config/form mới trong khi khách đang mở redeem
**When** khách submit
**Then** không dừng ở 409 thô: client refresh form version và hướng dẫn thử lại một lần; thành công thì cấp vé như M07.
**Evidence:** web-uat script + JSON lỗi/thành công.

### S-P0-E — Admin theo việc (nâng từ P1 sau evidence source + D8 screenshot)

**Persona:** Event Manager / CS
**Given** user có quyền Manager hoặc CS trên `/admin`
**When** mở admin
**Then** IA nhóm tối thiểu Setup / Khách & mã / Cổng / Hỗ trợ (progressive disclosure — không một scroll chứa mọi panel); tenant/event context luôn đọc được bằng tên thân thiện; UUID/mã kỹ thuật (`C-E`, …) không phải chrome chính; CS không thấy control đổi quota.
**Evidence:** headless screenshots trước/sau + authz test; đối chiếu không dùng screenshot D8 làm proof runtime trừ khi chụp lại trên tip đang duyệt.

### S-P0-F — Guest home production-lite

**Persona:** Attendee
**Given** mở `/` trên môi trường gần production
**When** đọc viewport đầu + banner
**Then** không lộ jargon triển khai (Nest BFF, fixture nội bộ) trên đường khách; nếu còn demo thì nhãn DEMO rõ và CTA chính vẫn “Đổi mã”; brand-test pass (Vemoki nhận diện được, không chỉ đổi màu).
**Evidence:** headless screenshot `vemoki.com` / staging + checklist PD.

### S-P1-B — Admin readiness & context (sau S-P0-E)

**Persona:** Event Manager
**Given** chưa chọn event hoặc config chưa publish
**When** vào các job phụ thuộc event
**Then** trạng thái readiness rõ (chưa chọn / draft / published) và hành động bị khóa có giải thích VI — không chỉ error box kỹ thuật.
**Evidence:** headless + copy review PD.

### S-P1-C — Validate-only & tra cứu thủ công

**Persona:** Scanner / Supervisor
**Given** quyền Gate phù hợp
**When** bật chế độ “Chỉ kiểm tra” hoặc nhập mã hiển thị khi camera lỗi
**Then** validate-only không tạo check-in; tra cứu thủ công chỉ hiện thông tin tối thiểu theo quyền; admit vẫn idempotent.
**Evidence:** unit/API + sim-uat.

---

## 10. Metrics mục tiêu (baseline **chưa đo**)

Mọi baseline hiện = **chưa có analytics production** (quan sát: không có dashboard metric product trong evidence D0–D10 đã đọc). Phương pháp đo đề xuất — chưa triển khai.

| Metric | Định nghĩa | Baseline | Target đề xuất | Cách đo |
| --- | --- | --- | --- | --- |
| Redeem completion rate | % session bắt đầu redeem → ISSUED | Chưa đo | ≥ 85% trên fixture load (không phải SLA KH) | Event `redeem_started` / `ticket_issued` (BE outbox + BFF) |
| Redeem error recovery | % 409/4xx được retry thành công trong 2 phút | Chưa đo | ≥ 70% FORM_VERSION_STALE recover | Log mã lỗi + client retry flag |
| Gate scan cycle time | p50 thời gian từ scan → kết quả hiển thị | Chưa đo | ≤ 1.5s online (lab) | Client instrumentation Gate |
| Offline queue clarity | % scanner trả lời đúng trạng thái queue trong 5 câu hỏi task | Chưa đo | ≥ 90% trong UAT quan sát (n=≥5 staff nội bộ) | Moderated task (khi user ủy quyền nghiên cứu) |
| Brand-test pass rate | % surface event pass brand-test PD | Chưa đo | 100% surface trong scope D11 | Checklist PD + screenshot |
| Invite accept success | % invite UI thành công / tạo | Chưa đo | ≥ 95% trên staging/prod sau fix | BFF logs |
| CS time-to-resend | Thời gian tìm vé → resend | Chưa đo | ≤ 60s median UAT | Stopwatch UAT headless scripted |
| Privacy uptime | `GET /privacy` = 200 | 404 (D10) | 200 ổn định | Uptime check đơn giản |

**Không** dùng số PRD §9 (20k vé, p95…) làm metric UX completion.

---

## 11. Production acceptance gates (đề xuất D11+ / pilot path)

Phân biệt theo ROADMAP §1.1: code complete ≠ acceptance ≠ **pilot ready**.

| Gate | Bắt buộc trước khi… | Evidence tối thiểu |
| --- | --- | --- |
| G-A | Gọi “acceptance D11 slice” | DoD exact-SHA + CI + headless UAT theo Story |
| G-B | Gọi gần “pilot ready” | Device UAT: camera Gate, push DELIVERED, deep link, offline ví + offline Gate multi-device tại điều kiện gần venue; local signed build |
| G-C | Production data user thật | O06 retention/region đã chốt; secrets/runbook; backup drill có chủ đích prod (không chỉ fixture) |
| G-D | App Store submit | Privacy URL live; ASC fields + screenshots uploaded; Distribution/TF path; **task ủy quyền submit** |
| G-E | Không bao giờ mặc định | EAS Cloud Build; claim pilot chỉ vì D0–D10 Hoàn thành board |

D10 đã chứng minh: **prep ≠ submit** ([`D10-S5-T1-ASC-CHECKLIST.md`](../reviews/D10-S5-T1-ASC-CHECKLIST.md)).

---

## 12. Quyết định còn mở và mặc định khuyến nghị

Nghiên cứu và thiết kế tiếp tục trong ủy quyền hiện có; không cần user trả lời bảng này để hoàn tất handoff. Chỉ phạm vi implementation cần review roadmap trước coding.

| Quyết định | Khuyến nghị BA để review | Khi nào cần chốt |
| --- | --- | --- |
| Phạm vi đợt triển khai UX/UI | Ưu tiên Admin IA + attendee journey/copy + Gate feedback + a11y; validate-only/manual lookup là optional sau kiểm tra capability hiện có | Review roadmap D11 trước feature coding |
| Home public và demo | Tách đường demo có nhãn khỏi trải nghiệm khách thực; giữ nhãn khi dữ liệu là fixture, bỏ jargon triển khai khỏi copy khách | PD handoff và review nội dung trước implement |
| Retention/region/SLA O06 | Không tự đặt số; quyết định sản phẩm/vận hành riêng | Trước dữ liệu người thật và policy production |
| Pilot/venue UAT và nghiên cứu người dùng | Chuẩn bị protocol kiểm chứng với staff/khách; thời điểm/người tham gia chưa được giao, không bịa kết quả | Trước khi chạy study/device venue hoặc claim pilot ready |

PD #225 đã chạy song song; các non-goals O10 giữ nguyên, không yêu cầu xác nhận lại. Store upload/submit và production deploy cần task ủy quyền riêng; không chặn discovery hiện tại.

---

## 13. Phạm vi đề xuất D11+ (để user review — chưa duyệt)

### IN (đề xuất)

- P0-1…P0-7 và stories S-P0-A…F (gồm **Admin IA** + **guest home copy** sau follow-up coordinator)
- P1 chọn lọc khi user review roadmap (mặc định khuyến nghị: P1-1, P1-2/S-P1-B, P1-5; P1-3 nếu chấp nhận mở rộng Gate)
- Handoff PD [#225](https://github.com/hangndat/ticket-solution/issues/225): IA admin theo job, progressive disclosure, tenant/event context, Gate/redeem states, brand đủ chất lượng (không skin-only)
- Planner [#226](https://github.com/hangndat/ticket-solution/issues/226) reconcile BA/PD khi PD artifact xuất hiện
- Cập nhật PRD/ROADMAP/O11 **do coordinator** (đã thông báo); workers không sửa các file đó
- Metrics instrumentation tối thiểu (P2-3) chỉ khi user muốn đo baseline

### OUT (cứng)

- Android / payment / refund / transfer / seat / Wallet
- Custom domain/sender (O07)
- Feature coding trong task nghiên cứu này
- Deploy prod / store submit
- Tuyên bố production/pilot ready từ tài liệu này

### Phụ thuộc

| Phụ thuộc | Ghi chú |
| --- | --- |
| `product-design` | Wireframe/IA + brand-test protocol — qua coordinator |
| Backend | Chỉ khi P1-3 hoặc message catalog cần contract |
| Web / iOS | Sau khi scope duyệt + PD handoff |
| Ops | Privacy host, ASC/TF — ủy quyền riêng |
| Epic planner | Tách Story/Task khi user duyệt IN |

### Thứ tự khuyến nghị (suy luận)

```text
User trả lời §12
  → PD #225 (brand rules + Gate/redeem states + admin IA progressive disclosure
     + guest home production-lite; không skin-only) ∥ Ops privacy/ASC (nếu chọn)
  → P0 fix (invite, Gate copy, brand chrome, admin IA P0-6, home copy P0-7)
  → P1 (redeem stale, admin readiness, ± Gate modes)
  → Device/venue UAT (nếu chọn pilot path) → mới xét “pilot ready”
```

---

## 14. Handoff cho Product Design (qua coordinator)

Handoff cho PD #225 (đã chạy song song), dựa trên nghiên cứu này:

1. **Brand rules:** bảng surface → brand nguồn (platform Vemoki vs tenant vs event M04); criteria brand-test.
2. **Gate state machine UI:** online admit / offline pending / applied / conflict / validate-only.
3. **Redeem states:** success / pending review / stale form / quota / closed — copy VI.
4. **Admin IA:** 4 nhóm job + progressive disclosure; tenant/event context thân thiện; readiness states; ẩn UUID/mã đợt khỏi chrome chính; dense-but-scannable — **không** chỉ đổi màu/bo góc. Tham chiếu source `admin-form.tsx` + screenshot lịch sử D8 (ghi rõ lịch sử).
5. **Attendee first viewport / home:** production-lite; gỡ jargon Nest BFF/fixture; brand-first (khớp design rules repo).
6. **Không** thiết kế payment/seat/Wallet/Android.

Artifact PD: [`docs/design/D11-PRODUCTION-UX-UI.md`](../design/D11-PRODUCTION-UX-UI.md); prototype: [`docs/design/d11-prototype/index.html`](../design/d11-prototype/index.html).

---

## 15. Kết luận điều hành

D0–D10 đã đóng chức năng MVP mở rộng trên board; khoảng cách tới “ổn cho production” chủ yếu là **UX residual có evidence** (invite, brand chrome, Gate offline clarity, redeem stale, **admin IA một trang**, **guest copy demo/kỹ thuật**), **ops store/privacy** (404 tươi 2026-10-18), và **quyết định O06** — không phải thiếu module lớn trong phạm vi O10. Benchmark ngành khẳng định hướng: offline Gate rõ ràng, role check-in tối thiểu, brand xuyên suốt touchpoint, tra cứu thủ công khi camera lỗi — **không** đòi mở payment/seat/Wallet. Tài liệu này gắn Task BA **#224** / Epic **#222**; là **đề xuất review** — phạm vi chi tiết chỉ có hiệu lực sau khi user trả lời §12; coding chưa được ủy quyền từ proposal này.

---

## Phụ lục A — Chỉ mục evidence đã dùng

| File | Dùng cho |
| --- | --- |
| `docs/PRD.md` §3§5§7§9 | Personas, journeys, NFR |
| `docs/DECISION-LOG.md` | O01–O10, O06 |
| `docs/plans/D6-UX-UI-PLAN.md` | Audit UX trước/sau D6 |
| `docs/reviews/D4-TENANT2-PROD-UAT.md` | Invite/CSRF, MinIO, FORM_VERSION_STALE |
| `docs/reviews/D5-PR-100-DOD.md` | CSRF fix; prod invite còn mở |
| `docs/reviews/D5-APNS-DEVICE-UAT-STATUS.md` | Push DELIVERED |
| `docs/reviews/D6-PR-92-DOD.md` | D6 web PASS + known gap |
| `docs/reviews/D7-S4-UAT.md` | Offline Gate sim evidence |
| `docs/reviews/D8-S4-T1-UAT-DOD.md` | White-label gap chrome |
| `docs/reviews/D10-S5-T1-ASC-CHECKLIST.md` | Store prep gaps G1–G8 |
| `docs/reviews/D7-D10-backlog-breakdown.md` | Cấu trúc Epic D7–D10 (lịch sử board) |

## Phụ lục B — URL benchmark (truy cập 2026-10-18)

- https://www.eventbrite.com/organizer/features/organizer-check-in-app/
- https://www.eventbrite.com/help/en-us/articles/741083/how-to-check-in-attendees-at-the-event-with-eventbrite-organizer/
- https://www.eventbrite.com/help/en-us/articles/509534/how-to-manage-roles-and-permissions/
- https://play.google.com/store/apps/details?hl=en_GB&id=ticketbox.eventmanager
- https://ticketbox.vn/
- https://www.accelevents.com/platform/white-label
- https://support.accelevents.com/en/articles/443011-check-in-attendees-through-the-admin-app
- https://support.accelevents.com/en/articles/6993576-activating-ipad-kiosk-mode
- https://business.feverup.com/
- https://feverpartners.zendesk.com/hc/en-us/articles/24421647446930-How-to-validate-a-ticket
- https://splashthat.com/platform/events
- https://splashthat.com/platform/design
- https://splashthat.com/platform/ticketing
