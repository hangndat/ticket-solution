# Epic PORTAL — Portal admin riêng `portal.vemoki.com` (Ant Design)

| Trường | Giá trị |
| --- | --- |
| Epic đề xuất | **PORTAL** (slug board; **không** tái dùng D12/D13) |
| Vai trò soạn | Epic planner (`orca-epic-orchestrator.mdc`) — **không** ownership coding, **không** spawn |
| Agent | `cursor` (`orca-agent-routing-coordinator.mdc`) |
| Orca Run | `run_df32d5572a2d` |
| Task (bản đầu) / Task (hiệu chỉnh) | `task_b1db0479e51c` / `task_f67673d9a277` |
| Ngày | 2026-10-18 (hiệu chỉnh cùng ngày) |
| Source HEAD lúc bắt đầu Run | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Board | [Project #3](https://github.com/users/hangndat/projects/3) — Status động; file này **không** tự `Hoàn thành` / không tạo Issue |
| Architecture impact | **Có** — tách host/session + framework portal (antd); Architect ADR trước consumer deploy |
| Ngôn ngữ | Tiếng Việt (giữ ID, path, API, SHA, URL) |

**Phân loại bằng chứng**

| Loại | Áp dụng |
| --- | --- |
| **Quan sát** | Source/docs tại HEAD trên; Project #3 snapshot §1; URL chính thức + ngày truy cập §3 |
| **Peer research (Run này)** | BA/PD/… đã bàn giao hoặc đang chạy — xem §0.1; coordinator tổng hợp cuối |
| **Đề xuất planner** | Epic → Story → Task, wave, AC, migration/rollback — **chưa** approval implementation |
| **Đã confirmed (user)** | `portal.vemoki.com` = staff admin; UI **Ant Design (antd)** — **không hỏi lại** |
| **Gói đề xuất chờ user** | Một gói §9 (không 9 câu rời); Gate/Platform **không** mặc định chuyển quyền |

`worker_done` ≠ DoD ≠ research complete = implementation ready ≠ pilot ready.

**Non-goals (discovery này và mọi đề xuất PORTAL đến khi user duyệt gói §9 + ủy quyền coding)**

- Không code tính năng; không cài package; không commit/push/PR; không sửa GitHub Project/Issue; không deploy/DNS.
- Không mở Android / payment / refund / transfer / seat / Wallet / **SSO doanh nghiệp (IdP riêng tenant)** / billing / custom-domain (O10 + PRD «sau MVP»).
- **Không** cấm Keycloak IdP SSO **hiện có** của platform (login OIDC qua `auth.vemoki.com`) — khác hẳn share BFF cookie giữa host hoặc enterprise SSO feature mới (§4.3).
- Không phá invariant tenant / auth / RLS / quota / check-in.
- Không đụng working tree ngoài scope: `apps/mobile/**`, `infra/**` (dirty của user/Run khác).
- Không spawn worker từ planner.

---

## 0. Readiness — research vs implementation

| Mức | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| **Research readiness** | **Wave discovery đã điều phối** (7 worker — §0.1); BA/PD đã có báo cáo | Không còn bước “spawn S0 như chưa bắt đầu”. Coordinator **tổng hợp** peer reports còn thiếu/đang chạy rồi đưa gói §9 cho user |
| **Implementation readiness** | **Chưa** | Thiếu: (1) user duyệt **một gói** §9; (2) Architect ADR chốt kỹ thuật trong scope; (3) ủy quyền coding + lockfile; (4) WIP D12/D13 không đầy khi mở feature web |

### 0.1 Discovery Run `run_df32d5572a2d` — đã chạy (không spawn lại)

Nguồn điều phối: [PORTAL-RESEARCH-RUN.md](./PORTAL-RESEARCH-RUN.md).

| Role | Output (quan sát path local) | Ghi chú planner |
| --- | --- | --- |
| Epic planner | `docs/plans/PORTAL-EPIC-TASKS.md` (file này) | Hiệu chỉnh theo feedback coordinator |
| `product-ba` | `docs/plans/PORTAL-PRODUCT-RESEARCH.md` | **Đã có** — journeys, ma trận, AC mẫu |
| `product-design` | `docs/design/PORTAL-ANTD-UX.md` | **Đã có** — IA/shell/antd handoff đề xuất |
| `architect` | `docs/architecture/PORTAL-SUBDOMAIN-ANTD.md` | Theo nhật ký Run; đối chiếu khi tổng hợp |
| `web` | `docs/plans/PORTAL-WEB-FEASIBILITY.md` | Theo nhật ký Run; đối chiếu khi tổng hợp |
| `backend` | `docs/plans/PORTAL-BACKEND-GAPS.md` | **Đã có path** — coi là đề xuất BE peer; **không** suy gap API ngoài evidence file đó |
| `reviewer-security` | `docs/reviews/PORTAL-DISCOVERY-SECURITY.md` | Theo nhật ký Run; đối chiếu khi tổng hợp |

Planner **không chờ** mọi report còn chạy để đóng hiệu chỉnh này; coordinator tổng hợp cuối.

---

## 1. Snapshot Project #3 (live) — tránh trùng D12/D13

**Nguồn:** `gh project item-list 3 --owner hangndat` — 183 items — truy cập **2026-10-18**.

| Parent / Epic | Issue | Status | Nội dung ngắn | Trùng PORTAL? |
| --- | --- | --- | --- | --- |
| D12 Production readiness | [#293](https://github.com/hangndat/ticket-solution/issues/293) | **Đang làm** | Gap sau O06 | **Không** |
| D13 App Store | [#301](https://github.com/hangndat/ticket-solution/issues/301) | **Đang làm** | Phát hành ASC | **Không** |
| D13-S1…S4 | #303, #305, #306, #307 | **Đang làm** | Eligibility / runtime / media / archive | Không |
| D13-S6…S8 + Task | #310–#312, #317, #319, #327, #332–#339 | **Bị chặn** | Submit/release/đóng | Không |
| Keyword `portal` / `antd` trên board | — | — | **0** item lúc snapshot | Chưa có Epic PORTAL |

**Đếm Status:** Hoàn thành 161 · Bị chặn 14 · Đang làm 6 · Chưa lên lịch 2 · Chờ duyệt 0 · Sẵn sàng 0.

**Board:** mở Epic **`[PORTAL] …`** (hoặc `D14` nếu user muốn trong gói §9) — **cấm** nhét vào #293/#301.

**WIP:** feature coding PORTAL sau duyệt gói + backpressure D12/D13; discovery docs đã chạy song song là đúng.

---

## 2. Baseline quan sát (không bịa runtime)

### 2.1 Host — O13 đã chốt; portal là mở rộng confirmed

| Host | Vai trò | Trạng thái |
| --- | --- | --- |
| `vemoki.com` | Marketing / sales | O13 đã chốt |
| `app.vemoki.com` | Product (O13: attendee + admin/gate/platform) | O13 đã chốt — **sẽ thu hẹp** khi portal live |
| `portal.vemoki.com` | Staff admin (antd) | **User đã yêu cầu / confirmed** — cập nhật DECISION-LOG khi gói §9 được duyệt |
| Cookie parent | Host-only; **cấm** `Domain=.vemoki.com` | O13 B2 / ENV-MANIFEST / R-INT — giữ |

Nguồn O13: [DECISION-LOG](../DECISION-LOG.md), [o13-marketing-app-subdomain.md](../architecture/o13-marketing-app-subdomain.md).

### 2.2 Surface staff hiện có trên `apps/web`

| Surface | Path quan sát | Capability (nav) |
| --- | --- | --- |
| Tenant admin | `apps/web/app/admin/**` | `showAdmin` |
| Web Gate | `apps/web/app/gate/**` | `showGate` |
| Platform | `apps/web/app/platform/**` | `showPlatform` |
| BFF admin | `apps/web/app/api/bff/admin/**` | Cookie BFF → Bearer Nest |
| Attendee / guest | `/redeem`, `/claim`, `/t/...`, marketing | Không staff |

UI: Next App Router + CSS riêng — **`antd` / `@ant-design/*` chưa có** trong `apps/web/package.json` tại HEAD (quan sát).

### 2.3 Identity

- Realm có client `ticket-admin-web` (redirect `/api/admin/auth/callback`); O13 ghi gap mirror route — Architect reconcile với host `portal.` khi ADR.
- Provider: **Keycloak giữ**; không đổi IdP.

### 2.4 Invariant giữ nguyên

Tenant + RLS; authz Nest nguồn quyền; Redis ≠ SoT quota/check-in; BFF same-origin + CSRF allowlist; MFA admin theo PRD; không mock auth production path.

### 2.5 Parity cutover (bắt buộc)

Scope complete portal = **parity toàn bộ chức năng staff admin hiện có** trên surface chuyển (gồm CS, export, import, tickets, notifications, config/brand, staff invite, report, … theo inventory BA) **trước** cutover redirect. **Không** deferred CS/export làm mất tính năng. New feature ngoài parity = duyệt riêng (không nhét lén).

---

## 3. Nghiên cứu Ant Design (nguồn chính thức)

| Nguồn | URL | Ngày truy cập | Điểm rút |
| --- | --- | --- | --- |
| Ant Design — Next.js App Router | https://ant.design/docs/react/use-with-next/ | 2026-10-18 | `@ant-design/nextjs-registry` + `AntdRegistry`; tránh sub-component `.` trên RSC |
| nextjs-registry | https://github.com/ant-design/nextjs-registry | 2026-10-18 | Style registry |
| Ví dụ App Router | https://github.com/ant-design/ant-design-examples/tree/main/examples/with-nextjs-app-router-inline-style | 2026-10-18 | `"use client"` khi cần |
| npm `antd` metadata | https://registry.npmjs.org/antd/latest | 2026-10-18 | **Quan sát** version `6.6.6` tại ngày check — **không** auto-pin “latest” khi coding; coordinator chọn exact khi được ủy quyền install |
| npm `@ant-design/nextjs-registry` | https://registry.npmjs.org/@ant-design/nextjs-registry/latest | 2026-10-18 | **Quan sát** `1.3.0` cùng ngày — cùng quy tắc pin |
| Next.js App Router | https://nextjs.org/docs/app | 2026-10-18 | RSC vs client |

**Hệ quả (đề xuất kỹ thuật — Architect/coordinator giải trong scope):** portal antd-first; cô lập khỏi attendee CSS/bundle; lockfile chỉ coordinator khi ủy quyền.

---

## 4. Mô hình host (confirmed + biên còn mở)

```text
vemoki.com          → marketing / sales / legal (O13 giữ)
app.vemoki.com      → attendee + guest (+ Gate nếu gói §9 giữ)
portal.vemoki.com   → staff admin (antd)  [CONFIRMED]
auth.vemoki.com     → Keycloak (giữ)
api.vemoki.com      → Nest (giữ)
```

### 4.1 Biên Gate & Platform — đề xuất trong gói §9; không mặc định

| Surface | Khuyến nghị planner (đưa vào gói) | Option khác |
| --- | --- | --- |
| **Tenant Admin** | Chuyển hết sang `portal.` (parity đủ rồi cutover) | Dual dài hạn (không khuyến nghị) |
| **Web Gate** | **Giữ `app.`** (day-of) | Chuyển `portal.` / dual — user chọn trong gói |
| **Platform** | **Theo `portal.`** (cùng staff shell) | Giữ `app.` — user chọn trong gói |

Mọi option: authz server-side; cookie host-only; Origin/CSRF allowlist; **không** `Domain=.vemoki.com`.

### 4.2 Packaging — Architect khuyến nghị; coordinator giải trong scope

| | **P1 — `apps/portal`** | **P2 — host-aware `apps/web`** |
| --- | --- | --- |
| Ý tưởng | Next + antd riêng; nginx `portal.` | Middleware host tách layout |
| Pros | Isolate dep/CSS | Một image;reuse BFF |
| Cons | CI/lockfile/image | Rủi ro cross-host route/CSS |

**Không** đưa P1/P2 thành câu hỏi user rời — Architect ghi khuyến nghị + lý do trong ADR; coordinator chốt khi mở coding.

### 4.3 Session / OIDC — phân biệt IdP SSO vs BFF cookie

| Khái niệm | Quy tắc PORTAL |
| --- | --- |
| **Keycloak IdP SSO (hiện có)** | User có thể đã có SSO session IdP khi login OIDC clients — **được phép / không cấm** trong Epic này |
| **BFF session local** | Cookie session **riêng** per host (`portal.` vs `app.`); host-only; **không** share BFF cookie qua parent domain |
| **Enterprise SSO feature** (IdP riêng tenant, SAML… ) | Vẫn **out of scope** (PRD sau MVP) |

Hệ quả UX: staff mở portal có thể SSO lại qua IdP nhanh, nhưng **attendee `app.` không tự nhận BFF staff** và ngược lại — cần login BFF trên từng host (IdP có thể silent).

URI Keycloak / client `ticket-web` vs `ticket-admin-web`: Architect + coordinator trong scope ADR (không hỏi user từng URI).

### 4.4 Gate chứng minh tách host (HttpOnly — **không** `Document.cookie`)

Vì cookie BFF thường **HttpOnly**, JS `Document.cookie` **không** phải bằng chứng hợp lệ.

| Gate | Cách kiểm (khi có môi trường / UAT) |
| --- | --- |
| Set-Cookie | Response login portal: `Set-Cookie` **không** có `Domain=.vemoki.com` (Domain absent = host-only) |
| Browser request | Request tới `app.vemoki.com` **không** gửi cookie portal (và ngược lại) — DevTools Network / Playwright storage state tách origin |
| Login cross-host | Sau login portal, gọi BFF `app.` (cùng browser profile) → unauthenticated / challenge; sau login app, BFF portal tương tự |

---

## 5. Epic → Story → Task (ownership + Role ID)

> Issue GitHub **chưa tạo**. S0 discovery **đã điều phối** trong Run — bảng dưới phản ánh trạng thái + skeleton implementation. Role path: `docs/agents/roles/<id>.md`.

```text
Epic PORTAL
├── S0 Discovery / design / architecture     [ĐÃ ĐIỀU PHỐI — Run run_df32d5572a2d]
│   ├── T-BA / T-PD / T-ARCH / T-WEB-F / T-BE-G / T-SEC / T-PLAN
│   └── (không spawn lại; coordinator tổng hợp)
├── S1 Foundation portal                     [dep: gói §9 duyệt + ADR Architect]
│   ├── T-COORD-1 coordinator — env/nginx/realm khi ủy quyền
│   ├── T-WEB-1   web — scaffold portal + AntdRegistry + auth BFF
│   ├── T-BE-1    backend — chỉ khi ADR xác nhận cần (audience/client); không đoán gap
│   └── T-REV-*   reviewer-dod ± reviewer-security
├── S2 Migrate Tenant Admin → portal antd    [dep: S1 + PD/BA parity checklist]
│   ├── T-WEB-2   web — parity ĐỦ mọi chức năng admin hiện có (gồm CS, export, …)
│   ├── T-BE-2    backend — chỉ lệch contract đã xác nhận trong handoff BE (không bịa)
│   └── T-REV-WEB
├── S3 Platform trên portal (nếu gói §9 chọn chuyển)  [dep: S1; SAU T-WEB-2 nếu cùng web]
│   ├── T-WEB-3   web — /platform parity
│   └── T-REV
├── S4 Gate boundary (theo gói §9)           [dep: quyết định trong gói; không chặn S2 trừ user bắt]
│   ├── T-WEB-4a  giữ app.gate + link từ portal  HOẶC
│   └── T-WEB-4b  migrate gate (nếu gói chọn)
├── S5 Cutover                               [dep: parity S2 (+S3 nếu có) PASS]
│   ├── T-WEB-5   redirect/banner dual-run
│   ├── T-COORD-2 Keycloak URI contract + email deep link
│   └── T-REV
└── S6 Milestone gates                       [dep: S5]
    ├── T-UAT ∥ T-SEC-2 → T-DOD
```

### 5.1 Bảng Task

| ID | Story | Ownership | Role | Arch impact | Dep | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T-BA…T-PLAN | S0 | docs | theo Run | Có (ARCH) | — | Báo cáo đã/đang bàn giao; planner reconcile |
| T-COORD-1 | S1 | coordinator | — | Có | Gói §9 + ADR | Env/nginx/realm đúng ADR; không deploy mặc định |
| T-WEB-1 | S1 | web | `web` | Có | ADR packaging | Portal boot antd; login BFF; fail-closed guest |
| T-BE-1 | S1 | backend | `backend` | Nếu ADR yêu cầu | ADR | Chỉ việc ADR liệt kê; RLS/authz không regress |
| T-WEB-2 | S2 | web | `web` | UI | S1 | **Parity đầy đủ** admin hiện có — checklist BA; headless UAT |
| T-WEB-3 | S3 | web | `web` | Có nếu chuyển | S1; **sau** T-WEB-2 nếu một slice web | Platform parity |
| T-WEB-4* | S4 | web | `web` | Có | Gói Gate | Gate fail-closed; không phá iOS Gate |
| T-WEB-5 | S5 | web | `web` | Có | Parity S2(+S3) | Dual-run → contract; rollback §8 |
| T-COORD-2 | S5 | coordinator | — | Có | T-WEB-5 | URI + email link |
| T-UAT / T-SEC-2 / T-DOD | S6 | mixed | dod/security | — | S5 | Exact SHA `docs/reviews/*` |

**iOS:** không Task coding portal. **Cùng ownership web:** tối đa **một** feature coding Dispatch active (§6).

---

## 6. Wave bề rộng tối đa

### Wave R0 — Discovery

**Đã chạy** (7 worker). Việc còn lại: coordinator tổng hợp + planner file này (hiệu chỉnh). **Không** re-dispatch S0 trùng.

### Wave I1 — Foundation (sau duyệt gói §9 + ADR)

Song song ownership **khác**:

`T-COORD-1` ∥ `T-WEB-1` ∥ (`T-BE-1` nếu ADR yêu cầu) ∥ reviewers độc lập

### Wave I2 — Migrate UI (**không** song song hai web feature)

| Slot | Được |
| --- | --- |
| Web feature | **Một** active: trước `T-WEB-2` (admin parity); **sau** `worker_done`/settle mới `T-WEB-3` (platform nếu gói chọn) hoặc `T-WEB-4*` |
| Song song với web | BE contract đã xác nhận · coordinator docs/env · reviewer DoD/security · docs BA/PD update |

`T-WEB-4*` không chặn I2 trừ khi gói §9 bắt Gate cùng cutover.

### Wave I3 — Cutover + gates

`T-WEB-5` + `T-COORD-2` → `T-UAT` ∥ `T-SEC-2` → `T-DOD`.

---

## 7. AC kiểm chứng theo wave (skeleton)

### R0 (research — đang/đã bàn giao)

- [ ] Peer reports trong §0.1 đủ để coordinator tổng hợp (ARCH/SEC/WEB nếu còn thiếu thì chờ file — không bịa nội dung).
- [ ] BA: surface × persona × stay/move × AC parity (file BA).
- [ ] PD: shell antd + states (file PD).
- [ ] User nhận **một gói** §9 (không 9 câu rời).

### I1

- [ ] Host portal phản hồi shell (local Host header hoặc staging **khi** ủy quyền) — không bịa prod proof.
- [ ] Login portal: `Set-Cookie` Domain absent/host-only; request cross-host không mang cookie portal; login cross-host BFF fail-closed (§4.4).
- [ ] Regression attendee `app.` headless trên SHA.

### I2

- [ ] Checklist BA **100%** chức năng admin hiện có trên portal (CS, export, import, tickets, notifications, config/brand, staff, report, …) — UAT headless.
- [ ] Nếu S3 trong gói: platform parity sau khi T-WEB-2 xong (serial web).
- [ ] Unauthorized → forbidden; antd first-paint ổn định (registry).

### I3

- [ ] Dual-run rồi contract; rollback §8 khả thi.
- [ ] Keycloak URI sau contract phase khớp ADR.
- [ ] Milestone: headless UAT + review exact SHA + deploy chỉ nếu ủy quyền.

**Không** gắn ngày giả / story-point giả.

---

## 8. Migration không mất tính năng + rollback

### 8.1 Nguyên tắc

1. **Parity đầy đủ trước cutover** — gồm CS/export và mọi job admin đã ship; không cắt tính năng “làm sau”.
2. **Dual-run** `portal.` + `app./admin` đến khi AC PASS.
3. Redirect dần: banner → 302 kỳ hạn → 301.
4. Không xóa BFF admin trên `app.` trước portal ổn định.
5. BE chỉ làm gap **đã xác nhận** trong handoff/ADR — không đoán API mới.

### 8.2 Rollback

| Phase | Rollback |
| --- | --- |
| DNS/TLS | Gỡ `portal.`; giữ `app.` |
| OIDC URI expand | Giữ URI `app.` dual-run; gỡ portal nếu abort |
| UI cutover | Tắt redirect; nav `app./admin` |
| antd package | Revert image/app; attendee không phụ thuộc antd nếu P1 |

---

## 9. Gói đề xuất chờ user duyệt (một gói — sau roadmap)

**Đã confirmed (không hỏi lại):** `portal.vemoki.com` staff admin; UI **antd**.

### 9.1 Nội dung gói (duyệt / chỉnh một lần)

| Hạng mục | Đề xuất trong gói |
| --- | --- |
| Cập nhật O13 #2 | Admin (và Platform nếu chọn) chuyển dần sang `portal.`; `app.` = attendee (+ Gate nếu giữ) |
| Web Gate | **Giữ trên `app.`** |
| Platform | **Chuyển sang `portal.`** cùng staff shell |
| Parity | Cutover chỉ khi parity **toàn bộ** admin hiện có (gồm CS/export) |
| Session | BFF cookie tách host; Keycloak IdP SSO hiện có vẫn dùng; không mở enterprise SSO |
| Board | Epic tên **PORTAL** (không nhét D12/D13) |
| Coding | Ủy quyền I1 sau ADR Architect + gói này; vẫn PR/DoD; không tự deploy/store |
| Lịch vs D12/D13 | I1 sau khi WIP cho phép (discovery đã xong không cần chờ D13 submit) |

User có thể **chỉnh Gate/Platform/board name/lịch** trong cùng lần duyệt gói.

### 9.2 Kỹ thuật — Architect khuyến nghị; coordinator giải trong scope (không hỏi user rời)

- Packaging P1 vs P2; nginx/TLS/env names; Keycloak client/redirect/webOrigins chi tiết.
- Cookie names, CSRF allowlist, BFF route layout.
- Có cần `T-BE-1` / thay đổi audience không — chỉ theo ADR + evidence BE handoff.
- Pin version `antd` / registry: exact tại lúc install (quan sát §3 chỉ là snapshot ngày check).

---

## 10. Security & UAT gates (Epic)

| Gate | Yêu cầu |
| --- | --- |
| Authz | Nest + RLS; UI capability chỉ chrome |
| Cookie | Host-only; cấm parent Domain; chứng minh §4.4 |
| CSRF / Origin | Allowlist `https://portal.vemoki.com`; không tin `X-Forwarded-*` thô |
| IdP vs BFF | Không cấm IdP SSO hiện có; cấm share BFF cookie cross-host |
| Reviewer | Security-sensitive: session ≠ implementer; exact SHA |
| UAT | Headless portal + regression attendee |
| Deploy | Chỉ khi ủy quyền |
| Non-goals | Android/payment/refund/transfer/seat/Wallet/enterprise-SSO/billing/custom-domain |

---

## 11. Việc coordinator làm (planner không làm)

1. Tổng hợp peer reports §0.1 (kể cả file còn về sau) → DECISION-LOG khi user duyệt gói §9.
2. Đưa **một gói** §9 cho user — không 9 câu approval rời.
3. Mở Epic/Story/Task Project #3 khi được phép; **không** gắn #293/#301.
4. **Không** spawn lại S0; mở I1 chỉ sau gói + ADR + WIP.
5. Wave I2: một web feature active; BE/coord/reviewer/docs được song song.
6. Không đụng dirty `apps/mobile` / `infra` ngoài task; lockfile chỉ coordinator.

---

## 12. Liên kết

| Tài liệu | Vai trò |
| --- | --- |
| [PORTAL-RESEARCH-RUN.md](./PORTAL-RESEARCH-RUN.md) | Nhật ký 7 worker discovery |
| [PORTAL-PRODUCT-RESEARCH.md](./PORTAL-PRODUCT-RESEARCH.md) | BA |
| [PORTAL-ANTD-UX.md](../design/PORTAL-ANTD-UX.md) | PD |
| [PORTAL-BACKEND-GAPS.md](./PORTAL-BACKEND-GAPS.md) | BE peer (đối chiếu — không đoán thêm) |
| [ROADMAP.md](../ROADMAP.md) | Phạm vi đợt; Status = Project |
| [DECISION-LOG O13](../DECISION-LOG.md) | Host marketing/app baseline |
| [o13-marketing-app-subdomain.md](../architecture/o13-marketing-app-subdomain.md) | Cookie/OIDC/nginx |
| [PRD.md](../PRD.md) | M11/M12; non-goals |
| [agents/README.md](../agents/README.md) | Role catalog |

---

## 13. Kết luận khuyến nghị

1. **`portal.vemoki.com` + antd đã confirmed**; research wave đã chạy — bước tiếp là **tổng hợp + duyệt một gói §9**, không spawn S0 lại.
2. **Implementation chưa sẵn** đến khi gói + ADR + ủy quyền coding.
3. **Gate/Platform** nằm trong gói đề xuất (khuyến nghị: Gate=`app.`, Platform=`portal.`); kỹ thuật packaging/OIDC do Architect/coordinator.
4. **I2:** một web coding active — admin parity (đủ CS/export) rồi mới platform/gate web task.
5. **D12/D13 khác scope**; chứng minh session bằng Set-Cookie/host requests/login cross-host — không `Document.cookie`.
