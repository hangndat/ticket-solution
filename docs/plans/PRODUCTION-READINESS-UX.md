# Production readiness — UX/UI audit (research-only)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Ownership | **Chỉ** file này (`docs/plans/PRODUCTION-READINESS-UX.md`) |
| Ngày | 2026-10-18 |
| Architecture impact | **Không** — đánh giá UX/UI + handoff; không đổi contract |
| Ủy quyền | Nghiên cứu production readiness — **không** coding / commit / push / PR / merge / deploy / store / EAS Cloud |
| Ngôn ngữ | Tiếng Việt (giữ ID, SHA, URL, lệnh nguyên bản) |

---

## 0. Baseline bằng chứng (bắt buộc)

### 0.1 Git / working tree

| Mục | Giá trị | Loại |
| --- | --- | --- |
| Base HEAD (worktree hiện tại) | `e8512d0055e0e9d6585007e8363b6224a7138b12` | **Quan sát** (`git rev-parse HEAD`) |
| Tip commit message | `docs(d11): chốt phạm vi UX/UI đã duyệt và handoff triển khai (#227)` | Quan sát |
| Working tree | **Dirty** — nhiều file modified + untracked (rules, mobile, docs/plans, `docs/reviews/D11*`, ADR, …) | Quan sát |
| Evidence local untracked | ≥13 file `docs/reviews/D11*.md` **untracked** tại lúc audit | Quan sát |
| Graph `code-review-graph-ticket` | `head_matches_build=false` (built `3921f2e…`, head `e8512d0…`) | Quan sát — **source thắng** |

**Giới hạn (bắt buộc):**

- Không suy SHA/deploy production từ HEAD local.
- Evidence untracked / uncommitted **không** = đã merge `main` / acceptance complete.
- Không chạy app/simulator/DB của worker khác; không GUI; không claim PASS runtime khi chưa headless UAT trên SHA đích.

### 0.2 Project #3 (live, 2026-10-18)

Nguồn: `gh project item-list 3 --owner hangndat --limit 300 --format json` → **126** item.

| Status | Số | Ghi chú UX liên quan |
| --- | --- | --- |
| Hoàn thành | 114 | Gồm nhiều Task D11 surface (admin, Gate iOS, attendee, EventReport BE/web P2–P3, …) |
| Đang làm | 5 | `#222` Epic D11 · `#230` Gate story · `#232` Web Gate offline · `#236` UAT tích hợp · `#254` Epic server-source |
| Sẵn sàng | 3 | `#245` Dashboard O12 consumer · `#246` CS/email recovery UX · `#233` Story attendee |
| Chờ duyệt | 1 | `#255` BE public published list (ADR-19) |
| Bị chặn | 2 | `#256` Web home server-source · `#257` iOS events published-first |
| Chưa lên lịch | 1 | `#7` hủy Android/payment/seat/Wallet |

**Suy luận:** D0–D10 + nhiều slice D11 đã **acceptance-level trên board**, nhưng Epic D11 / UAT tích hợp / server-source / CS UX còn mở → **chưa pilot ready, chưa production ready**.

### 0.3 Phân loại bằng chứng

| Loại | Nghĩa trong báo cáo này |
| --- | --- |
| **Quan sát (source)** | Có trong tree tại HEAD hoặc file đã đọc |
| **Quan sát (evidence)** | Có artifact/PR/board với SHA hoặc Status |
| **Suy luận** | Kết luận hợp lý từ quan sát + PRD/TD/O* — chưa đo runtime |
| **Chưa xác minh** | Cần headless UAT / device / deploy — **không claim PASS** |
| **Khuyến nghị** | Hướng PD/handoff hoặc quyết định user — không tự mở coding |

### 0.4 Bốn mức hoàn thành (không gộp)

