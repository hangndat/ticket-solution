# D11 — Thiết kế UX/UI production (mở rộng sau MVP D0–D10)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Tracking | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story [#223](https://github.com/hangndat/ticket-solution/issues/223) → **PD [#225](https://github.com/hangndat/ticket-solution/issues/225)** · BA [#224](https://github.com/hangndat/ticket-solution/issues/224) · Planner [#226](https://github.com/hangndat/ticket-solution/issues/226) |
| Ownership | Chỉ file này + `docs/design/d11-prototype/**` |
| Ngày | 2026-10-18 |
| Trạng thái | **Đề xuất design** — chờ user review roadmap; **không** pilot/production ready |

**Reconcile BA:** đã đọc [`docs/plans/D11-BA-RESEARCH.md`](../plans/D11-BA-RESEARCH.md) (P0-1…P0-7, P1-1…P1-5, handoff §14).
**Baseline:** [`docs/reviews/D11-DISCOVERY-BASELINE.md`](../reviews/D11-DISCOVERY-BASELINE.md) + [public screenshot](../reviews/d9-uat/web/d9-home.png) / `/tmp/d11-baseline-public.png`.

---

## 0. Mục tiêu & ranh giới

Đưa UX từ D6 polish + D7 Gate offline lên **đề xuất thiết kế production-quality** (IA, state, a11y, AC headless, handoff) — không coding `apps/**`, không deploy/store.

| IN | OUT |
| --- | --- |
| Flows + state matrix VI · a11y · UI AC · handoff · prototype 3 flow | Android / payment / refund / transfer / seat / Wallet |
| Map BA P0/P1 vào UI | Tự mở anonymous auth / nới check-in |
| Brand Vemoki đủ chiều sâu (không chỉ skin) | Claim pilot/production ready; Figma write; SaaS |

---

## Evidence (quan sát / suy luận / giả thuyết)

| Nguồn | Loại | Ghi chú |
| --- | --- | --- |
| `brand/vemoki/tokens.json`, `globals.css`, iOS theme | Quan sát | ink/paper/signal/focus |
| Redeem `messages.ts`: `UNAUTHENTICATED`, `EMAIL_NOT_VERIFIED` | Quan sát | Đổi mã hiện tại **yêu cầu đăng nhập / email verified** qua Keycloak path — **không** chứng minh anonymous redeem |
| PRD §2 Identity: OTP/magic link trước cấp vé | Quan sát tài liệu | Khác UX copy hiện tại (Keycloak) — **TBD product**: OTP guest vs staff IdP; PD **không** mở anonymous trong prototype |
| `admin-form.tsx` ~1930L; [D8 admin](../reviews/d8-uat/web/d8-admin.png) | Quan sát source + **screenshot lịch sử D8** | Không = pixel `main` authenticated hôm nay |
| Public `vemoki.com` 200 + privacy 404 (baseline D11) | Quan sát tươi | Home còn disclaimer Nest BFF / fixture |
| ADR-18: item `APPLIED` / `DUPLICATE` / `REJECTED` / `CONFLICT` | Quan sát | Client phase `queued` ≠ admission; không fake chống trùng đa thiết bị khi còn offline |
| BA P0-6/P0-7/P0-3 | Suy luận BA (đã reconcile) | IA admin + home copy + Gate queue copy |
| Scanner cần <1s feedback cảm nhận | Giả thuyết (chưa đo) | — |

**Graph:** `user-code-review-graph-ticket` stale vs HEAD — ưu tiên source.

---

## 1. User flows

### 1.1 Attendee — đổi mã → vé (web + iOS)

```text
[Event / Đổi mã]
  → (hiện tại source) phiên đăng nhập + email đã xác minh
      └─ chưa: CTA «Cần đăng nhập» / «Xác minh email» — không invent OTP UI mới trong D11
  → tải biểu mẫu sự kiện (published)
  → nhập mã + trả lời + đồng ý điều khoản
  → đang xử lý / đang kiểm tra lại
      ├─ đã cấp vé → thẻ vé + QR minh họa (nhãn demo nếu fixture)
      ├─ chờ duyệt → chưa phải vé
      ├─ lỗi trường → focus + sửa
      ├─ biểu mẫu/điều khoản đã đổi → tải lại + đồng ý lại (P1-1)
      ├─ từ chối (mã/hết suất/…) → copy VI plain
      └─ chưa rõ → «Kiểm tra lại» (không hiện vé giả)
```

