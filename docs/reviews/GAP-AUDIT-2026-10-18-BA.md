# Gap audit BA — quyết định / AC vs hành vi tip workspace

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ngày | 2026-10-18 |
| Exact SHA (worktree HEAD) | `a8e70ca134ba305b3b52fff0e8a81a2e0871ca20` |
| Tip message | `docs(reviews): land DoD PASS artifact for merged PR #354` |
| `origin/main` (cùng lúc) | `cbaa293ffb266d287359b4c5c9420bcf5f50ba34` — **không** suy deploy prod = HEAD |
| Project #3 | `gh project item-list 3 --owner hangndat` — **174** item (148 Hoàn thành · 6 Đang làm · 17 Bị chặn · 2 Chưa lên lịch · 1 Sẵn sàng) |
| Architecture impact | **Không** — audit AC/coverage; không đổi ADR |
| OUT | Không sửa `apps/**`; không merge; không bịa Issue number |

**Verdict ngắn:** Kiểu gap O02 (decision/docs có, thiếu Task/AC/DoD → behavior lệch) **vẫn đúng và còn mở trên tip**. Nhiều gap UX/PR trong `PRODUCTION-READINESS-*` đã **stale** (board D11/#254/#232/#245/#246 đã Hoàn thành; privacy live 200; O06 đã chốt). Gap **mới / chưa có Issue** nổi bật: nav theo permission (O02), chrome web gắn route thay vì session, thiếu Task O13, thiếu AC Given/When/Then gắn board cho hầu hết O*.

Phân loại bằng chứng: **Fact** (source/board/curl) · **Inference** · **Chưa xác minh (NV)** runtime prod/device.

---

## 1. Phương pháp

1. Đọc `docs/DECISION-LOG.md`, `docs/PRD.md`, `docs/ROADMAP.md`, `docs/plans/PRODUCTION-READINESS-UX.md`, `PRODUCTION-READINESS-BA.md`, D11/MVP-EXPAND plans.
2. Đối chiếu Project #3 + open Issues (`gh`) — **board thắng** snapshot trong PRODUCTION-READINESS (audit đó neo HEAD `e8512d0…` / board D11 còn mở).
3. Spot-check source nav/chrome: `apps/web/src/site-chrome.tsx`, các `SiteNav variant=…`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/screens/staff.tsx`.
4. Curl public: `https://vemoki.com/privacy` → **HTTP 200** (2026-10-18T09:35Z) — khác baseline UX doc 404.

Không claim pilot/production ready; không chạy UAT app của worker khác.

---

## 2. O02 — Nav theo permission (đã lộ; xác minh lại)

### Quyết định

> O02: **Không** app staff riêng — staff trong cùng app, **navigation theo permission**. Không cấp quyền mới chỉ vì đổi tab. (DECISION-LOG; ADR-07)

### Fact source @ `a8e70ca…`

| Surface | Quan sát | Khớp O02? |
| --- | --- | --- |
| iOS tabs | `apps/mobile/src/app/(tabs)/_layout.tsx` luôn render 3 tab: Sự kiện · Vé của tôi · **Nhân viên** — **không** đọc membership/permission | **Không** |
| iOS Staff screen | `staff.tsx` fail-closed khi thiếu bearer/API (`resolveGateAuth`) — API deny, **tab vẫn hiện** với mọi user | API OK / nav **không** |
| Web chrome | `SiteNav` có variant `guest\|staff\|admin\|platform` nhưng **hardcode theo route** (`page.tsx` guest, `gate` staff, `admin`/`account` admin, `platform` platform) — **không** derive từ `/v1/me` permissions | **Không** |
| Web permissions | `permissions: string[]` có trên platform contracts; **không** dùng trong `site-chrome.tsx` | Gap |

### Board / AC

| Hạng mục | Kết quả |
| --- | --- |
| Issue Task riêng «nav theo permission / O02» | **Không thấy** trên Project #3 (search title/body O02 · staff chrome · nav permission) |
| Issue gần: #84 D6 staff/guest chrome | **Hoàn thành** — polish chrome theo route, **không** = O02 permission gating |
| Given/When/Then trong DECISION-LOG cho O02 | **Không** |
| AC trên Story D6/D11 | Không thay Task ẩn/hiện tab theo quyền server |

### AC đề xuất (Issue mới — **chưa tạo**, không bịa số)

**Tiêu đề gợi ý:** `[D12/D14] Nav theo permission (O02) — ẩn tab/menu staff khi không có quyền`

```text
Given người dùng đã đăng nhập nhưng membership không có quyền Gate/check-in
When mở app iOS
Then tab «Nhân viên» không hiển thị (và deep-link /staff bị deny + copy VI fail-closed)

Given người dùng có quyền Gate
When mở app iOS
Then tab «Nhân viên» hiển thị; vào được luồng scan

Given session web có quyền admin tenant (không chỉ đang đứng ở /admin)
When render SiteNav trên /redeem hoặc /
Then link Admin/Cổng chỉ hiện nếu permission server cho phép — không phụ thuộc URL hiện tại

Given guest chưa đăng nhập
When mở bất kỳ surface guest
Then không có lối chrome Admin/Platform/Cổng như thể đã có quyền
```

**Checks:** headless web (session fixture permissions) + `sim-uat` ẩn/hiện tab; DoD exact-SHA; Role `ios` ∥ `web` (có thể tách Task).

**Ưu tiên:** **P0** (lệch decision đã chốt + lộ diện staff UI cho attendee).

---

## 3. Guest vs staff vs admin chrome (web)

| Variant | Routes gắn cứng (fact) | Vấn đề |
| --- | --- | --- |
| `guest` | `/`, `/redeem`, `/claim`, `/invite`, `/auth` | Đúng cho anonymous; **sai** nếu user đã login staff/admin vẫn thấy guest nav trên các route này |
| `staff` | `/gate` | Ai mở URL cũng thấy nav Cổng — auth form fail-closed riêng; chrome không theo role |
| `admin` | `/admin`, `/account` | Account luôn admin chrome kể cả guest session |
| `platform` | `/platform` | Tương tự |

**Inference:** D6 (#83–#85) đã đóng chrome POC/wordmark theo **mặt route**, không theo **session permission** → residual O02/O01 mode-switch.

**Gap ID:** `GAP-BA-CHROME-01` — **P1** (UX confusion / privilege signaling); gộp AC với Task O02 hoặc Story riêng web.

Invite dùng `variant="guest"` — ổn cho accept flow; không còn «Nest BFF» trên home (UX-02 **stale**).

---

## 4. Ma trận quyết định O* → AC → Issue → shipped

| ID | Trạng thái decision | AC GWT trong DECISION-LOG? | Issue board có AC/DoD? | Hành vi tip (tóm tắt) | Gap? |
| --- | --- | --- | --- | --- | --- |
| O01 | Đã chốt MVP | Không | #10 Hoàn thành (chốt log, không AC runtime) | Một app; mode không theo permission | Một phần → O02 |
| **O02** | Đã chốt MVP | **Không** | **Không Task** | Tab/menu staff luôn có / chrome theo route | **P0 mới (xác nhận)** |
| O03 | Baseline test | Không | Capacity gắn D5/hardening | Chưa claim 50k concurrent | Known P1 (PR-10) |
| O04 | Đã chốt | Không | D6+ surfaces | UI VI mặc định | OK-A / NV copy |
| O05 | Đã chốt | Không | Gate D3+ | Một vé một lượt (invariant) | OK-A |
| O06 | **Đã chốt** 18/10 | Có số trong mục O06 | Epic **#293** Đang làm (D12) | Impl/privacy/anonymize path theo D12/D13 | Còn execution; **không** còn «policy mở» |
| O07 | Đã chốt | Không | — | Không custom domain MVP | OK |
| O08 | Đã chốt | Không | RLS reviews | Shared DB + RLS | OK-A |
| O09 | Đã chốt | Không | Branding D8/D6 | Vemoki / vemoki.com | OK-A |
| O10 | Đã chốt mở rộng + hủy | #7 rewrite | **#7** Chưa lên lịch (HỦY) | Không thấy Task feature leak Android/payment/seat/Wallet ngoài #7 | **Không leak** |
| O11 | Định hướng UX | Không feature list duyệt cứng | #222 Hoàn thành | D11 đã đóng board | Meta OK |
| O12 | Đã chốt dictionary | Dictionary (không GWT UI) | #241/#245 Hoàn thành | Consumer web merged | OK-A; NV UAT prod |
| **O13** | Đã chốt GTM | Có trong mục O13 | **Không Issue Task** (search O13/sales/trang bán — không có) | Marketing privacy/home có; sales CTA/subdomain **chưa** track | **P1 mới** |
| O14 | Đã chốt gói | Có IN/OUT | #244/#245/#246… Hoàn thành | OUT validate-only/multi-event/metrics — không thấy Task mở leak | OK |
| O15 / ADR-19 | Đã chốt | Có | #254–#257 Hoàn thành | Home dùng `loadPublishedEventList` (không fixture SoT) | OK-A source; NV deploy SHA |

**Pattern O02:** decision/docs **có** → thiếu Task + AC GWT trên board → behavior lệch kéo dài dù D6/D11 «chrome» đã Hoàn thành.

---

## 5. UX-01…UX-12 vs board / tip (stale map)

Nguồn gốc: `docs/plans/PRODUCTION-READINESS-UX.md` §6 (neo board D11 mở, privacy 404, O06 mở).

| ID | Pri gốc | Trạng thái **nay** (Fact) | Ghi chú |
| --- | --- | --- | --- |
| UX-01 | P0 | **Stale-as-open** — #254/#255/#256/#257 **Hoàn thành**; home source published-first | Còn **NV** prod tip = SHA; iOS demo catalog dev (Release ẩn) |
| UX-02 | P0 | **Stale / đóng source** — không còn «Nest BFF» trên `page.tsx` | Home copy production-oriented |
| UX-03 | P0 | **Stale-as-open** — `GET https://vemoki.com/privacy` → **200**; route `apps/web/app/marketing/privacy` | Còn khớp số O06 / EN — theo #293 |
| UX-04 | P0 | **Stale** — #236 **Hoàn thành** | Không mở lại trừ revalidation SHA mới |
| UX-05 | P0 | **Stale** — #232 **Hoàn thành** | Web Gate fail-closed đã DoD |
| UX-06 | P1 | **Stale** — #246 **Hoàn thành** | |
| UX-07 | P1 | **Stale** — #245 **Hoàn thành** | |
| UX-08 | P1 | **Còn mở (NV)** — venue camera / multi-device conflict | Không Issue riêng «venue»; D13 device smoke #327 Bị chặn |
| UX-09 | P1 | **Còn mở path** — brand/Xcode/store evidence | D13 #301/#307… |
| UX-10 | P1 | **Under-tracked** — không Issue a11y residual rõ | Không claim WCAG AA |
| UX-11 | P1 | **Còn mở product** — redeem Keycloak vs PRD OTP | Không Issue chốt product |
| UX-12 | P0 policy | **Stale-as-policy-open** — O06 **đã chốt**; execution #293 | Đổi tên: implementation/ops, không «chờ user chốt số» |

**Khuyến nghị coordinator:** đánh dấu errata trên PRODUCTION-READINESS-UX/BA hoặc supersede bằng artifact này — tránh spawn lại #232/#245/#246/#254.

---

## 6. Non-goals O10 — có bị «lọt» Task?

| Non-goal | Board mở? | Kết luận |
| --- | --- | --- |
| Android native | Chỉ #7 HỦY / Chưa lên lịch | Không leak |
| Payment / refund / transfer | Không Task Đang làm/Sẵn sàng | Không leak |
| Seat map | Không | Không leak |
| Apple/Google Wallet | Không | Không leak |
| O14 OUT: validate-only, multi-event overview, metrics product | #293 OUT ghi rõ; không Task feature mở | Không leak |

---

## 7. Bảng gap P0 / P1 / P2 (điều hành)

### 7.1 Gap **mới** hoặc **xác nhận mạnh** (không có / thiếu Issue+AC)

| ID | Pri | Gap | Evidence | Đề xuất Issue (VI, chưa tạo) |
| --- | --- | --- | --- | --- |
| **GAP-BA-O02** | **P0** | Nav/tab/menu không theo permission server | iOS `_layout.tsx` luôn «Nhân viên»; web `SiteNav` variant theo route; không Issue O02 | Xem §2 AC GWT |
| **GAP-BA-O13** | **P1** | O13 sales page / subdomain / CTA đã chốt — không Task board | DECISION-LOG O13; `gh` search không ra Issue sales/O13 | `[GTM] Web: trang bán platform O13 (vemoki.com vs app., CTA demo+quan tâm, VI+EN)` + AC GWT host/CTA/demo-label |
| **GAP-BA-AC-MATRIX** | **P1** | Hầu hết O* không có AC GWT + Task DoD gắn decision | DECISION-LOG không GWT; #10 chỉ log | Story docs: «AC runtime cho O01–O15» hoặc nhúng AC vào Issue execution (O02/O13 trước) |
| **GAP-BA-UX11** | **P1** | PRD OTP/magic link vs UI Keycloak pin — chưa chốt product | `redeem` messages UNAUTHENTICATED; PRODUCTION-READINESS UX-11 | Issue BA: chốt «guest redeem auth = Keycloak verified email (MVP)» hoặc roadmap OTP |
| **GAP-BA-CHROME-01** | **P1** | Chrome web = route variant, không session | §3 | Gộp Task web với O02 |
| **GAP-BA-UX10** | **P2** | A11y residual không Issue | UX-10; không axe suite tip | Task web optional sau D12 |
| **GAP-BA-DOCS-STALE** | **P2** | PRODUCTION-READINESS-BA/UX còn O06 mở, privacy 404, D11 mở | So với board + curl + DECISION-LOG hôm nay | Docs errata / pointer tới artifact này — không coding |

### 7.2 Gap **đã biết** trong PRODUCTION-READINESS (còn đúng một phần)

| ID gốc | Pri | Còn đúng? | Note tip `a8e70ca` / board |
| --- | --- | --- | --- |
| PR-01 O06 chưa chốt | P0 | **Không** (stale) | O06 chốt; chuyển sang impl #293 |
| PR-02 privacy 404 | P0 | **Không** (stale URL) | Live 200; còn copy khớp O06 |
| PR-03 fixture SoT | P0 | **Hẹp lại** | Board #254 family done; source web published; còn NV prod + iOS demo-dev |
| PR-04 Invite CSRF | P0 | **Có** | Trong scope #293 |
| PR-05 Web Gate #232 | P0 | **Không** (stale) | #232 Hoàn thành |
| PR-06 UAT #236 | P0 | **Không** (stale board) | #236 Hoàn thành; revalidation riêng nếu cần |
| PR-07 #245 reconcile | P1 | **Không** (stale) | #245 Hoàn thành |
| PR-08 CS #246 | P1 | **Không** (stale) | #246 Hoàn thành |
| PR-09 Device venue UAT | P0 | **Có** | D13 blocked device smoke; không claim pilot |
| PR-10 Capacity đích | P1 | **Có** | Không claim SLO |
| PR-14 Support SLA on-call | P0 ops | **Có** | #293 RUNBOOK |
| PR-11/12/13 metrics / validate-only / store | P2/OUT | OUT giữ; store = D13 #301 có chủ đích | Không phải leak O10 |

Navigation O02 trong UX §4.4 («Kiểm lại sau attendee») = **known concern** nhưng **không** có ID UX-NN / Issue → xếp **gap mới có số** `GAP-BA-O02`.

---

## 8. Board mở liên quan (không bịa số)

| Status | Issue | Liên quan audit |
| --- | --- | --- |
| Đang làm | #293 D12 production readiness sau O06 | Invite CSRF, privacy copy O06, Gate CSRF, RUNBOOK — **không** ghi O02 |
| Đang làm | #301 / #303 / #306 / #307 / #309 D13 store | UX-08/09 path; privacy in-app |
| Sẵn sàng | #305 D13-S2 runtime prod | Revalidation runtime |
| Bị chặn | #310–#312, #317, #319–#320, #327, #331–#340… | Phụ thuộc store/runtime |
| Chưa lên lịch | #7 HỦY O10 · #318 architect optional | Non-goal / optional |

---

## 9. Đề xuất AC text nhanh (copy vào Issue)

### O13 (P1)

```text
Given host marketing vemoki.com
When khách mở trang bán platform
Then thấy CTA «Xem demo» và «Đăng ký quan tâm»; mọi demo gắn nhãn giả lập; không social proof khách thật

Given host app.vemoki.com (hoặc path product đã chốt ADR)
When khách vào sản phẩm
Then không lẫn chrome marketing full GTM với shell guest redeem
```

### UX-11 auth guest (P1)

```text
Given quyết định MVP (đề xuất mặc định khớp ADR-09)
When attendee đổi mã trên web
Then bắt buộc phiên Keycloak email verified — không ship anonymous OTP trong MVP; PRD OTP ghi «sau MVP» hoặc Issue riêng
```

---

## 10. Verdict tổng hợp

| Loại | Danh sách |
| --- | --- |
| **Gap mới / xác nhận thiếu Task+AC** | `GAP-BA-O02` (P0), `GAP-BA-O13` (P1), `GAP-BA-AC-MATRIX` (P1), `GAP-BA-UX11` (P1), `GAP-BA-CHROME-01` (P1), `GAP-BA-UX10` (P2), `GAP-BA-DOCS-STALE` (P2) |
| **Đã biết PRODUCTION-READINESS — vẫn mở** | PR-04 invite CSRF; PR-09 device UAT; PR-10 capacity; PR-14 SLA/runbook; phần còn lại của #293 |
| **Đã biết PRODUCTION-READINESS — stale / đã đóng board+source** | PR-01 (policy), PR-02 (404), PR-03 (hầu hết), PR-05, PR-06, PR-07, PR-08; UX-01…07/12-as-open |
| **O10 non-goals** | Không phát hiện Task feature lọt; #7 giữ HỦY |

**Hành động đề xuất cho coordinator (không tự tạo Issue trong Task này):**

1. Mở Task P0 O02 (ios ∥ web) với AC §2 — **trước** tuyên bố chrome «đúng permission».
2. Errata / supersede PRODUCTION-READINESS-BA+UX bằng artifact này (SHA trên).
3. Mở Task O13 khi GTM vào wave; chốt UX-11 bằng Issue BA ngắn.
4. Tiếp tục #293/#301 theo board — không re-dispatch D11 slices đã Hoàn thành.

---

## 11. Checks đã chạy (docs-only)

```text
git rev-parse HEAD
# a8e70ca134ba305b3b52fff0e8a81a2e0871ca20

gh project item-list 3 --owner hangndat --format json --limit 500
curl -sI https://vemoki.com/privacy   # HTTP/2 200
# Source read: site-chrome.tsx, (tabs)/_layout.tsx, page.tsx, staff.tsx resolveGateAuth
```

Runtime app/UAT: **không chạy** trong phiên này (NV).
