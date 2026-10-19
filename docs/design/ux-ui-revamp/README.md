# UX-UI Revamp — Handoff Product Design (user site + app)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#471](https://github.com/hangndat/ticket-solution/issues/471) — Revamp UX/UI toàn bộ user site + app |
| Issue | [#472](https://github.com/hangndat/ticket-solution/issues/472) — PD handoff |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../agents/roles/product-design.md) |
| Visual budget | **Có** — chi tiết mục 0 trong [`visual-notes.md`](./visual-notes.md) |
| Architecture impact | **Có (hẹp)** — user chốt gộp shell phiên: bỏ product surface `/auth`; CTA → `/api/auth/login?return=…`; `/auth` chỉ redirect mỏng. Không đổi OIDC/contract BE. |
| Ownership artifact | Chỉ `docs/design/ux-ui-revamp/**` |
| Trạng thái | **Handoff PD** — chưa claim pilot / production ready |

> **Phase 2 (Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) / Issue [#528](https://github.com/hangndat/ticket-solution/issues/528)):** handoff mở rộng tại [`phase-2/`](./phase-2/) — event detail · account full visual · claim · Home Live Pulse polish. Tokens coding hiện hành = **Live Pulse** ([`../visual-identity-v2/`](../visual-identity-v2/)); mục 0 Phase 1 bên dưới giữ lịch sử Epic #471.  
> **Phase 3 (Epic [#546](https://github.com/hangndat/ticket-solution/issues/546) / Issue [#547](https://github.com/hangndat/ticket-solution/issues/547)):** handoff tại [`phase-3/`](./phase-3/) — membership invite · staff thin · marketing token · redeem residual. OUT: portal · Gate scanner redesign · O13 redesign · Android.

**Baseline (tham chiếu, không copy nguyên):** [`docs/design/D11-PRODUCTION-UX-UI.md`](../D11-PRODUCTION-UX-UI.md)  
**Brand nguồn:** [`brand/vemoki/`](../../../brand/vemoki/)  
**Mẫu format:** [`docs/design/o13-platform-sales/visual-notes.md`](../o13-platform-sales/visual-notes.md)

### Artifact trong thư mục

| File | Nội dung |
| ---- | -------- |
| [README.md](./README.md) | Mục 1–5 Phase 1: flow, states, a11y tóm tắt, UI AC + UAT, triển khai |
| [visual-notes.md](./visual-notes.md) | Mục 0 Phase 1: brand/visual budget + freeze + priority screens |
| [phase-2/](./phase-2/) | Phase 2 — mục 0–5 cho event · account · claim (+ Home polish) |
| [phase-3/](./phase-3/) | Phase 3 — mục 0–5 cho invite · staff thin · marketing token · redeem residual |

### DoD role product-design (checklist)

- [x] **0** Brand/visual budget — tokens, type, surfaces, anti-patterns, motion, **4** priority screens (đã gộp `/auth`), freeze
- [x] **1** User flow attendee/public + phiên gắn Home/Đổi mã/Ví
- [x] **2** UI states (empty/loading/ready/error/denied/… + auth trên màn gốc)
- [x] **3** Accessibility WCAG 2.2 AA mục tiêu
- [x] **4** UI AC + map UAT headless
- [x] **5** Hướng dẫn triển khai web ∥ iOS (không BE, không portal)

**OUT đợt này:** `apps/portal`, Android, payment, deploy prod, store submit, Gate/Scanner staff, Admin Event Manager workbench, marketing sales O13 (đã có handoff riêng).

---

## 1. User flow

Persona chính: **Attendee / khách công khai** (đã đăng nhập hoặc chưa). Staff Gate / Admin **không** thuộc priority screens đợt này.

### 1.1 Home công khai → sự kiện / đổi mã (web primary)

```text
[app host Home `/`]
  → brand wordmark + danh sách / spotlight sự kiện đã xuất bản
      ├─ loading catalog → skeleton / «Đang tải sự kiện…»
      ├─ empty → «Chưa có sự kiện đang mở»
      ├─ error → «Không tải được danh sách» + Thử lại
      └─ ready → chọn sự kiện hoặc CTA «Đổi mã lấy vé»
  → /redeem (hoặc deep-link sự kiện nếu đã có slug — không invent route mới)
```

Copy guest: «sự kiện», «đổi mã lấy vé», «đăng nhập» — **không** lộ Nest/BFF/fixture jargon trên chrome khách.

### 1.2 Đổi mã → vé (web + iOS)

```text
[Đổi mã]
  → thiếu phiên / email chưa xác minh
      └─ CTA «Cần đăng nhập» / «Xác minh email»
         → web: `/api/auth/login?return=<path đổi mã>` (không qua màn `/auth`)
         → iOS: OIDC sheet → quay stack đổi mã
         (không thiết kế anonymous OTP mới trong Epic này — giữ contract hiện hành)
  → form: mã + câu trả lời (nếu có) + đồng ý điều khoản
  → đang xử lý
      ├─ đã cấp vé → thẻ vé / chuyển ví hoặc chi tiết vé
      ├─ chờ duyệt → chưa phải vé
      ├─ lỗi trường → focus + sửa
      ├─ biểu mẫu/điều khoản đã đổi → tải lại + đồng ý lại
      ├─ từ chối (mã/hết suất/…) → plain VI
      └─ chưa rõ → «Kiểm tra lại» — không hiện vé giả
```

### 1.3 Ví / danh sách vé (iOS primary; web phụ)

```text
[Ví]
  → signed-out → CTA đăng nhập trên chính màn Ví (không fake list)
      → web: `/api/auth/login?return=<ví>` · iOS: OIDC sheet
  → online verified → danh sách vé theo sự kiện + trạng thái
  → offline → chỉ hiển thị cache đã lưu; nhãn «Đang xem vé đã lưu — chưa kết nối»
  → chọn vé → Chi tiết + QR
```

### 1.4 Chi tiết vé + QR

```text
[Vé]
  → ready: tên sự kiện, trạng thái, QR (alt text), mã phụ secondary
  → expired / đã dùng / revoked → copy plain + không gợi ý quét cổng
  → demo/fixture → nhãn rõ «Không dùng vào cổng»
```

### 1.5 Phiên (gộp — không màn `/auth`)

```text
Nhu cầu phiên từ Home / Đổi mã / Ví / deep-link
  → web: thẳng `/api/auth/login?return=<màn gốc>` (Keycloak)
  → iOS: OIDC sheet trên stack hiện tại
  → success → quay `return` / stack trước
  → cancel / fail → thông báo trên màn gốc (hoặc Home nếu mất return) + CTA thử lại / về Home·Ví
  → quản lý phiên / đăng xuất: `/account` (web) hoặc account trong shell iOS
  → `/auth` (nếu còn): chỉ redirect mỏng → Home hoặc `return` / notice query — không UI khách riêng
```

### Touch map (đợt revamp)

| Việc | Web (`apps/web`) | iOS (`apps/mobile`) |
| ---- | ---------------- | ------------------- |
| Home / catalog | **Primary** (+ CTA đăng nhập) | Events list (shell) |
| Đổi mã | Primary (+ CTA auth inline) | Có |
| Ví + QR | Phụ (`/t/…/tickets/…`) | **Primary** |
| Phiên | Gộp vào màn gốc + `/account`; `/auth` = redirect mỏng | Signed-out wallet + OIDC sheet |
| Gate / Admin | OUT đợt này | OUT đợt này |

---

## 2. UI states

Áp dụng cho **4 priority screens** (mục 0). Copy gợi ý **Tiếng Việt** trên UI khách. State auth gắn **màn gốc** (Home / Đổi mã / Ví), không có bảng riêng cho `/auth`.

### 2.1 Home công khai

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Catalog rỗng | «Chưa có sự kiện đang mở» |
| loading | Đang fetch | «Đang tải sự kiện…» / skeleton |
| ready | Có sự kiện | Brand + list/spotlight + CTA Đổi mã (+ Đăng nhập nếu signed-out) |
| error / retry | API/catalog fail | «Không tải được danh sách» + Thử lại |
| denied | Notice staff / auth fail trên Home | Copy plain theo `notice` — không jargon |
| auth cancel/fail | OIDC hủy/lỗi với return=`/` | «Không đăng nhập được» + Thử lại / ở lại Home |

### 2.2 Đổi mã

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Chưa có form/sự kiện | «Chọn sự kiện hoặc thử lại» |
| loading | Đang tải form / submit | «Đang tải…» / «Đang xử lý…» |
| ready | Form sẵn sàng | «Đổi mã lấy vé» + điều khoản |
| error / retry | Lỗi mạng / chưa rõ | Chi tiết ngắn + Thử lại / «Kiểm tra lại» |
| denied | Mã/hết suất/từ chối | Plain VI — không vé giả |
| expired | Form/điều khoản đổi hoặc hết hạn | Tải lại + đồng ý lại |
| auth | UNAUTHENTICATED / EMAIL_NOT_VERIFIED | «Cần đăng nhập» / «Xác minh email» |
| offline | Không mạng | «Không có mạng — thử lại khi có kết nối» |

### 2.3 Ví / danh sách vé

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Đã login, chưa có vé | «Chưa có vé trong ví» + CTA Đổi mã |
| loading | Sync ví | «Đang tải vé…» |
| ready | Có vé | Tên sự kiện + trạng thái (UUID secondary) |
| error / retry | Sync fail | «Không tải được vé» + Thử lại |
| denied | Session invalid | CTA đăng nhập trên Ví (`return` về Ví) — không đẩy `/auth` |
| auth cancel/fail | OIDC hủy/lỗi | Thông báo trên Ví + Thử lại |
| offline | Cache only | «Đang xem vé đã lưu — chưa kết nối» |

### 2.4 Chi tiết vé + QR

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| loading | Fetch detail | «Đang tải vé…» |
| ready | Vé hợp lệ hiển thị | QR + meta; nhãn demo nếu fixture |
| error | Không tải được | Thử lại / về ví |
| denied / expired | Revoked / hết hạn / đã check-in (nếu surface) | Plain VI — không khuyến khích quét cổng |
| offline | Từ cache | Cùng nhãn offline ví |

### 2.5 Account (web — ngoài 4 màn visual, chức năng tối thiểu)

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| ready | Đã đăng nhập | Tóm tắt phiên + Đăng xuất |
| signed-out | Vào `/account` khi chưa phiên | CTA đăng nhập `return=/account` hoặc về Home |
| loading | Logout / refresh | «Đang xử lý…» |

`/auth`: không bảng state product — redirect / query notice chỉ.

---

## 3. Accessibility (WCAG 2.2 AA mục tiêu)

Chi tiết bảng: [`visual-notes.md` § Accessibility](./visual-notes.md#3-accessibility-wcag-22-aa).

Tối thiểu đợt này: contrast ink/paper/signal; `:focus-visible` / VoiceOver focus; hit target ≥44×44; label mọi control; lỗi `aria-live` / announce; `prefers-reduced-motion`; QR có text thay thế; không chỉ màu cho trạng thái vé.

| Automated | Manual |
| --------- | ------ |
| axe / Playwright contrast, labels, `lang` | First viewport brand composition |
| Tab order smoke (web) | VoiceOver / TalkBack-equivalent label QR + lỗi form |
| | Keyboard-only redeem submit + retry |
| | iOS hit targets ví / CTA |

Handoff PD **không** chứng minh runtime a11y pass — coding Task đo trên exact SHA.

---

## 4. UI AC + map UAT headless

### 4.1 Acceptance (quan sát được)

| ID | Given / When / Then | Surface |
| -- | ------------------- | ------- |
| AC-H1 | Home ready → wordmark `vemoki` hero-level; **không** Nest/BFF disclaimer trên chrome khách | Home web |
| AC-H2 | Catalog fail → copy «Không tải được danh sách» + control Thử lại | Home web |
| AC-R1 | Auth thiếu → «Cần đăng nhập» / xác minh email — không submit cấp vé | Đổi mã |
| AC-R2 | Issued → thẻ vé/QR; unknown → không vé giả + «Kiểm tra lại» | Đổi mã |
| AC-R3 | Form stale → bắt tải lại + đồng ý lại trước submit | Đổi mã |
| AC-W1 | Signed-out ví → CTA đăng nhập, không list giả | Ví iOS |
| AC-W2 | Offline ví → nhãn cache; không claim sync mới | Ví iOS |
| AC-T1 | Vé ready → QR có accessible name; demo → nhãn không vào cổng | Chi tiết vé |
| AC-S1 | Auth cancel/fail → thông báo trên **màn gốc** (Home/Đổi mã/Ví) + CTA thử lại / về Home·Ví; **không** bắt buộc land UI `/auth` | Phiên gộp |
| AC-S2 | CTA đăng nhập từ Home/Đổi mã/Ví → `/api/auth/login?return=…` (web) hoặc OIDC sheet (iOS); success quay đúng `return` | Phiên gộp |
| AC-V1 | Tokens ink/paper/signal/focus + Syne / Be Vietnam Pro; không Inter/purple hero | Cả 4 màn |

### 4.2 Map UAT headless

| Surface | Script | Gợi ý bước / artifact |
| ------- | ------ | --------------------- |
| Web Home / Redeem (+ auth return) | `scripts/web-uat.sh` (Playwright headless) | Screenshot `apps/web/.uat-artifacts/`; assert AC-H* / AC-R* / AC-S1–S2; `/auth` nếu còn chỉ redirect |
| iOS Ví / Redeem / Ticket | `scripts/sim-uat.sh` (AXe + `simctl`) | Screenshot `apps/mobile/.uat-artifacts/`; assert AC-W* / AC-T1 |

**Cấm:** `cliclick`, AppleScript click, `ORCA computer click` trên Chrome/Safari/Simulator của user (xem `.cursor/rules/uat-headless.mdc`).

---

## 5. Hướng dẫn triển khai

| Hạng mục | Chỉ dẫn |
| -------- | ------- |
| Ownership web | `apps/web` — Home, `/redeem`, ticket pages, `/account`; CTA login → `/api/auth/login?return=…`. `/auth` → stub redirect (không redesign). **Không** portal, **không** BE. |
| Ownership iOS | `apps/mobile` — Events shell, Redeem, My Tickets, Ticket detail, OIDC session trên stack. Team `BLUA62D52G`; **không** EAS Cloud Build. |
| Tokens | Map từ `brand/vemoki/tokens.json` → CSS vars / RN theme đã có (`globals.css`). Không invent palette. |
| Fonts | Display **Syne**, body **Be Vietnam Pro** (web next/font; iOS tương đương đã ship hoặc escalate nếu thiếu). |
| Components | Reuse `SurfaceState` / screen-state patterns; CTA signal fill + paper/ink text đủ contrast. |
| Contract flags | Auth redeem fail-closed hiện hành; anonymous OTP = **TBD product**. **IA đã chốt:** gộp `/auth` — coding được phép stub/redirect `/auth` + chuyển deep-link/logout post về Home/`return`/`account`; không dựng UI auth mới. Đổi OIDC/callback BE → escalate Architect. |
| Parallel | Sau PD: fan-out **web ∥ ios** theo **4** màn; mỗi Task Spec chỉ **link** artifact này — không paste lại PRD. |

### Thứ tự implement (good enough)

1. Tokens + chrome (nav/wordmark/focus) trên 4 màn + CTA login `return=`  
2. Home copy + composition (AC-H*) + auth notice nếu có  
3. Đổi mã states + plain VI + login inline (AC-R*, AC-S2)  
4. Ví + offline label + signed-out CTA (AC-W*)  
5. Chi tiết vé / QR a11y (AC-T1)  
6. Stub `/auth` redirect + `/account` tối thiểu (AC-S1)  
7. Polish motion 2–3 trong budget (xem visual-notes)

### Good enough MVP đợt này

- 4 priority screens đạt visual budget + states + AC trên  
- Phiên gộp (không UI `/auth` khách)  
- Chưa: redesign Admin/Gate, marketing O13, portal Ant Design, payment, Android

### Freeze (nhắc)

> Implementer **không invent** visual / màn / token ngoài khối mục 0 trong [`visual-notes.md`](./visual-notes.md). **Không** dựng lại trang `/auth` làm surface khách. Thiếu token hoặc cần đổi IA/route ngoài quyết định gộp phiên → escalate coordinator (Architect), không tự ADR.

---

## Liên kết

- Epic [#471](https://github.com/hangndat/ticket-solution/issues/471) · Issue [#472](https://github.com/hangndat/ticket-solution/issues/472)  
- Brand [`brand/vemoki/`](../../../brand/vemoki/) · Baseline D11 [`D11-PRODUCTION-UX-UI.md`](../D11-PRODUCTION-UX-UI.md)  
- O13 sales (ngoài scope coding đợt này): [`o13-platform-sales/`](../o13-platform-sales/)