**Auth pin (bắt buộc):**

| Khẳng định | Trạng thái |
| --- | --- |
| Anonymous đổi mã không login | **Không** thiết kế mở trong D11; PRD OTP ≠ đã chứng minh runtime |
| Current web redeem fail-closed khi thiếu auth | Quan sát `UNAUTHENTICATED` / `EMAIL_NOT_VERIFIED` |
| Ví iOS / danh sách vé | Cần phiên verified; offline = chỉ hiển thị cache |

**Copy guest (UI):** dùng «sự kiện», «biểu mẫu», «điều khoản», «cần đăng nhập», «đang xử lý», «vé của bạn».
**Handoff dev (không lên chrome khách):** schema/published/tenant UUID/Keycloak/idempotency/credentialVersion/SessionBoundary.

### 1.2 Event Manager — workbench theo việc (BA P0-6 / P1-2)

```text
[Đăng nhập staff] → chọn tổ chức · sự kiện (sticky context, tên > UUID)
  → Tab/job: Chuẩn bị | Khách & mã | Cổng | Hỗ trợ
  → Chuẩn bị: thông tin · loại vé · nguồn · hạn mức (nếu có) · brand · sẵn sàng xuất bản
  → Xuất bản chỉ nổi khi checklist đủ; timeout = «chưa biết» ≠ thành công
```

**Quota / hạn mức:** checklist chỉ báo «đã cấu hình hạn mức» **hoặc** «không giới hạn (NULL capacity)» — **không** biến «quota hữu hạn» thành invariant mới (coordinator + BA).

### 1.3 Scanner — scan / offline / sync (BA P0-3; P1-3 đề xuất)

```text
Online: quét → Cho vào | Không cho vào | Chưa rõ
Offline iOS: xếp hàng (pending) → sync → APPLIED | DUPLICATE | REJECTED | CONFLICT
  · pending/queued: không cho khách qua sớm
  · CONFLICT/DUPLICATE: không phải lượt vào mới / không fake green
  · không cam kết chống trùng giữa nhiều thiết bị khi vẫn offline (ADR-18: sau sync)
Web Gate: banner offline/degraded; không queue — hướng iOS
P1-3 (proposal only): chế độ «Chỉ kiểm tra» (validate-only) + tra cứu thủ công — không mock thành quyền production trong prototype chính
```

### 1.4 Touch map

| Việc | Web | iOS |
| --- | --- | --- |
| Đổi mã | Primary | Có |
| Ví + QR | Phụ | Primary |
| Scan + offline queue | Dự phòng (không queue) | Primary |
| Admin theo job | Primary | — |

---

## 2. Screen / state matrix (copy VI — guest/staff)

State bắt buộc: empty · loading · ready · error · retry · denied · expired · offline · conflict (+ Gate unknown/queued).

### 2.1 Đổi mã (Attendee)

| State | Title (UI) | Detail |
| --- | --- | --- |
| empty | Chưa tải biểu mẫu | Chọn sự kiện hoặc thử lại |
| loading | Đang tải… | Chưa xác nhận sẵn sàng |
| ready | Đổi mã lấy vé | Form + điều khoản |
| error | Không đổi được mã | Chi tiết ngắn + Thử lại nếu được |
| retry | Chưa rõ kết quả | Kiểm tra lại — chưa phải vé |
| denied | Không cấp vé | Mã/hết suất/… plain VI |
| expired | Yêu cầu hết hạn / biểu mẫu đổi | Tải lại hoặc thử sau |
| offline | Không có mạng | Thử lại khi có mạng |
| conflict | Xung đột thao tác | Gửi lại form (dev: idempotency) |
| auth | Cần đăng nhập | Đăng nhập rồi quay lại đổi mã |

### 2.2 Ví / vé

Giữ hướng `walletCopy`; UI: tên sự kiện + trạng thái vé; UUID/credentialVersion chỉ secondary/selectable. Offline: «Đang xem vé đã lưu — chưa kết nối».

### 2.3 Admin readiness

| Hạng mục | OK khi | Không OK |
| --- | --- | --- |
| Loại vé | ≥1 | thiếu |
| Nguồn mã | ≥1 | thiếu |
| Hạn mức | đã set số **hoặc** «không giới hạn» tường minh | không xác định |
| Biểu mẫu/điều khoản | nếu sự kiện yêu cầu | thiếu khi bắt buộc |
| Brand tối thiểu | logo/màu tối thiểu | thiếu |

