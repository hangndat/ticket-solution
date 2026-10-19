# UX-UI Phase 2 — Handoff Product Design (event · account · claim)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#527](https://github.com/hangndat/ticket-solution/issues/527) — Phase 2 mở rộng user surfaces |
| Issue | [#528](https://github.com/hangndat/ticket-solution/issues/528) — PD handoff |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../../agents/roles/product-design.md) |
| Visual budget | **Có** — mục 0 trong [`visual-notes.md`](./visual-notes.md) |
| Cost tier | `standard` |
| Architecture impact | **Không** — giữ route/IA đã có; escalate Architect chỉ nếu cần route mới |
| Ownership artifact | `docs/design/ux-ui-revamp/phase-2/**` (+ đọc brand / Phase 1) |
| Trạng thái | **Handoff PD** — chưa claim pilot / production ready |

**Baseline Phase 1 (đã ship):** [`../README.md`](../README.md) · Epic [#471](https://github.com/hangndat/ticket-solution/issues/471)  
**Brand / tokens:** Live Pulse — [`brand/vemoki/`](../../../../brand/vemoki/) · freeze [`../../visual-identity-v2/`](../../visual-identity-v2/)

### Artifact trong thư mục

| File | Nội dung |
| ---- | -------- |
| [README.md](./README.md) | Mục 1–5: flow, states, a11y tóm tắt, UI AC + UAT, triển khai |
| [visual-notes.md](./visual-notes.md) | Mục 0: brand/visual budget + freeze + **4** priority screens |

### DoD role product-design (checklist)

- [x] **0** Brand/visual budget — Live Pulse inherit, type, surfaces, anti-patterns, motion, **4** priority screens, freeze
- [x] **1** User flow event / account / claim (+ Home polish)
- [x] **2** UI states empty/loading/ready/error/denied/…
- [x] **3** Accessibility WCAG 2.2 AA mục tiêu
- [x] **4** UI AC + map UAT headless
- [x] **5** Hướng dẫn triển khai web ∥ iOS (không BE, không portal)

**OUT:** `apps/portal`, Gate/admin staff, O13 marketing redesign, Android, payment, deploy, store, coding `apps/**` trong Task PD này.

---

## 1. User flow

Persona: **Attendee / khách công khai** (đã đăng nhập hoặc chưa). Staff Gate / Admin **OUT**.

### 1.1 Chi tiết sự kiện công khai (priority #1)

```text
[Home / catalog hoặc deep-link]
  → /t/{tenantSlug}/events/{eventSlug}  ·  iOS event-detail
      ├─ loading → «Đang tải sự kiện…»
      ├─ not-found / unpublished → «Sự kiện không khả dụng» (không fallback demo production)
      ├─ unreachable / invalid → error + Về trang chủ / Thử lại
      ├─ misconfigured (iOS) → «Chưa cấu hình API» — không thay demo
      └─ ready → composition: banner + tên + meta + CTA
            ├─ primary CTA → Đổi mã (`/redeem?tenantSlug&eventSlug` / redeem stack)
            ├─ secondary → Nhận lời mời (`/claim` / claim) — nếu có intent/link
            └─ in-page → FAQ / terms / sections đã xuất bản
  → fixture demo (iOS only, route fixture) → nhãn «Demo · dữ liệu mẫu» rõ; không đăng ký vé
```

Copy guest: «sự kiện», «đổi mã lấy vé», «nhận lời mời» — **không** Nest/BFF/projection jargon trên chrome khách.

### 1.2 Tài khoản — full visual (priority #2)

```text
[/account · iOS account]
  → signed-out
      → CTA Đăng nhập
         web: `/api/auth/login?return=/account`
         iOS: OIDC sheet → xác minh /v1/me (không coi token local = signed-in)
  → loading phiên / busy login·logout
  → signed-in ready
      → tóm tắt phiên (email secondary) + Đăng xuất + deep-link Đổi mã
      → (iOS) Làm mới hồ sơ · Push status · offline-bound label nếu có
      → Yêu cầu xóa tài khoản (panel riêng — states deletion hiện hành)
      → link Chính sách quyền riêng tư
  → error phiên / mạng → Thử lại + Đăng nhập / Về trang chủ
  → OIDC chưa cấu hình (iOS) → notice fail-closed, không fake account
```

Phase 1 ghi Account «tối thiểu ngoài visual» — **Phase 2 nâng full visual** (hierarchy, tokens, CTA signal, spacing) trên cùng nghiệp vụ; không invent màn auth riêng.

### 1.3 Claim / nhận lời mời (priority #3)

Flow sản phẩm **còn**: guest invitation claim (khác redeem mã; khác invite thành viên tổ chức).

```text
[Deep-link / fragment: token + tenantId + eventId (± slugs)]
  → web `/claim` · iOS `claim`
  → park intent trước login; xoá khi đổi user / logout / thành công terminal
  → thiếu phiên / email chưa khớp lời mời
      └─ CTA đăng nhập → quay lại claim với cùng intent
  → tải form + terms từ published schema (slug) nếu có
      ├─ schema fail → «Không tải được biểu mẫu» — không fixture
      └─ ready → điền answers + đồng ý điều khoản
  → submit
      ├─ issued → thẻ vé / chuyển ví hoặc chi tiết vé
      ├─ pending → «chưa phải vé» + Kiểm tra lại
      ├─ denied / expired / mismatch email → plain VI
      ├─ field/terms error → focus + sửa
      └─ unknown → «Kiểm tra lại» — không vé giả
```

### 1.4 Polish Home (priority #4 — optional composition)

```text
[Home `/` · iOS Events shell]
  → Giữ flow Phase 1 (§1.1 parent README)
  → Chỉ chỉnh: tokens Live Pulse (Sora, ink/paper/signal/focus) + first viewport
     một composition nếu còn lệch v1/Syne hoặc flat-only
  → Không đổi IA / không thêm section marketing O13
```

### Touch map Phase 2

| Việc | Web (`apps/web`) | iOS (`apps/mobile`) |
| ---- | ---------------- | ------------------- |
| Event detail | **Primary** `/t/…/events/…` | `event-detail` (+ fixture nhãn rõ) |
| Account | `/account` full visual | `account` full visual |
| Claim | `/claim` + fragment intent | `claim` + parked intent |
| Home polish | `/` first viewport | Events shell |
| Portal / Gate / Admin | OUT | OUT |

---

## 2. UI states

Copy gợi ý **Tiếng Việt** trên UI khách.

### 2.1 Chi tiết sự kiện công khai

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| loading | Fetch published detail | «Đang tải sự kiện…» / skeleton |
| ready | Có projection đã xuất bản | Banner + H1 tên + meta + CTA Đổi mã / Nhận lời mời |
| empty / not-found | 404 unpublished | «Sự kiện không khả dụng» — không demo thay |
| error / retry | Unreachable / invalid payload | «Không tải được sự kiện» + Về trang chủ (web) / Thử lại (iOS) |
| misconfigured | Thiếu API base (iOS) | «Chưa cấu hình API» — fail-closed |
| demo / fixture | Explicit fixture route | Nhãn «Demo · dữ liệu mẫu · chưa xuất bản» — không CTA đăng ký thật |

### 2.2 Tài khoản

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| loading | Fetch `/api/bff/me` / busy | «Đang xử lý…» / «Đang xác nhận trạng thái đăng nhập» |
| ready signed-in | Phiên verified | «Bạn đang đăng nhập…» + Đăng xuất + Đổi mã |
| signed-out | Chưa phiên | «Chưa đăng nhập» + CTA Đăng nhập `return=/account` |
| error / retry | Mạng / me fail | «Không tải được phiên» + Đăng nhập / Về trang chủ |
| offline-bound (iOS) | Cache offline, chưa verified | «Xem offline (chưa xác minh phiên)» — không tải hồ sơ bằng offline auth |
| oidc-missing (iOS) | Build thiếu config | «Chưa cấu hình đăng nhập» — không fake |
| deletion-* | Panel xóa TK | Giữ state machine hiện hành (idle / submitted / error retryable) — visual đồng bộ Live Pulse |

### 2.3 Claim

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Thiếu token/scope | «Thiếu token lời mời…» / hướng mở đúng liên kết |
| loading | Load schema / submit | «Đang tải…» / «Đang xử lý…» |
| ready | Form + terms sẵn; đã login | Biểu mẫu + đồng ý điều khoản + «Nhận vé mời» |
| auth | Chưa verified | «Cần đăng nhập» / «Đăng nhập bằng email đã được mời» |
| error / retry | Schema/API fail | «Không tải được biểu mẫu» + Thử lại |
| issued | Vé cấp | Outcome success + đường vào ví/chi tiết |
| pending | Chờ duyệt | «Chưa phải vé» + «Kiểm tra lại» |
| denied / expired | Từ chối / hết hạn / email mismatch | Plain VI — không vé giả |
| stale intent | Đổi user / logout | «Đã xoá lời mời sau khi đổi tài khoản…» |

### 2.4 Home polish

States giữ Phase 1 §2.1 (`empty` / `loading` / `ready` / `error` / auth notice). Phase 2 chỉ siết visual budget Live Pulse trên cùng states.

---

## 3. Accessibility

Chi tiết: [`visual-notes.md` § Accessibility](./visual-notes.md#3-accessibility-wcag-22-aa).

Tối thiểu Phase 2: contrast Live Pulse + tenant accent an toàn; focus/keyboard trên event FAQ & claim form; hit ≥44; live region claim/account; alt banner/logo; `prefers-reduced-motion`.

---

## 4. UI AC + map UAT headless

### 4.1 Acceptance (quan sát được)

| ID | Given / When / Then | Surface |
| -- | ------------------- | ------- |
| AC-E1 | Event ready → first viewport một composition: media plane + tên hero-level + ≤1 support + nhóm CTA; **không** card cluster | Event detail |
| AC-E2 | not-found / unreachable → plain VI + thoát an toàn; **không** fallback demo production | Event detail |
| AC-E3 | CTA Đổi mã mang `tenantSlug`+`eventSlug` (web query / iOS stack) | Event detail |
| AC-A1 | Signed-out account → CTA login `return=/account` (web) hoặc OIDC (iOS); không list giả | Account |
| AC-A2 | Signed-in → Đăng xuất visible; deletion + privacy reachable; visual Live Pulse (không utility xám tối thiểu) | Account |
| AC-A3 | (iOS) Offline-bound ≠ signed-in verified; copy phân biệt | Account |
| AC-C1 | Thiếu phiên → chặn submit + CTA đăng nhập; intent được giữ qua login-return | Claim |
| AC-C2 | Issued → outcome vé; pending → không hiện vé giả; denied → plain VI | Claim |
| AC-C3 | Đổi tài khoản / logout → xoá parked intent + answers | Claim |
| AC-H1 | Home first viewport: wordmark `vemoki` hero-level + tokens Live Pulse (Sora / signal `#E11D48`) | Home polish |
| AC-V1 | Tokens ink/paper/signal/focus + Sora / Be Vietnam Pro; không Inter/purple/Syne hero | Cả 4 màn |

### 4.2 Map UAT headless

| Surface | Script | Gợi ý bước / artifact |
| ------- | ------ | --------------------- |
| Web event / account / claim | `scripts/web-uat.sh` (Playwright headless) | Screenshot `apps/web/.uat-artifacts/`; assert AC-E* / AC-A* / AC-C* / AC-H1 |
| iOS event-detail / account / claim | `scripts/sim-uat.sh` (AXe + `simctl`) | Screenshot `apps/mobile/.uat-artifacts/`; assert cùng AC + VoiceOver smoke |

**Cấm:** `cliclick`, AppleScript click, `ORCA computer click` trên Chrome/Safari/Simulator của user (`.cursor/rules/uat-headless.mdc`).

---

## 5. Hướng dẫn triển khai

| Hạng mục | Chỉ dẫn |
| -------- | ------- |
| Ownership web | `apps/web` — `app/t/[tenantSlug]/events/[eventSlug]`, `app/account`, `app/claim`, Home polish. **Không** portal, **không** BE. |
| Ownership iOS | `apps/mobile` — `screens/event-detail`, `screens/account`, `screens/claim`, Events shell. Team `BLUA62D52G`; **không** EAS Cloud Build. |
| Tokens | Map `brand/vemoki/tokens.json` Live Pulse → CSS vars / RN theme. Không invent. Tenant brand chỉ accent cục bộ trên event. |
| Fonts | Display **Sora**, body **Be Vietnam Pro**. Thay Syne còn sót trên 4 màn Phase 2. |
| Components | Reuse `SurfaceState` / screen-state / `EventMedia*` / redeem form fields / account deletion panel — skin Live Pulse, không viết DS mới. |
| Contract flags | Claim intent park/resume + published schema; account deletion + `/api/bff/me` hiện hành. **Không** đổi OIDC/callback. Route mới → escalate Architect. |
| Parallel | Sau PD: fan-out **web ∥ ios** theo **4** màn; mỗi Task Spec **link** artifact này — không paste PRD. |

### Thứ tự implement (good enough)

1. Tokens/chrome Live Pulse trên 4 màn (nếu Home còn v1)  
2. Event detail composition + states (AC-E*) — web ∥ iOS  
3. Account full visual + session states (AC-A*)  
4. Claim states + intent/login-return (AC-C*)  
5. Motion 2–3 trong budget + a11y smoke  
6. UAT headless evidence trên exact SHA

### Good enough MVP Phase 2

- 4 priority screens đạt visual budget + states + AC trên  
- Claim vẫn là flow sản phẩm (invitation), không gộp vào redeem  
- Chưa: portal, Gate/Admin, O13 redesign, Android, payment

### Freeze (nhắc)

> Implementer **không invent** visual / màn / token ngoài khối mục 0 trong [`visual-notes.md`](./visual-notes.md). Thiếu token hoặc cần IA/route mới → escalate coordinator (Architect).

---

## Liên kết

- Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) · Issue [#528](https://github.com/hangndat/ticket-solution/issues/528)  
- Phase 1 [`../`](../) · Live Pulse [`../../visual-identity-v2/`](../../visual-identity-v2/) · Brand [`brand/vemoki/`](../../../../brand/vemoki/)  
- O13 sales (OUT redesign): [`../../o13-platform-sales/`](../../o13-platform-sales/)