| Mức | Nghĩa (ROADMAP §1.1 + AGENTS) | UX tại checkpoint này |
| --- | --- | --- |
| **Code complete** | Impl merge `main` + CI path | Nhiều surface D11 đã merge (PR `#238/#240/#243/#248/#250/#260/…`) — **quan sát PR** |
| **Acceptance complete** | DoD Project: review exact-SHA ≠ implementer + evidence Issue | Board **Hoàn thành** cho nhiều Task; **không** = toàn Epic D11 / pilot |
| **Pilot ready** | Device UAT + restore + runbook + O06 chốt + số liệu | **Chưa** — O06 mở; privacy 404; `#236` còn Đang làm; camera/venue chưa gộp |
| **Production ready** | Pilot + ops/privacy/retention + trust dữ liệu thật + scale đã đo | **Chưa** — fixture vẫn SoT public; ADR-19 chưa xong; không deploy/store trong audit |

---

## 1. Phạm vi audit & non-goals

### IN

- Hành trình web/iOS: attendee (home → redeem/claim → vé/QR), Gate (scan/offline/conflict), admin (job/readiness/report), account/invite (nhẹ).
- States: loading / empty / error / offline / conflict / denied / unknown / demo-vs-real.
- Navigation, a11y mục tiêu, responsive, copy VI, email/recovery, day-of thao tác.
- Ma trận journey → gap → wireflow/handoff tối thiểu → UI AC → headless UAT.
- Tham chiếu guideline chính thức (URL + ngày).

### OUT

- Feature code `apps/**`; prototype ảnh mới; sửa design system toàn app.
- Đổi invariant tenant/auth/quota/check-in; hồi sinh Android/payment/seat/Wallet.
- Deploy, cloud resource, store submit, EAS Cloud Build.
- Spawn worker con; claim PASS cho mục chưa verify.

**Handoff PD sẵn có (không thay file này):** [`docs/design/D11-PRODUCTION-UX-UI.md`](../design/D11-PRODUCTION-UX-UI.md) + `docs/design/d11-prototype/**` — design complete ≠ runtime pass.

---

## 2. Guideline chính thức (tham chiếu)

| Chuẩn | URL | Ngày đối chiếu | Ghi chú áp dụng |
| --- | --- | --- | --- |
| WCAG 2.2 Level AA | https://www.w3.org/TR/WCAG22/ | 2026-10-18 | Mục tiêu web trong scope PD (contrast, keyboard, name/role/value, status messages) |
| WAI «Understanding WCAG 2.2» | https://www.w3.org/WAI/WCAG22/Understanding/ | 2026-10-18 | Giải thích SC — không thay test tự động |
| Apple HIG — Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility | 2026-10-18 | Label, Dynamic Type, Reduce Motion, hit target iOS |
| Apple HIG — Feedback | https://developer.apple.com/design/human-interface-guidelines/feedback | 2026-10-18 | Gate outcome / sync feedback rõ ràng |
| MDN `prefers-reduced-motion` | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | 2026-10-18 | Motion web |

**Chưa xác minh:** axe/Playwright a11y full suite + VoiceOver trên tip `main` tích hợp D11 — không claim AA đạt.

---

## 3. Inventory bề mặt (source @ HEAD)

### 3.1 Web (`apps/web`)

| Route / surface | File chính | State pattern (source) |
| --- | --- | --- |
| Home `/` | `app/page.tsx` | `SurfaceState` empty; **fixture demo** + disclaimer «Nest BFF» |
| Redeem / claim | `app/redeem/*`, `app/claim/*` | messages VI + auth fail-closed codes |
| Event public | `app/t/[tenantSlug]/events/[eventSlug]/page.tsx` | Demo event routes |
| Admin | `app/admin/admin-form.tsx` (+ panels) | `SurfaceState` empty tenants/events; readiness + EventReport consumer (source) |
| Gate | `app/gate/*` | `GateOfflineShell` + banner; **không** queue offline (hướng iOS) |
| Account / invite / auth / platform | `app/account`, `invite`, `auth`, `platform` | SurfaceState / session chrome |
| Global | `loading.tsx`, `error.tsx`, `not-found.tsx` | loading/error shell |
| Privacy | — | **Không** có `app/privacy` — khớp baseline public 404 |

`SurfaceState` kinds: `empty | loading | error | unknown` (`apps/web/src/ui/surface-state.tsx`) — role `alert`/`status`, `aria-busy` khi loading.

### 3.2 iOS (`apps/mobile`)

