# Gap audit DoD — decision gates O02 / PD §6.1 (2026-10-18)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_e05c2302-5fa9-4a56-8e0c-1aed7d26cb95` · task `task_ada6d733fc52` · dispatch `ctx_7f9cc244588d` · run `run_2756e66635b2` |
| Independence | Meta audit process — **không** review một PR implementer cụ thể; ≠ session implementer các surface D11 |
| Architecture impact | **Không** |
| Scope | `docs/reviews/*` + AC Task mẫu D11 (Gate/attendee/admin) + quan sát tip workspace |
| Commit SHA (exact tip) | **`a8e70ca134ba305b3b52fff0e8a81a2e0871ca20`** (`git rev-parse HEAD`) |
| Branch | `hangndat/d13-pr354-dod-artifact` |
| Checks | `rg`/`ctx_search` trên `docs/reviews` · đọc `DECISION-LOG` O02 · `D11-PRODUCTION-UX-UI` §6.1 · `PRODUCTION-READINESS-UX` Navigation · DoD Gate/attendee · source `apps/mobile/src/app/(tabs)/_layout.tsx` |
| Ngày | 2026-10-18 |
| OUT | Không merge; không tự Hoàn thành Issue |

## Tóm tắt điều hành

DoD artifacts D11 (và phần lớn PASS khác) **không** dùng O02 / PD IA §6.1 làm gate bắt buộc khi chấm PASS — đặc biệt staff tab «ẩn theo permission». PRODUCTION-READINESS UX vẫn ghi «Kiểm lại sau attendee PRs» và **chưa có** artifact revalidate. Trên tip `a8e70ca…`, tab **Nhân viên** luôn render trong `NativeTabs` — gap sản phẩm còn quan sát được.

---

## Checklist Task (5 mục)

| # | Câu hỏi | Kết quả audit | Chi tiết |
| --- | --- | --- | --- |
| 1 | O02 có xuất hiện trong bất kỳ DoD artifact nào như **gate bắt buộc** không? | **FAIL (process)** | `rg O02 docs/reviews/` → **0 hit**. O02 chỉ sống trong `docs/DECISION-LOG.md` / PRD / PRODUCTION-READINESS-UX — không có row checklist DoD nào yêu cầu «navigation theo permission / không cấp quyền mới chỉ vì đổi tab». |
| 2 | D11-B4 / attendee / Gate reviews: có **verify tab ẩn** không? | **FAIL (process + product residual)** | `D11-IOS-GATE-DOD.md` (PASS with known gap @ `f67b9a8…`) checklist AC 1–11: composition/copy/queue/ADR-18 — **không** row «Staff ẩn/disabled khi không quyền». `D11-IOS-ATTENDEE-DOD.md` / PR #243 attendee: copy/brand/UAT — **không** verify chrome staff vs guest. Spec `D11-B4-ios-staff-scan.md` AC cũng **không** ghi tab ẩn. PD §6.1 yêu cầu rõ: «iOS: 3 tab; Staff ẩn/disabled nếu không có quyền». |
| 3 | PRODUCTION-READINESS «Kiểm lại sau attendee» đã được revalidate chưa? | **FAIL (chưa revalidate)** | `docs/plans/PRODUCTION-READINESS-UX.md` §4.4 Navigation vẫn: «staff mode theo permission O02 \| **Kiểm lại sau attendee PRs**». Không có `docs/reviews/*` nào cite dòng này + PASS revalidation sau merge #234/#235/#243/#248. |
| 4 | Milestone gates (UAT headless, iOS local build) residual | **PASS with known gap (index cũ)** | `D11-MILESTONE-EVIDENCE.md` @ tip lịch sử `6f7995e…` (ancestor của HEAD): (a) headless PASS with known gap (iOS Staff session Save Password); (b) local iOS build PASS; (c) deploy n/a; (d) index PASS nhưng **Dashboard #245 thiếu DoD slug riêng**; CS authenticated UAT vẫn gap. Tip hiện tại `a8e70ca…` đã đi xa hơn milestone index — **không** kế thừa PASS milestone cho chrome O02 (chưa từng đo). |
| 5 | Đề xuất checklist DoD bổ sung chrome/permission | **Có — xem § Khuyến nghị** | |

---

## Bảng finding