States: empty (chưa chọn event) · loading · ready · error/retry (unclear) · denied · offline · conflict (version lệch).

### 2.4 Gate / hàng đợi (map ADR-18)

| UI state | Title | Quay khách? |
| --- | --- | --- |
| idle | Chờ mã quét | Không |
| loading | Đang kiểm tra | Không |
| admitted / APPLIED | Cho vào | Có |
| denied / REJECTED | Không cho vào | Không |
| unknown | Chưa rõ — không cho vào | Không |
| queued / pending | Đã xếp hàng — chờ đồng bộ | **Không** |
| DUPLICATE | Trùng thao tác đã ghi | Không (không thêm lượt) |
| CONFLICT | Xung đột đồng bộ | Không |
| offline web | Cổng web offline | Không — dùng app |

---

## 3. Accessibility (WCAG 2.2 AA + HIG)

Giữ checklist A1–A10 (contrast, focus `--focus`, 44px, label, live region assertive cho unknown/queued, reduced-motion, skip link, không chỉ màu, QR alt, dialog fail-closed).
Prototype **không** claim đã đạt chuẩn — chỉ thể hiện pattern; đo bằng axe/Playwright/VoiceOver khi coding.

---

## 4. UI AC (headless)

| ID | Then (quan sát được) | Map BA |
| --- | --- | --- |
| AC-A1 | Issued → thẻ vé/QR; không lộ Nest/BFF trên chrome | P0-7 / J2 |
| AC-A2 | Unknown → không vé giả + CTA kiểm tra lại | — |
| AC-A3 | Auth thiếu → «Cần đăng nhập» | pin auth |
| AC-A4 | Stale form → tải lại + đồng ý lại | P1-1 |
| AC-M1 | Thiếu nguồn → Publish tắt | P0-6 / P1-2 |
| AC-M2 | Unclear save → không tick xanh giả | — |
| AC-M3 | Job nav: Chuẩn bị/Khách/Cổng/Hỗ trợ | P0-6 |
| AC-G1 | Admit outcome lớn + text | P0-3 |
| AC-G2 | Queued ≠ admit tone | P0-3 / ADR-18 |
| AC-G3 | CONFLICT copy «không phải lượt vào» | P0-3 |
| AC-G4 | Web offline banner + disable confirm | D7-S3 |

UAT: `scripts/web-uat.sh` / `scripts/sim-uat.sh`. Prototype file:// chỉ review design.

---

## 5. Implementation handoff

| Slice | Ownership | Việc D11+ (sau user review) |
| --- | --- | --- |
| Web | `apps/web` | Home copy P0-7; admin job IA P0-6; Gate outcome; redeem plain copy; readiness strip |
| iOS | `apps/mobile` | Gate outcome + queue APPLIED/CONFLICT VI; ví hierarchy |
| Ops | ngoài PD | Privacy 404 P0-2; ASC — không trong ownership PD |
| BE | escalate | Chỉ nếu P1-3 validate-only cần capability flag |

**Tokens/components reuse:** Vemoki tokens; `SurfaceState` / `screen-state`; Gate announcements. Không Inter/purple.

**Thứ tự good-enough:** Gate copy (P0-3) → Admin IA (P0-6) → Home copy (P0-7) → Redeem stale (P1-1) → Readiness (P1-2) → ± validate-only (P1-3 proposal).

---

## 6. Chiều sâu thiết kế

### 6.1 IA

- **Guest nav đề xuất:** Đổi mã · (context sự kiện) · Đăng nhập / Tài khoản. Invite thành viên → Owner/admin (giả thuyết BA-aligned).
- **Admin jobs:** Chuẩn bị | Khách & mã | Cổng | Hỗ trợ — progressive disclosure; UUID trong «Chi tiết kỹ thuật».
- **iOS:** 3 tab; Staff ẩn/disabled nếu không có quyền (escalate nếu thiếu flag).

### 6.2 Hierarchy / density / forms

- Guest: brand-first một composition (baseline public đã gần — gỡ Nest BFF).
- Admin: sticky event summary + readiness; dense forms trong job.
- Gate: outcome ≥40% vùng nhìn sau scan; camera/canvas trên; queue dưới.

### 6.3 Brand / motion

Giữ O09; motion: hero / redeem success / Gate flash + `prefers-reduced-motion`. Không skin-only.

---

## 7. Audit → gap (tóm tắt)