| Screen | File | Copy/state |
| --- | --- | --- |
| Events | `screens/events.tsx` | Published-first intent + **demo catalog** khi `showDemo`; fail-closed không fallback fixture khi API lỗi (comment + copy) |
| Redeem / claim / ví / ticket | `redeem`, `claim`, `my-tickets`, `ticket-detail` | `walletCopy` / presenters |
| Staff Gate | `screens/staff.tsx` | Offline queue phases; queued ≠ admit; CONFLICT/DUPLICATE handling |
| Shared | `components/screen-state*.ts(x)` | `walletCopy`, `scanCopy`, `eventsCopy` VI |

**Dirty local:** `apps/mobile/src/screens/events.tsx` (+ identity config) **modified uncommitted** — audit dưới mô tả intent từ file đang mở; **không** gán đã merge.

---

## 4. Hành trình × gap (tóm tắt quan sát)

### 4.1 Attendee — nhận vé / QR (web ∥ iOS)

| Bước | Quan sát source | Gap UX | Runtime |
| --- | --- | --- | --- |
| Khám phá sự kiện | Web home + iOS events vẫn neo **demo fixture**; Epic `#254` / ADR-19 chưa xong (#255 Chờ duyệt; #256/#257 Bị chặn) | Trust dữ liệu / demo-vs-real / O13 host sales | **Chưa xác minh** end-to-end published |
| Đổi mã | Auth pin login + email verified (`UNAUTHENTICATED`, `EMAIL_NOT_VERIFIED`); PRD OTP/magic link ≠ UI hiện tại | Product: guest OTP vs Keycloak (O11 không mở anonymous) | UAT headless từng PR — **không** suy PASS tích hợp `#236` |
| Vé / QR | Ví iOS cache offline display; không offline redeem | Hierarchy UUID secondary; nhãn demo nếu fixture | Device QR scan venue **chưa xác minh** |
| Recovery lỗi | Messages VI + poll/retry patterns | CS timeline DELIVERED≠ACCEPTED còn `#246` Sẵn sàng | **Chưa xác minh** email prod |

### 4.2 Gate — day-of scan

| Bước | Quan sát source | Gap UX | Runtime |
| --- | --- | --- | --- |
| Online admit/deny | iOS staff + web gate form | Outcome lớn + text; không chỉ màu | Headless/sim có artifact lịch sử; **venue camera** chưa |
| Offline queue | iOS `offlineScanQueue`; phase queued → sync APPLIED/DUPLICATE/REJECTED/CONFLICT | Copy VI đã có hướng; composition native depth | Conflict đa thiết bị sau sync — **chưa xác minh** pilot |
| Web offline | Banner + disable confirm; copy hướng iOS | `#232` vẫn **Đang làm** trên board | **Chưa xác minh** AC-G4 trên tip tích hợp |
| Reject audit | BE `#244` merged (PR `#251`) | Dashboard reject reasons phụ thuộc consumer `#245` | UI Supervisor day-of **chưa** đóng |

### 4.3 Admin / Manager — workspace + report

| Bước | Quan sát source | Gap UX | Runtime |
| --- | --- | --- | --- |
| Job IA / readiness | `admin-form` large; readiness helpers | Sticky context, publish checklist | DoD artifacts local untracked có **FAIL lịch sử** trên tip cũ — **không** tái dùng verdict; cần revalidate SHA hiện tại |
| EventReport O12 | Source gọi `interpretEventReport`; PR P2/P3 merged | Board vẫn `#245` Sẵn sàng — có thể **lệch Status** vs code | Watermark `asOf` + refresh thủ công — **chưa xác minh** UAT tích hợp |
| CS / email | Notifications panel tồn tại | `#246` Sẵn sàng — timeline DELIVERED≠ACCEPTED | **Chưa** |

### 4.4 Cross-cutting

| Chủ đề | Quan sát | Gap |
| --- | --- | --- |
| Demo vs real | Home web «Nest BFF» + fixture; iOS demo labeled; O13: mọi demo = giả lập | Gỡ jargon guest; server-source; nhãn fixture bắt buộc đến khi published SoT |
| Privacy / legal | `vemoki.com/privacy` **404** (baseline D11 18/10); không route app | P0 ops + content — ngoài coding PD trừ link/copy |
| A11y | Pattern SurfaceState + skip/focus tokens D6; PD checklist A1–A10 | Residual a11y Task chưa đóng trên board; không claim WCAG AA |
| Responsive | Admin mobile screenshot từng có trong UAT artifacts | **Chưa xác minh** trên tip tích hợp |
| Navigation | Guest Invite lẫn chrome (PD audit trước); staff mode theo permission O02 | Kiểm lại sau attendee PRs |
| Offline / conflict | Gate covered; redeem conflict messages | Ví offline empty vs error clarity OK source; sync conflict UI depth |
| Email recovery | O14 mở CS UX | Chưa code trên board Sẵn sàng |
| Day-of ops | BA day-of research; validate-only **OUT** (O11/O14) | Không mở resolution desk trong audit này |

---

## 5. Ma trận journey → handoff tối thiểu → UI AC → UAT

| Journey / màn | Gap chính | Wireflow / handoff tối thiểu (đã có / cần) | UI AC (quan sát được) | Headless UAT |
| --- | --- | --- | --- | --- |
| **J1 Home / catalog** | Fixture SoT; jargon Nest BFF; `#256` blocked | PD D11 §6.1 + ADR-19 PD `docs/design/event-server-source/` | Given published API OK When mở home Then danh sách từ server, không fixture fallback; empty/error VI | `web-uat.sh` screenshot `/` + empty intercept; **sau** merge `#255/#256` |
| **J2 Redeem web** | Auth pin ≠ PRD OTP; stale form | D11 §1.1 · AC-A1…A4 | Issued → thẻ vé; unknown → không vé giả; auth → «Cần đăng nhập» | Playwright redeem routes; unit `redeem-messages` |
| **J3 Ví / QR iOS** | Brand-test evidence; local Xcode AC | D11 §2.2 · S-P0-C | Offline cache label; không redeem offline | `sim-uat.sh` wallet/redeem; **+** local `xcodebuild` Team `BLUA62D52G` |
| **J4 Gate iOS** | Venue device; multi-device conflict | D11 §2.4 · AC-G1…G3 · ADR-18 | Queued ≠ admit tone; CONFLICT «không phải lượt vào» | sim-uat staff; device camera **chưa xác minh** |
| **J5 Gate web** | `#232` Đang làm | AC-G4 | Offline banner + disable confirm; hướng iOS | `web-uat` `/gate` offline simulate |
| **J6 Admin jobs** | A11y/responsive residual; DoD revalidate | D11 §1.2 · AC-M1…M3 | Publish tắt khi thiếu nguồn; job nav 4 tab | `d11-admin-*-uat` (không claim pass nếu intercept-only) |
| **J7 Dashboard O12** | Board `#245` vs code merged P2/P3 | O12 dictionary · watermark | `asOf` hiện; emailNeedsCs deep-link; không resend từ KPI | Headless admin report panel |
| **J8 CS email** | `#246` chưa làm | O14 item 3 | Timeline DELIVERED≠ACCEPTED copy VI | UAT sau impl |
| **J9 Privacy** | 404 public | Ops + content | `/privacy` 200 + VI | curl + screenshot — **cần ủy quyền deploy** |
| **J10 Sales O13** | Host `vemoki.com` vs `app.` | PD `docs/design/o13-platform-sales/` | Demo nhãn giả lập; CTA quan tâm | Headless marketing — **chưa** trong Epic D11 UAT |

---

## 6. Top gap ưu tiên (12 mục — tác động cao, trong MVP)

> Coordinator: tập trung 10–15 gap; AC cụ thể; runtime chưa chạy = **chưa xác minh**. O06 = **gói lựa chọn** cho user, **không** mặc định chặn mọi việc UX độc lập (copy/demo-label/Gate/CS vẫn làm được song song).

| ID | Gap | Evidence (path / SHA / board) | Rủi ro | Pri | UI AC cụ thể (Given/When/Then) | Check headless | Owner | Dep thật | User chốt? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-01 | Catalog public vẫn fixture SoT | `apps/web/app/page.tsx` demo routes; iOS `demo-events.ts` + `events.tsx`; `#254`; `#255` Chờ duyệt; `#256/#257` Bị chặn; ADR-19 | Khách tin demo = sự kiện thật | **P0** | GIVEN API published lỗi/empty WHEN mở home/events THEN không fallback fixture; empty/error VI; demo chỉ khi flag/dev nhãn «Demo» | `web-uat` `/` + intercept 5xx/[]; sim events | BE→web∥iOS | `#255` merge+CI trước `#256/#257` | Không (O15 đã chốt) |
| UX-02 | Home còn jargon «Nest BFF» | Source `page.tsx` (~L72–73) @ HEAD `e8512d0…` | Brand-test fail; O13 confusion | **P0** | GIVEN guest WHEN first viewport THEN không Nest/BFF/UUID raw; demo disclaimer plain VI | Screenshot headless `/` assert text absence | `web` | Soft; có thể ∥ `#256` | Không |
| UX-03 | Privacy 404 / không route | Baseline D11 curl 404 18/10; không `app/privacy` | ASC / legal | **P0** | GIVEN GET `/privacy` WHEN deploy đã ủy quyền THEN 200 + VI policy tối thiểu | `curl` + `web-uat` screenshot | Ops + web | Nội dung + **ủy quyền deploy** | **Có** — nội dung + khi deploy |
| UX-04 | UAT tích hợp D11 chưa đóng | Board `#236` Đang làm; `#232` Đang làm | Claim production UX sớm | **P0** | GIVEN tip tích hợp Stories IN WHEN chạy milestone THEN artifacts web+sim + reviews exact SHA; không PASS thiếu Gate web nếu AC-G4 còn gap | `scripts/web-uat.sh` + `sim-uat.sh` trên SHA | Coord + web/ios | Surfaces merge; `#232` nếu còn gap | Không |
| UX-05 | Web Gate offline story mở | `#232` Đang làm; source `gate-offline-shell` / banner đã có | Staff web check-in giả khi mất mạng | **P1** | GIVEN browser offline WHEN `/gate` THEN banner VI + confirm disabled + hướng iOS; không success giả | Playwright offline `/gate` | `web` | Chỉ nếu tip còn gap vs AC-G4 | Không |
| UX-06 | CS / email recovery UX | `#246` Sẵn sàng; O14 | Khách mất email/vé không rõ trạng thái | **P1** | GIVEN email DEAD/failed cuối WHEN mở CS THEN timeline VI; copy DELIVERED≠ACCEPTED; không resend từ KPI card | Headless admin CS panel | `web` | Slot web rảnh | Không (O14 đã duyệt) |
| UX-07 | Dashboard O12 UAT / board lệch | Source `interpretEventReport` trong `admin-form`; PR `#250/#260` merged; board `#245` vẫn Sẵn sàng | Manager thiếu “việc cần làm” hoặc trùng Task | **P1** | GIVEN EventReport WHEN mở dashboard event THEN hiện `asOf` + deep-link việc; refresh thủ công; không auto-resend | Headless admin report | `web` + board sync | BE report đã có | **Có nhẹ** — `#245` còn scope hay chỉ Status? |
| UX-08 | Gate iOS conflict/queue depth | Source `staff.tsx` queued≠admit; PR `#240` merged; venue **chưa xác minh** | Nhầm queued = cho vào; conflict đa TB | **P1** | GIVEN phase queued/CONFLICT WHEN hiện outcome THEN tone ≠ admit; text «không phải lượt vào» | sim-uat staff; device camera = chưa xác minh | `ios` | Soft ADR-18 | Không |
| UX-09 | Attendee vé/QR evidence brand + Xcode | PR `#243/#248` merged; reviews local **untracked** có FAIL tip cũ — không kế thừa | Pilot/store thiếu build evidence | **P1** | GIVEN tip `main` WHEN brand ≥2 tenant + local xcodebuild Team `BLUA62D52G` THEN BUILD SUCCEEDED + sim artifacts | sim-uat + xcodebuild log | `ios` (+ web brand) | Revalidate SHA mới | Không |
| UX-10 | A11y residual surface D11 | PD A1–A10; WCAG 2.2; không axe suite trên tip tích hợp | Keyboard/SR fail ngày event | **P1** | GIVEN redeem/admin/gate WHEN tab + axe THEN focus visible; live region unknown/queued; hit ≥44px | Playwright axe + manual VO sample | web ∥ ios | Sau merge surfaces | Không |
| UX-11 | Auth đổi mã Keycloak vs PRD OTP | `redeem/messages.ts` UNAUTHENTICATED / EMAIL_NOT_VERIFIED; PRD §2; PD pin D1 | Kỳ vọng guest lệch | **P1** product | **Option A** giữ pin hiện tại (AC: «Cần đăng nhập»). **Option B** mở Task OTP — cần IdP/contract | Unit messages + UAT auth | Product (± BE) | Contract nếu B | **Có** |
| UX-12 | O06 retention/region/SLA — gói lựa chọn | DECISION-LOG O06; O14 tạm không ingest PII | PII thật không có policy | **P0 policy** | Xem **§6.1** — **không** chặn UX-01…10 độc lập (demo-label, Gate, CS copy) | N/A research | Product/ops | Trước ingest PII / privacy số | **Có** — chọn option |

### 6.1 O06 — gói lựa chọn (không blocker UX độc lập)

| Option | Nội dung gợi ý | Hệ quả UX / release |
| --- | --- | --- |
| **A — Pilot demo-only** | Giữ O06 mở; chỉ fixture/demo; không PII thật | UX P0 catalog/privacy vẫn làm; **không** tuyên bố production data |
| **B — Chốt số tối thiểu** | User chọn retention (vd. 90/180/365 ngày), region (1 vùng), SLA support (vd. best-effort / 1 ngày làm việc) ghi DECISION-LOG | Mở đường privacy page + ingest; copy policy khớp số |
| **C — Hoãn production data** | Giống A + cấm explicitly store submit / prod PII đến khi B | Rõ ràng trên board/release checklist |

**Khuyến nghị PD:** chọn **A hoặc C** ngay để khỏi chặn wave UX; chuyển **B** trước khi privacy deploy mang số liệu thật.

### 6.2 P2 / OUT (không mở trong đợt readiness này)

| ID | Mục | Lý do |
| --- | --- | --- |
| UX-P2-a | Validate-only / resolution desk | O11/O14 OUT |
| UX-P2-b | Multi-event Owner overview | O12 OUT |
| UX-P2-c | O13 host marketing (theo dõi PR `#247`) | GTM riêng; demo nhãn giả lập |
| UX-P2-d | Invite Owner revalidate | O14 sau attendee — không P0 UX trust |

---

## 7. States bắt buộc — coverage (PD checklist)

| State | Web (source) | iOS (source) | Gap còn lại |
| --- | --- | --- | --- |
| empty | SurfaceState + home/admin | eventsCopy / walletCopy | Published empty vs demo empty — sau ADR-19 |
| loading | `loading.tsx`, SurfaceState, redeem poll | scan/wallet/events loading | Gate outcome loading size **chưa xác minh** pixel |
| ready | Forms + lists | Screens | — |
| error / retry | role=alert; redeem messages | error titles | CS recovery `#246` |
| denied / expired | Redeem deny codes; Gate deny | presentRedeemDecision | — |
| offline | Gate banner web; | Queue + ví cache | `#232`; multi-device |
| conflict | IDEMPOTENCY / RETRYABLE messages; Gate CONFLICT | staff CONFLICT phase | Copy Supervisor desk **OUT** |
| unknown / queued | SurfaceState unknown; Gate queued≠admit | staff maps queued→unknown tone | Live region assertive — **chưa xác minh** VoiceOver |
| demo-vs-real | Explicit demo labels + jargon còn | Demo catalog gated | Server-source + gỡ Nest BFF |

---

## 8. Accessibility — checklist tối thiểu (chưa claim PASS)

| # | Hạng mục | Mục tiêu | Cách kiểm | Trạng thái |
| - | -------- | -------- | --------- | ---------- |
| A1 | Contrast ink/paper/signal | WCAG 2.2 AA | Automated + manual | Pattern D6 — **chưa xác minh** tip tích hợp |
| A2 | Focus visible `--focus` | Keyboard | Tab order UAT | **Chưa xác minh** |
| A3 | Hit target ≥44px | HIG | Manual/sim | **Chưa xác minh** |
| A4 | Name/label controls | WCAG Name Role Value | axe + VoiceOver | Partial source (`accessibilityLabel` Gate) |
| A5 | Status messages | `aria-live` / assertive unknown | Screen reader | SurfaceState polite loading — Gate assertive **chưa xác minh** |
| A6 | Reduced motion | prefers-reduced-motion | CSS/media | Prototype có; apps **chưa xác minh** đủ |
| A7 | Skip link / main landmark | Web | DOM | Có pattern D6 — recheck |
| A8 | Không chỉ màu cho Gate | Text + tone | Visual | Source copy VI — pixel **chưa xác minh** |
| A9 | QR alt / accessible name | Image | Manual | **Chưa xác minh** |
| A10 | Dialog/auth fail-closed | No silent grant | UAT | Source pin — runtime **chưa xác minh** tích hợp |

---

## 9. Khuyến nghị thứ tự (PD) — không tự dispatch

```text
Wave UX độc lập (không chờ O06 số):
  UX-01/#254 server-source  ∥  UX-02 gỡ Nest BFF  ∥  UX-05/#232 Gate web (nếu gap)
  UX-06/#246 CS  ∥  UX-10 a11y residual  ∥  UX-07 reconcile #245

Song song user:
  UX-03 privacy nội dung  ·  UX-12 O06 chọn A/B/C  ·  UX-11 OTP vs Keycloak

Cổng nghiệm thu:
  UX-04/#236 + UX-09 build/brand evidence trên SHA tích hợp
```

**Handoff coding tối thiểu:** §5 journey + §6 AC Given/When/Then + “không đổi contract”; fixture nhãn Demo đến khi ADR-19 consumer merge.

---

## 10. Quyết định user cần chốt (tóm tắt)

| # | Câu hỏi | Gợi ý PD | Nếu không chốt |
| - | ------- | -------- | -------------- |
| Q1 | Publish `/privacy` + nội dung VI khi nào? | Trước store / PII thật | ASC + trust kém |
| Q2 | O06 chọn A / B / C (§6.1)? | A hoặc C ngay; B trước PII số | Không chặn UX-01…10; chỉ chặn ingest PII |
| Q3 | Keycloak pin vs OTP guest (UX-11)? | Giữ A đến task IdP riêng | Kỳ vọng PRD lệch |
| Q4 | `#245` còn coding hay chỉ Status lệch? | Reconcile board | Trùng / sót UAT |
| Q5 | Mở validate-only desk? | Giữ OUT | Scope creep |
| Q6 | Production UX ready cần UX-01+03+04 (+ O06 B nếu PII)? | **Có** | Tránh tuyên bố sớm |

---

## 11. Kết luận PD

1. **Quan sát:** Nhiều journey D11 đã code/acceptance trên board; còn mở: `#254` server-source, `#232` Gate web, `#236` UAT, `#246` CS, privacy 404, O06 chưa số.
2. **Suy luận:** **Chưa pilot / production ready** về UX — P0 trust = fixture→server + privacy + UAT tích hợp; CS/Gate/a11y = P1 độc lập.
3. **Khuyến nghị:** Làm 12 gap §6; user chốt Q1–Q4/Q6; O06 dùng gói A/B/C — **không** dừng toàn bộ UX chờ O06.
4. **Giới hạn:** Không chạy app; graph stale; reviews D11 untracked ≠ PASS merged; runtime = **chưa xác minh**.

---

## 12. DoD role (task này)

- [x] Flows / journeys theo persona
- [x] State coverage loading/empty/error/offline/conflict/demo
- [x] A11y mục tiêu + guideline URL/ngày
- [x] UI AC map headless UAT
- [x] Handoff tối thiểu + owner/deps/P0–P2
- [x] Phân biệt source vs runtime chưa chứng minh
- [x] Phân biệt code / acceptance / pilot / production
- [x] Chỉ sửa file ownership được giao

**Không:** coding apps; prototype ảnh mới; spawn worker; claim PASS; merge/deploy/store.
`)