| ID | Loại | Severity | Finding | Evidence | Verdict đề xuất |
| --- | --- | --- | --- | --- | --- |
| G1 | Process DoD | **Blocker process** (cho claim «IA/O02 done») | O02 không bao giờ là gate DoD bắt buộc | 0× `O02` trong `docs/reviews/`; ~92 artifact có PASS; ~17 mention DECISION-LOG/O* nhưng **không** O02/nav permission | **FAIL** nếu Task tuyên bố khớp O02/PD §6.1; **PASS with known gap** nếu chỉ AC surface scan/redeem |
| G2 | Process DoD | **Should-fix process** | PASS Gate/attendee bỏ sót PD §6.1 «Staff ẩn/disabled» | `D11-PRODUCTION-UX-UI.md` L208 vs `D11-IOS-GATE-DOD.md` checklist; `D11-IOS-ATTENDEE-DOD.md` không đề cập tab staff | **PASS with known gap** lịch sử vẫn đứng cho AC đã liệt kê; **không** chứng minh IA chrome |
| G3 | Process readiness | **Should-fix** | «Kiểm lại sau attendee» chưa đóng | `PRODUCTION-READINESS-UX.md:169` vẫn mở; không review reval | **FAIL** đóng mục Navigation readiness |
| G4 | Sản phẩm tip | **Should-fix product** | Tab Nhân viên luôn hiện — không conditional theo permission | Tip `apps/mobile/src/app/(tabs)/_layout.tsx`: ba `NativeTabs.Trigger` cố định gồm `staff` / «Nhân viên»; không đọc membership/assignment | Gap sản phẩm còn mở trên `a8e70ca…` |
| G5 | Process template | Nit → Should-fix | AC Task mẫu D11-B4 không neo O02/PD §6.1 | `docs/tasks/d11/D11-B4-ios-staff-scan.md` AC chỉ states/copy/sim-uat | Template Task chrome/permission cần bổ sung |
| G6 | Milestone residual | Known gap (đã ghi) | #245 thiếu DoD artifact riêng; CS auth UAT gap; device/pilot out | `D11-MILESTONE-EVIDENCE.md` Pending table | Không nuốt; không liên quan O02 nhưng residual Epic |

### Phân loại verdict meta-audit

| Verdict | Áp dụng |
| --- | --- |
| **FAIL (process gap)** | Claim «DoD đã đối chiếu decision log O02 / PD IA §6.1» — **không đúng** với corpus reviews hiện có. |
| **PASS with known gap** | Các PASS Gate/attendee **hợp lệ trong phạm vi AC đã viết** (scan queue, copy VI, brand, UAT path) — gap có chủ đích nếu coordinator chấp nhận chưa làm chrome permission; **không** được dùng làm bằng chứng O02 đã ship. |
| Sản phẩm tip | Tab staff luôn visible = **observational FAIL** so với PD §6.1 + O02 intent; cần Task coding + DoD revalidation riêng. |

---

## Mẫu AC Task — chỗ PASS dù thiếu đối chiếu decision/PD

| Artifact | Verdict cũ | AC đã verify | Thiếu đối chiếu |
| --- | --- | --- | --- |
| `D11-IOS-GATE-DOD.md` | PASS with known gap | Composition Gate, copy ADR-18, unit/CI, sim PNG | O02; PD §6.1 tab ẩn; DECISION-LOG row |
| `D11-IOS-ATTENDEE-DOD.md` | PASS with known gap | Copy VI, brand ≥2, sim-uat, CI | Chrome staff vs guest; O02; nav permission |
| `D11-PR-243-WEB-ATTENDEE-DOD-REVAL.md` | PASS with known gap | Claim chrome VI, headless `/claim` | Guest Invite lẫn chrome (PD audit); O02 N/A web tabs nhưng PD guest nav |
| `D11-WEB-ADMIN-DOD.md` / Gate web | PASS / PASS with gap | Admin/Gate surface AC | Admin job IA §6.1 từng được PD review prototype — runtime tip không luôn re-check §6.1 trong DoD coding |
| `D11-PD-REVIEW.md` | PASS (design) | IA personas trên **prototype** | Prototype ≠ runtime; DoD coding sau đó không inherit verify tab ẩn |

---

## Quan sát tip (sản phẩm) — `a8e70ca134ba305b3b52fff0e8a81a2e0871ca20`

```tsx
// apps/mobile/src/app/(tabs)/_layout.tsx — tip
<NativeTabs.Trigger name="(events)" />   // Sự kiện
<NativeTabs.Trigger name="my-tickets" /> // Vé của tôi
<NativeTabs.Trigger name="staff" />      // Nhân viên — luôn mount
```

- Không có nhánh ẩn/disabled theo membership / event assignment / server permission.
- Khớp O02 «navigation theo permission» và PD §6.1 «Staff ẩn/disabled nếu không có quyền» → **chưa đạt trên tip**.
- Staff screen vẫn fail-closed scan khi chưa session (đúng safety check-in) nhưng **chrome vẫn lộ** tab Nhân viên cho mọi user — lệch O02 «không cấp quyền mới chỉ vì đổi tab» ở tầng discoverability UX.

---

## Milestone gates — residual (tóm tắt)

