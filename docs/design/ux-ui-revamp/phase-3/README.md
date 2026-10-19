# UX-UI Phase 3 — Handoff Product Design (invite · staff thin · marketing · redeem polish)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#546](https://github.com/hangndat/ticket-solution/issues/546) — Phase 3 mở rộng surface còn lại |
| Issue | [#547](https://github.com/hangndat/ticket-solution/issues/547) — PD handoff |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../../agents/roles/product-design.md) |
| Visual budget | **Có** — mục 0 trong [`visual-notes.md`](./visual-notes.md) |
| Cost tier | `standard` |
| Architecture impact | **Không** — giữ route/IA đã có; escalate Architect chỉ nếu cần route mới |
| Ownership artifact | `docs/design/ux-ui-revamp/phase-3/**` (+ đọc brand / Phase 1–2) |
| Trạng thái | **Handoff PD** — coding wave #554/#555 merged; epic triage [`EPIC-TRIAGE-546.md`](./EPIC-TRIAGE-546.md) |

**Baseline:** Phase 1 [`../README.md`](../README.md) · Phase 2 [`../phase-2/`](../phase-2/) · Epic [#471](https://github.com/hangndat/ticket-solution/issues/471) / [#527](https://github.com/hangndat/ticket-solution/issues/527)  
**Brand / tokens:** Live Pulse — [`brand/vemoki/`](../../../../brand/vemoki/) · freeze [`../../visual-identity-v2/`](../../visual-identity-v2/)

### Artifact trong thư mục

| File | Nội dung |
| ---- | -------- |
| [README.md](./README.md) | Mục 1–5: flow, states, a11y tóm tắt, UI AC + UAT, triển khai |
| [visual-notes.md](./visual-notes.md) | Mục 0: brand/visual budget + freeze + **4** priority screens |
| [EPIC-TRIAGE-546.md](./EPIC-TRIAGE-546.md) | Đóng Epic #546 vs child Task; pointer ops residual |
| [invite-staff-polish-handoff.md](./invite-staff-polish-handoff.md) | **5** polish priorities invite + staff thin (post-wave) |

### DoD role product-design (checklist)

- [x] **0** Brand/visual budget — Live Pulse inherit, type, surfaces, anti-patterns, motion, **4** priority screens, freeze
- [x] **1** User flow invite / staff thin / marketing token / redeem residual
- [x] **2** UI states empty/loading/ready/error/denied/…
- [x] **3** Accessibility WCAG 2.2 AA mục tiêu
- [x] **4** UI AC + map UAT headless
- [x] **5** Hướng dẫn triển khai web ∥ iOS (không BE, không portal)

**OUT:** `apps/portal` · Gate scanner redesign · O13 sales redesign · Android · payment · deploy · store · coding `apps/**` trong Task PD này.

---

## 1. User flow

Persona: **Attendee / khách công khai** + **người nhận membership invite** (có thể trở thành staff/owner sau accept). Gate scanner operator **không** thuộc redesign — chỉ soft-entry deny/redirect.

### 1.1 Nhận lời mời thành viên (priority #1)

Khác Phase 2 **`/claim`** (vé mời sự kiện). Đây là **membership invite** tổ chức.

```text
[Email / deep-link: #token=… hoặc ?token= legacy]
  → web `/invite`
  → park token vào sessionStorage; strip hash/query khỏi URL (no-referrer)
  → thiếu phiên / email chưa khớp
      └─ CTA Đăng nhập → `/api/auth/login?return=/invite`
  → empty (chưa có token) → «Chưa có mã lời mời» + hướng mở đúng link
  → ready → điền/ xác nhận mã + «Nhận lời mời»
  → submit (CSRF sẵn)
      ├─ success → «Đã nhận lời mời» + link Admin tenant (không fake Owner)
      ├─ used / invalid / expired / email mismatch → plain VI fail-closed
      ├─ auth / CSRF → không coi thành công; thử lại / đăng nhập
      ├─ network / rate limit → Thử lại
      └─ unknown → «Kết quả chưa rõ» — không claim success
  → iOS: không màn native — mở web `/invite` (Safari / in-app browser) nếu deep-link; không invent `screens/invite`
```

Copy guest: «lời mời thành viên», «đăng nhập đúng email đã được mời» — **không** Keycloak / Nest / BFF / «fragment» jargon trên chrome khách (tech note chỉ trong docs/tests).

### 1.2 Staff thin soft-entry (priority #2)

Attendee-facing khi tab Nhân viên ẩn (O02). **Không** redesign scanner.

```text
[Deep-link / soft route iOS `staff-access`]
  → identity chưa verified → eligibility reset (fail-closed)
  → verified + probing → loading «Đang kiểm tra quyền nhân viên»
  → staffEligible true → Redirect `/(tabs)/staff` (scanner hiện hành — OUT visual Phase 3)
  → not eligible / probe fail → Notice deny VI + announce + CTA «Về Sự kiện»
  → web `/gate`: OUT redesign (scanner tool, không soft-entry attendee)
```

### 1.3 Marketing sales chrome — token only (priority #3)

```text
[Marketing host → /marketing · /marketing/en · privacy · support]
  → Giữ IA / copy / sections hiện hành (O13 handoff + marketing code)
  → Chỉ chỉnh: tokens Live Pulse (ink/paper/signal/focus) + Sora / Be Vietnam Pro
     + contrast CTA + wordmark hero-level trên first viewport sales
  → Không đổi route host routing; không rewrite privacy/support content
  → Không Android; không portal
```

### 1.4 Redeem residual polish (priority #4)

```text
[/redeem · iOS redeem]
  → Giữ flow + states Phase 1 (auth inline, issued/pending/denied, …)
  → Chỉ siết gap visual còn sót: Syne/terracotta v1 → Live Pulse nếu còn
  → Không đổi OIDC/callback; không anonymous OTP mới
  → Known gap env OIDC issuer (local UAT) = ops — không AC visual mới
```

### Touch map Phase 3

| Việc | Web (`apps/web`) | iOS (`apps/mobile`) |
| ---- | ---------------- | ------------------- |
| Membership invite | **Primary** `/invite` | Deep-link → web (không màn native) |
| Staff thin | OUT `/gate` redesign | **Primary** `staff-access` |
| Marketing chrome | Marketing host `SalesPage` + chrome | — |
| Redeem residual | `/redeem` polish | `redeem` polish |
| Claim guest ticket | OUT (Phase 2 done) | OUT |
| Portal / Gate scanner / Admin workbench | OUT | OUT (scanner tab giữ nguyên khi eligible) |

---

## 2. UI states

Copy gợi ý **Tiếng Việt** trên UI khách (marketing EN giữ locale).

### 2.1 Membership invite (`/invite`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Chưa có token | «Chưa có mã lời mời» — mở đúng liên kết hoặc dán mã sau đăng nhập |
| loading / busy | CSRF bootstrap hoặc submit | «Đang chuẩn bị…» / «Đang nhận lời mời…» — chưa coi thành công |
| ready | Có token; có thể submit | Form + «Nhận lời mời» + CTA Đăng nhập `return=/invite` |
| success | Accept ok | «Đã nhận lời mời» + đường vào Admin tenant |
| used | Token đã dùng | «Lời mời đã được dùng» — không retry cùng token |
| invalid / expired | Sai / hết hạn / email mismatch | Plain VI — đăng nhập đúng email hoặc nhờ gửi mới |
| auth | UNAUTHENTICATED / CSRF / OIDC misconfig | «Cần đăng nhập» / phiên bảo vệ hết hạn — **không** hiện chữ Keycloak trên chrome |
| denied | PERMISSION / revoked / suspended | Plain VI fail-closed |
| error / retry | Rate limit / idempotency / generic | Thử lại / tải lại trang |
| network / unknown | Mất mạng / kết quả chưa rõ | Không claim success + Thử lại |

### 2.2 Staff thin (`staff-access`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| loading | MeEvents probe | «Đang kiểm tra quyền nhân viên» — chưa mở khu vực Nhân viên |
| ready eligible | `staffEligible === true` | Redirect tab staff (không UI riêng) |
| denied | Không eligible / probe fail | `staffDenyCopy` — title/body/announcement VI + «Về Sự kiện» |
| signed-out / reset | Logout / unsigned | Fail-closed (không sticky eligible) |

### 2.3 Marketing sales chrome

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| ready | Sales / privacy / support | Composition + content hiện hành; tokens Live Pulse |
| (không thêm empty/error catalog) | Host marketing tĩnh | Không invent state máy chủ mới trong Phase 3 |

### 2.4 Redeem residual

States giữ Phase 1 §2.2 (`empty` / `loading` / `ready` / `error` / `denied` / `auth` / `offline`). Phase 3 chỉ siết visual budget Live Pulse trên cùng states nếu còn lệch.

---

## 3. Accessibility

Chi tiết: [`visual-notes.md` § Accessibility](./visual-notes.md#3-accessibility-wcag-22-aa).

Tối thiểu Phase 3: contrast Live Pulse trên invite/marketing/staff CTA; focus/keyboard invite; live region invite outcome + staff deny; hit ≥44; guest-safe copy (không jargon IdP); `prefers-reduced-motion`.

---

## 4. UI AC + map UAT headless

### 4.1 Acceptance (quan sát được)

| ID | Given / When / Then | Surface |
| -- | ------------------- | ------- |
| AC-I1 | `/invite` ready → H1 + support + login `return=/invite` + form; tokens Live Pulse (Sora / signal) | Invite |
| AC-I2 | Thiếu token → empty VI; không submit success | Invite |
| AC-I3 | Accept success → outcome VI + link Admin; used/invalid/denied → plain VI; **không** Keycloak/Nest trên chrome | Invite |
| AC-I4 | Token park từ `#token` / `?token` → strip URL; không lộ token trên address bar sau park | Invite |
| AC-S1 | staff-access loading → copy kiểm tra quyền; chưa mở scanner UI | Staff thin |
| AC-S2 | Not eligible → deny Notice + announce + CTA Về Sự kiện; **không** camera/scan canvas | Staff thin |
| AC-S3 | Eligible → vào tab staff hiện hành (không yêu cầu reskin scanner trong Phase 3) | Staff thin |
| AC-M1 | Marketing sales first viewport: wordmark `vemoki` hero-level + Live Pulse tokens; **không** đổi IA/sections O13 | Marketing |
| AC-M2 | Privacy/support dùng cùng token/type; không redesign content | Marketing |
| AC-R1 | Redeem residual: không còn Syne/terracotta v1 trên chrome form nếu còn sót; flow AC Phase 1 giữ | Redeem polish |
| AC-V1 | Tokens ink/paper/signal/focus + Sora / Be Vietnam Pro trên 4 priority; không Inter/purple | Cả 4 |

### 4.2 Map UAT headless

| Surface | Script | Gợi ý bước / artifact |
| ------- | ------ | --------------------- |
| Web invite | `scripts/web-uat.sh` / `apps/web/tests/invite-http-uat.mjs` | Screenshot `apps/web/.uat-artifacts/`; assert AC-I* (token redacted) |
| Web marketing | `scripts/web-uat.sh` Playwright headless | First viewport sales + contrast smoke AC-M* |
| Web redeem residual | `scripts/web-uat.sh` | Visual token smoke AC-R1 |
| iOS staff-access | `scripts/sim-uat.sh` | Deny path screenshot + VoiceOver announce AC-S* |

**Cấm:** `cliclick`, AppleScript click, `ORCA computer click` trên Chrome/Safari/Simulator của user (`.cursor/rules/uat-headless.mdc`).

---

## 5. Hướng dẫn triển khai

| Hạng mục | Chỉ dẫn |
| -------- | ------- |
| Ownership web | `apps/web` — `app/invite/**`, `src/platform/invite-messages.ts` (copy guest-safe), `src/marketing/**` token/type, `/redeem` residual. **Không** portal, **không** BE, **không** redesign `app/gate/**`. |
| Ownership iOS | `apps/mobile` — `app/staff-access.tsx` (+ deny copy nếu cần), `redeem` residual tokens. Team `BLUA62D52G`; **không** EAS Cloud Build; **không** reskin `screens/staff.tsx` scanner. |
| Tokens | Map `brand/vemoki/tokens.json` Live Pulse → CSS vars / RN theme. Không invent. |
| Fonts | Display **Sora**, body **Be Vietnam Pro**. Thay Syne/v1 còn sót trên 4 màn. |
| Components | Reuse `SurfaceState` / `Notice` / `LoadingState` / `MarketingChrome` — skin Live Pulse, không DS mới. |
| Contract flags | Invite accept + CSRF + park token hiện hành; staff MeEvents eligibility hiện hành. **Không** đổi OIDC/callback. Route mới → escalate Architect. |
| Distinctions | `/invite` ≠ `/claim`; staff-access ≠ Gate scanner; marketing token ≠ O13 redesign. |
| Parallel | Sau PD: fan-out **web ∥ ios** theo ownership; mỗi Task Spec **link** artifact này — không paste PRD. |

### Thứ tự implement (good enough)

1. Invite visual + guest-safe copy (AC-I*) — web  
2. Marketing chrome tokens (AC-M*) — web  
3. Staff thin visual + deny states (AC-S*) — iOS  
4. Redeem residual Live Pulse (AC-R1) — web ∥ iOS nếu còn sót  
5. Motion 2–3 trong budget + a11y smoke  
6. UAT headless evidence trên exact SHA

### Good enough MVP Phase 3

- 4 priority screens đạt visual budget + states + AC trên  
- Invite membership tách rõ khỏi claim vé  
- Staff thin = soft deny/entry only — scanner OUT  
- Marketing = token consistency — O13 IA OUT  
- Chưa: portal, Gate redesign, Android, payment, store

### Freeze (nhắc)

> Implementer **không invent** visual / màn / token ngoài khối mục 0 trong [`visual-notes.md`](./visual-notes.md). **Không** redesign portal / Gate scanner / O13 sales. Thiếu token hoặc cần IA/route mới → escalate coordinator (Architect).

---

## Liên kết

- Epic [#546](https://github.com/hangndat/ticket-solution/issues/546) · Issue [#547](https://github.com/hangndat/ticket-solution/issues/547)  
- Phase 1–2 [`../`](../) · [`../phase-2/`](../phase-2/) · Live Pulse [`../../visual-identity-v2/`](../../visual-identity-v2/) · Brand [`brand/vemoki/`](../../../../brand/vemoki/)  
- O13 sales (OUT redesign): [`../../o13-platform-sales/`](../../o13-platform-sales/)  
- Invite evidence lịch sử (ops gap OIDC local): [`../../../reviews/D11-INVITE-271-EVIDENCE.md`](../../../reviews/D11-INVITE-271-EVIDENCE.md)