| Bề mặt | Evidence | Gap design |
| --- | --- | --- |
| Home public | baseline 2026-10-18 | Disclaimer kỹ thuật; nav Invite trên guest |
| Admin | source + D8 lịch sử | Một trang dài; ID thô; thiếu job IA |
| Redeem | form + messages | Copy còn jargon; auth states cần plain VI |
| Gate iOS | staff + ADR-18 | Queue status VI + composition native |
| Privacy | curl 404 | Ops P0-2 — ghi nhận, không design page trong ownership trừ link |

---

## 8. Quyết định & tradeoffs

| # | Quyết định | Tradeoff |
| --- | --- | --- |
| D1 | Auth đổi mã = pin current contract (login/email verified); OTP PRD = TBD | Không mở anonymous |
| D2 | Readiness derive client; hạn mức cho phép «không giới hạn» | Không invent API |
| D3 | Web Gate không queue | Khớp ADR-18 UX hiện có |
| D4 | P1-3 validate-only chỉ proposal / panel review | Không mock production right |
| D5 | Prototype HTML = reviewable product shells | ≠ runtime a11y pass |
| D6 | Không tuyên bố pilot/production ready | Cần coding + gates BA §11 |

---

## 9. Prototype

| Flow | File |
| --- | --- |
| Hub | [d11-prototype/index.html](./d11-prototype/index.html) |
| Attendee | [d11-prototype/flows/attendee-redeem.html](./d11-prototype/flows/attendee-redeem.html) |
| Admin | [d11-prototype/flows/admin-readiness.html](./d11-prototype/flows/admin-readiness.html) |
| Staff | [d11-prototype/flows/staff-scan.html](./d11-prototype/flows/staff-scan.html) |
| Fixture | [d11-prototype/fixtures/demo.json](./d11-prototype/fixtures/demo.json) |

State switcher nằm trong **khu Review / PD** (không lẫn chrome khách). Vé demo gắn nhãn **KHÔNG dùng vào cổng**.

---

## 10. Reconcile BA (đã làm)

| BA | PD đáp ứng |
| --- | --- |
| P0-3 Gate queue copy | §1.3 · §2.4 · staff prototype |
| P0-6 Admin IA | §1.2 · §6.1 · admin prototype job nav |
| P0-7 Home copy | §7 · handoff; hub mô tả hướng (không claim đã sửa live) |
| P1-1 Stale redeem | matrix + AC-A4 |
| P1-2 Readiness | checklist + AC-M* |
| P1-3 validate-only | proposal only §1.3 / D4 |
| Handoff §14 BA | flows + Gate state machine + admin jobs |

---

## 11. DoD role PD

- [x] Flows + lỗi/auth pin
- [x] State matrix copy VI
- [x] a11y checklist
- [x] UI AC headless
- [x] Handoff ownership
- [x] Prototype 3 flow + fixture demo
- [x] Reconcile BA
- [x] Issue #225 ghi trong artifact

**Không:** commit/push; sửa apps; spawn worker; tuyên bố production ready.

---

## 12. Follow-up interaction QA (PD #225, dispatch sau FAIL)

**Bối cảnh:** Coordinator headless QA `/tmp/d11-prototype-qa/results.json` FAIL 4 check trên `flows/attendee-redeem.html` (setTimeout không cleanup).

| Check (tên QA) | Nguyên nhân (quan sát source cũ) | Sửa |
| --- | --- | --- |
| `empty-code-not-issued` | Submit luôn `setTimeout → issued` | `trim()` rỗng → lỗi VI + `focus` `#code`; không issued |
| `unchecked-terms-not-issued` | Không validate checkbox | Unchecked → lỗi VI + `focus` `#terms`; không issued |
| `submit-disabled-while-loading` | Nút không disable | `loading` → `disabled` + `aria-busy`; double-click bị chặn |
| `stale-timer-does-not-issue` | Timer không hủy khi đổi Review chip | `cancelPending()` clearTimeout + bump `submitNonce` trên mọi `setState` / validation |

**CSS:** `prefers-reduced-motion: reduce` → `scroll-behavior: auto` (`d11.css`).

**Evidence worker (2026-10-18):** Playwright headless qua `chrome-headless-shell` (file://), 4 check FAIL trước → **pass** sau sửa; thêm `stale-timer-denied-cancel` + happy-path issued vẫn OK. Chip Review độc lập (`#review-chips`); validation form không ép đổi chip sang state ảo.

**Còn lại:** Coordinator rerun frozen QA suite để nghiệm thu chính thức.