| Gate | Trạng thái so với tip audit | Ghi chú |
| --- | --- | --- |
| (a) Headless UAT | Index D11 @ `6f7995e…` PASS with known gap | Không cover O02 tab hide; tip HEAD mới hơn — revalidate chrome khi có Task |
| (b) Local iOS build | PASS trong milestone index | Không chứng minh permission nav |
| (c) Deploy prod | n/a / ngoài scope audit | — |
| (d) Review artifacts + SHA | Có index; thiếu #245 DoD riêng | Bổ sung khi đóng Epic |

---

## Khuyến nghị — checklist DoD bổ sung (chrome / permission)

Thêm vào Spec `reviewer-dod` / Task AC khi đụng `apps/mobile` tabs, web guest chrome, hoặc admin IA:

| # | Gate | PASS khi | FAIL khi |
| --- | --- | --- | --- |
| D-O02 | Decision log O02 | Artifact cite O02 + chứng minh nav **theo permission server**; đổi tab không tự cấp quyền | Chỉ «có tab staff» / «scan fail-closed» mà vẫn luôn hiện tab |
| D-PD-6.1 | PD IA §6.1 | iOS: Staff **ẩn hoặc disabled** khi không quyền (screenshot guest + staff); web guest nav không lẫn Invite Owner vào chrome khách nếu PD cấm | Prototype PASS kế thừa không runtime evidence |
| D-PERM-UAT | Headless/sim dual persona | ≥1 UAT guest (không membership staff) + ≥1 UAT staff assigned; so sánh tab bar | Chỉ UAT staff signed-in |
| D-READY-NAV | PRODUCTION-READINESS Navigation | Đóng dòng «Kiểm lại sau attendee» bằng artifact exact-SHA sau attendee merge | Để mở mãi trong plan UX |
| D-DECISION-ROW | Decision/ADR liên quan | Checklist DoD có cột «Decision IDs áp dụng» (O*/ADR-*) khi Architecture impact hoặc IA chrome | PASS chỉ theo Issue AC hẹp |

---

## Khuyến nghị revalidation Tasks (coordinator spawn)

| Ưu tiên | Task đề xuất | Role | Ownership | Deps | Acceptance tối thiểu |
| --- | --- | --- | --- | --- | --- |
| P0 | **iOS chrome permission (O02 / PD §6.1)** — ẩn/disable tab Nhân viên khi không quyền server | `ios` | `apps/mobile` | Flag/permission từ `/v1/me` hoặc membership assignment đã có — **không** invent role mới nếu contract đủ | Dual sim-uat PNG guest vs staff; unit layout; DoD cite O02+§6.1 |
| P0 | **DoD revalidation** exact SHA sau impl P0 | `reviewer-dod` ≠ implementer | review only | Sau P0 | Checklist D-O02 + D-PD-6.1 + D-PERM-UAT |
| P1 | **Đóng PRODUCTION-READINESS Navigation** | `product-design` hoặc `reviewer-dod` | `docs/plans/PRODUCTION-READINESS-UX.md` (+ optional review slug) | Sau P0 DoD PASS | Sửa dòng «Kiểm lại sau attendee» → PASS + link artifact SHA |
| P1 | **Bổ sung AC template** Task chrome (`docs/tasks` / role reviewer-dod) | coordinator / docs | `docs/tasks`, `docs/agents/roles/reviewer-dod.md` | Soft | Nhúng bảng gate D-O02… vào role hoặc checklist mẫu |
| P2 | **Web guest chrome** (Invite lẫn nav — PD audit) | `web` | `apps/web` | Soft PD | Headless guest home/nav; không lộ Owner invite như primary guest chrome |
| P2 | **Milestone #245 DoD slug** (residual index) | `reviewer-dod` | docs/reviews | Nếu còn thiếu | Exact SHA consumer EventReport |

---

## Checks đã chạy (audit này)

```text
git rev-parse HEAD
# a8e70ca134ba305b3b52fff0e8a81a2e0871ca20

rg 'O02' docs/reviews/          # 0 matches
rg 'Kiểm lại sau attendee' docs/
# → chỉ PRODUCTION-READINESS-UX.md:169

# Đọc: DECISION-LOG O02; D11-PRODUCTION-UX-UI §6.1;
# D11-IOS-GATE-DOD; D11-IOS-ATTENDEE-DOD; D11-MILESTONE-EVIDENCE;
# PRODUCTION-READINESS-UX Navigation; apps/mobile/.../(tabs)/_layout.tsx
```

Graph `code-review-graph-ticket`: `head_matches_build=true` @ `a8e70ca…` (session audit).

---

## Verdict artifact

**FAIL (DoD process gap)** đối với việc coi corpus reviews hiện tại đã nghiệm thu O02 / PD §6.1 chrome-permission.

**PASS with known gap** được giữ cho các DoD Gate/attendee **trong đúng AC đã ghi** — gap «không verify tab ẩn» phải được theo dõi bằng Task revalidation ở bảng trên; **không** tuyên bố pilot/production chrome xong.

Không merge. Không Hoàn thành Issue từ session này.
