# PORTAL P2 — BA discovery (analytics / views / EN / roles / onboarding)

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này (`docs/plans/PORTAL-P2-BA.md`) — **không** sửa `apps/**` |
| Ngày soạn | 2026-10-19 |
| Parent | Story [#493](https://github.com/hangndat/ticket-solution/issues/493) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) · Issue [#499](https://github.com/hangndat/ticket-solution/issues/499) |
| Ủy quyền | Gói **B** Epic #491 (user A+B+C, 19/10/2026) — **discovery BA**; coding P2 chỉ sau BA∥PD∥architect chốt |
| Run | `run_d04055a8969b` |
| Ngôn ngữ | Tiếng Việt (giữ ID, API, command, SHA nguyên bản) |
| Trạng thái | **Đề xuất + ưu tiên đã xếp** — không tự Hoàn thành Issue; không claim pilot ready |
| Architecture impact | **Có** (multi-event reopen O12/O14 · RBAC · onboarding tenant) — ADR: [#501](https://github.com/hangndat/ticket-solution/issues/501) → `docs/architecture/PORTAL-P2-ADR.md` |
| PD song song | [#500](https://github.com/hangndat/ticket-solution/issues/500) → `docs/design/PORTAL-P2-UX.md` |
| Cutover prod | **Không** trong P2; chỉ [#502](https://github.com/hangndat/ticket-solution/issues/502) |

### Ranh giới tuyên bố

| Được | Không được |
| --- | --- |
| Chốt JTBD / AC / priority / in-out cho 5 capability P2 | Coding `apps/**`; mock auth/UAT; EAS Cloud Build |
| Mở lại **đề xuất sản phẩm** multi-event (OUT O12 §5 / O14 #6) trong phạm vi Epic #491 Gói B | Deploy DNS/TLS `portal.vemoki.com` (Gói C / #502) |
| Map ownership BE / web / coordinator / architect | Spawn worker con; tự merge/Hoàn thành |
| Given/When/Then kiểm chứng được + evidence lệnh | Invent revenue/UTM/CRM BI; đổi SoT quota/check-in/RLS |

---

## 1. Problem / outcome

### 1.1 Bối cảnh (quan sát docs)

- Portal P0+P1 (#406) đã được duyệt làm admin chuyên nghiệp trên `portal.vemoki.com` + AntD; event report O12 **event-scoped** đã có dictionary + consumer theo O14.
- Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) ủy quyền **Gói B — P2 sản phẩm**: multi-event analytics (mở lại OUT O12/O14), saved views/automation, portal EN, custom roles / self-serve onboarding — **discovery rồi coding**.
- [`PORTAL-ROADMAP.md`](./PORTAL-ROADMAP.md) §4 ghi P2 là backlog cần duyệt riêng; file này là artifact duyệt phạm vi đó.
- O12 #5 / O14 #6 từng **giữ OUT** multi-event / metrics product — Epic #491 **mở lại discovery** (không tự đổi DECISION-LOG; architect #501 ghi ADR khi chốt contract).

### 1.2 Pain → outcome (persona PRD §3)

| Persona | Pain trong phạm vi P2 | Outcome mong muốn |
| --- | --- | --- |
| **Tenant Owner** (agency / nhiều event) | Phải mở từng event để biết readiness / pending / check-in; không có “portfolio” | Một màn org-scoped: aggregate **counts** theo dictionary O12, fail-closed per event |
| **Event Manager** | Lặp lại filter/sort trên list guest/pending/CS mỗi ca | Lưu **saved view** (filter + cột cho phép) và mở lại trong ≤2 click |
| **Staff EN-preferring** | Portal AntD P0/P1 mặc định VI — khó onboard đối tác quốc tế | Locale **EN** đầy đủ shell + job chính (parity string) |
| **Owner / Operator** | Role cố định 5 vai (PLATFORM-POLICY) — không map “CS kiêm Supervisor hẹp” | **Custom role** = tập permission allowlist đã có — không invent perm mới mù |
| **Owner mới / lead** | Onboarding org phụ thuộc Operator tạo tenant thủ công | Self-serve: form quan tâm → tenant DRAFT/ACTIVE có limits mặc định + invite Owner đầu |

**Outcome nghiên cứu này:** đủ JTBD + AC + priority để planner tách Story/Task coding; PD #500 và architect #501 chạy song song trên cùng scope.

---

## 2. In / out of scope

### 2.1 IN — Gói B P2 (đề xuất coding sau discovery)

| ID | Capability | Ghi chú ranh giới |
| --- | --- | --- |
| **P2-A** | Multi-event analytics (Owner portfolio) | Aggregate **counts only**; reuse dictionary O12; `asOf`/watermark; **không** PII; **không** revenue/UTM |
| **P2-B** | Saved views (+ automation nhẹ) | Lưu filter/sort/cột trên list đã có (pending, guests/codes, CS, members); automation = optional notify khi count vượt ngưỡng **đã có** (pending / emailNeedsCs) — không workflow builder |
| **P2-C** | Portal locale EN | `antd` + copy portal VI∥EN; mặc định theo user/org preference; không bắt attendee app đổi locale trong Task này |
| **P2-D** | Custom roles | Composer trên **permission catalog hiện có** (`docs/ops/PLATFORM-POLICY.md`); gán per tenant + event assignment như membership hiện tại |
| **P2-E** | Self-serve onboarding | Lead → tạo tenant + Owner đầu + checklist J1 (invite + event DRAFT); Operator vẫn suspend/limits |

### 2.2 OUT / REJECT (giữ O10 / O07 / O14 non-goals)

| Out | Lý do |
| --- | --- |
| Android native / payment / refund / transfer / seat / Wallet / RFID | O10 |
| Enterprise SSO / billing tự động / custom-domain / sender riêng | PRD sau MVP / O07 |
| Validate-only Gate desk / resolution desk mở rộng | O14 #6 trừ user mở riêng |
| Marketing pixel / funnel SaaS / CRM sync / revenue BI | O12 reject |
| Cutover DNS/TLS dual-run production | Gói C · Issue #502 |
| Đổi RLS / Redis SoT quota·check-in | Invariant nền tảng |
| Mock auth để “pass” UAT | AGENTS.md |

### 2.3 Phụ thuộc cứng trước coding P2

1. **BA (file này)** + **PD** (`PORTAL-P2-UX.md`) + **Architect** (`PORTAL-P2-ADR.md`) — artifact trên disk; coordinator ghi quyết định tiếp nối O12/O14 nếu cần.
2. Portal P0 shell / authz baseline đã merge (Epic #406) — P2 gắn trên portal, không fork admin legacy.
3. Hardening Gói A (#492…) **không** block discovery; coding P2 có thể song song slice khác ownership nếu WIP cho phép.

---

## 3. JTBD ưu tiên

Mỗi job: **Khi** … **muốn** … **để** …

| ID | Persona | JTBD | Priority | Horizon |
| --- | --- | --- | --- | --- |
| **J-P2-1** | Owner | Khi quản lý ≥2 event ACTIVE/DRAFT, muốn thấy bảng tóm tắt readiness/pending/check-in/emailNeedsCs **theo event** trên một trang org | **P0** | Multi-event A |
| **J-P2-2** | Manager | Khi xử lý pending/CS lặp filter, muốn lưu & đặt tên view để mở lại đúng cột/filter | **P0** | Saved views B |
| **J-P2-3** | Manager | Khi pending hoặc emailNeedsCs vượt ngưỡng đã đặt, muốn nhận tín hiệu in-app (và email nếu đã có channel staff) | **P1** | Automation B |
| **J-P2-4** | Owner/Manager EN | Khi làm việc bằng tiếng Anh, muốn toàn bộ nav + form portal sang EN không mất quyền/context | **P0** | Locale C |
| **J-P2-5** | Owner | Khi cần vai “CS + report.read hẹp”, muốn tạo custom role từ permission có sẵn và invite user | **P1** | Custom roles D |
| **J-P2-6** | Lead / Owner mới | Khi đăng ký quan tâm, muốn tự tạo org và được dẫn checklist event đầu mà không chờ ticket Operator | **P1** | Onboarding E |
| **J-P2-7** | Operator | Khi có self-serve tenant, muốn thấy hàng đợi tenant mới + chỉnh limits/suspend như hôm nay | **P1** | Onboarding E |

**Thứ tự đề xuất coding (sau ADR/PD):**

```text
Wave P2.0  architect ADR (#501) ∥ PD IA (#500) — artifact (đang chạy)
Wave P2.1  BE multi-event summary contract + tests isolation
           ∥ web portfolio table (consume) + EN i18n shell
Wave P2.2  web saved views (local→server) ∥ BE persist views nếu ADR chọn server
Wave P2.3  custom roles (BE permission sets + web composer) — sau catalog ADR
Wave P2.4  self-serve onboarding (BE tenant create path + web wizard)
           automation thresholds (P1) có thể ∥ P2.2 nếu capacity
```

Không serialize BA→PD→architect khi artifact độc lập; **contract multi-event + RBAC** là hard-dep trước consumer web tương ứng.

---

## 4. Acceptance criteria (Given / When / Then)

### 4.1 P2-A — Multi-event analytics

**AC-A1 — Portfolio list**

- **Given** Owner có `report.read` (hoặc rule assignment ADR chốt) trên ≥2 event cùng tenant,  
- **When** mở `/org/{slug}/analytics` (path PD chốt),  
- **Then** thấy bảng mỗi hàng = một event: KPI allowlist O12 (`pendingApprovalCount`, check-in success, reject aggregate, `quotaRemaining`/`quotaCapacityState`, `emailNeedsCsCount`) + `asOf`; **không** cột PII / mã / email khách.

**AC-A2 — Fail-closed từng event**

- **Given** Owner thiếu perm trên event B,  
- **When** tải portfolio,  
- **Then** event B hiện trạng `rejected`/`hidden` theo ADR — **không** lộ count; không fail toàn trang nếu event A OK.

**AC-A3 — Cross-tenant**

- **Given** session tenant T1,  
- **When** gọi summary với tenantId T2,  
- **Then** not found / denied — RLS + membership (test isolation DB).

**AC-A4 — Dictionary**

- **Given** O12,  
- **When** render check-in trên portfolio,  
- **Then** = tổng lượt Gate confirm thành công **per event** (không invent “attended”); refresh thủ công pilot trừ khi ADR mở poll có budget.

**AC-A5 — Không phá event Dashboard**

- **Given** Manager trên một event,  
- **When** dùng Dashboard event-scoped hiện có,  
- **Then** hành vi O12/O14 giữ nguyên; portfolio là **bề mặt thêm**, không thay `#229` readiness AC.

**BE tối thiểu đề xuất (cho architect #501 chốt):**  
`GET /tenants/{t}/events/report-summary?cursor&limit` — counts only; perm theo ADR (`report.read` ∩ assignment **hoặc** Owner org-wide read — **cấm** đoán trên client).

### 4.2 P2-B — Saved views (+ automation)

**AC-B1 — Save / restore**

- **Given** Manager trên list pending (hoặc CS / codes theo PD),  
- **When** đặt filter+cột và “Lưu view” với tên,  
- **Then** view xuất hiện trong menu; chọn lại khôi phục đúng query allowlist (không lưu raw PII filter nguy hiểm — ADR).

**AC-B2 — Isolation**

- **Given** view của user U1,  
- **When** U2 cùng tenant mở list,  
- **Then** không thấy view private của U1 trừ khi ADR cho phép “shared org views” (mặc định **private** P0).

**AC-B3 — Automation P1**

- **Given** ngưỡng `pendingApprovalCount >= N` trên event,  
- **When** report refresh cho `asOf` mới vượt ngưỡng,  
- **Then** tạo in-app notification staff (reuse channel có sẵn nếu có); **không** auto-approve / auto-resend.

### 4.3 P2-C — EN portal

**AC-C1 — Locale switch**

- **Given** user staff trên portal,  
- **When** chọn English,  
- **Then** AntD locale + chuỗi nav/job P0/P1 đã migrate hiển thị EN; reload giữ preference (user hoặc org default — ADR).

**AC-C2 — Parity**

- **Given** checklist string P0 (shell, events, setup, pending, CS, report, members, platform zone nếu có),  
- **When** quét i18n,  
- **Then** không còn hard-code VI trên path đã đánh dấu EN-ready; thiếu key → fallback rõ (không blank).

**AC-C3 — Attendee / Gate**

- **Given** attendee trên `app.` hoặc Gate device,  
- **When** P2-C ship,  
- **Then** **không** bắt buộc đổi locale attendee trong cùng Story (out trừ Task riêng).

### 4.4 P2-D — Custom roles

**AC-D1 — Composer**

- **Given** Owner,  
- **When** tạo role “CS+Report” từ checkbox permission **đã có trong catalog**,  
- **Then** lưu được; invite user với role đó; user chỉ thấy nav/BFF khớp perm (deny-by-default).

**AC-D2 — Không invent perm**

- **Given** UI composer,  
- **When** không có perm `inventory.read` / `audit.read` mới trong catalog,  
- **Then** không hiện / không tạo được (khớp ADR-20 H-C1/H-A1 đã chối perm mới).

**AC-D3 — Built-in roles**

- **Given** Owner/Manager/CS/Supervisor/Scanner hệ thống,  
- **When** custom roles bật,  
- **Then** built-in vẫn hoạt động; không bắt migrate membership cũ trong P0 custom-roles.

**AC-D4 — Security**

- **Given** custom role thiếu `gate.confirm`,  
- **When** gọi Gate confirm API,  
- **Then** denied; reviewer-security bắt buộc trên PR RBAC.

### 4.5 P2-E — Self-serve onboarding

**AC-E1 — Happy path**

- **Given** lead chưa có tenant,  
- **When** hoàn thành form self-serve (PD),  
- **Then** tạo tenant + membership Owner + limits mặc định (Operator policy); redirect checklist J1 (invite staff + event DRAFT).

**AC-E2 — Abuse / quota**

- **Given** rate limit / captcha / email verified (ADR),  
- **When** spam tạo org,  
- **Then** bị chặn; không tạo tenant ACTIVE vượt policy.

**AC-E3 — Operator**

- **Given** Operator,  
- **When** mở hàng đợi tenant mới,  
- **Then** adjust limits / suspend như PLATFORM-POLICY; self-serve **không** bypass suspend.

**AC-E4 — Non-goal path**

- **Given** billing/SSO,  
- **When** onboarding P2,  
- **Then** không yêu cầu thanh toán hay IdP doanh nghiệp.

---

## 5. Ma trận Story / Task gợi ý (cho Epic planner)

| Story | Task gợi ý | Ownership | Dep |
| --- | --- | --- | --- |
| S-P2-Analytics | Contract + OpenAPI `report-summary` + isolation tests | backend | ADR #501 |
| S-P2-Analytics | Portfolio AntD table + deep-link → event Dashboard | web | contract + PD #500 |
| S-P2-Views | Persist saved views (user-scoped) | backend hoặc web-local→BE | ADR storage |
| S-P2-Views | UI save/load trên ProTable lists | web | PD |
| S-P2-i18n | Message catalogs VI/EN + locale provider portal | web | PD copy |
| S-P2-Roles | Permission-set entity + assign membership | backend | ADR RBAC |
| S-P2-Roles | Role composer UI | web | BE + PD |
| S-P2-Onboard | Public/authenticated signup → tenant create | backend + web | ADR abuse |
| S-P2-Onboard | Operator queue polish | web | Platform zone P1 |
| S-P2-* | DoD + security review exact SHA | reviewer-dod ± reviewer-security | sau PR |

Coordinator: một feature coding / slice; nhiều reviewer song song khi `Chờ duyệt`.

---

## 6. Dependencies & handoff

| Artifact / Issue | Vai trò |
| --- | --- |
| [#499](https://github.com/hangndat/ticket-solution/issues/499) / **file này** | JTBD · AC · priority · in/out |
| [#500](https://github.com/hangndat/ticket-solution/issues/500) `PORTAL-P2-UX.md` | IA, wireframe AntD, empty/error, EN string zones |
| [#501](https://github.com/hangndat/ticket-solution/issues/501) `PORTAL-P2-ADR.md` | Reopen O12/O14 multi-event; perm rule; view storage; onboarding abuse; OpenAPI boundaries |
| [#502](https://github.com/hangndat/ticket-solution/issues/502) | Cutover prod — **ngoài** P2 coding |
| O12 / O14 · [`DECISION-LOG`](../DECISION-LOG.md) | Dictionary KPI; OUT lịch sử — P2 **mở đề xuất** qua Epic #491 |
| [`PORTAL-BACKEND-GAPS` §6](./PORTAL-BACKEND-GAPS.md) | Gợi ý BE multi-event sẵn |
| [`PLATFORM-POLICY`](../ops/PLATFORM-POLICY.md) | Catalog role/perm built-in |
| [`PORTAL-PRODUCT-RESEARCH` §11 Wave 3](./PORTAL-PRODUCT-RESEARCH.md) | P2 đã liệt kê — file này cụ thể hóa AC |

**Handoff BA → planner:** dùng §3 priority + §5 Story; không spawn coding từ BA session.

---

## 7. Success evidence (không chỉ “shipped”)

| Gate | Evidence tối thiểu |
| --- | --- |
| Discovery DoD (#499) | PR merge `docs/plans/PORTAL-P2-BA.md`; reviewer exact SHA; Project → Hoàn thành sau DoD |
| Trước coding P2 | Tồn tại `PORTAL-P2-UX.md` + `PORTAL-P2-ADR.md`; coordinator comment Epic #491 “P2 scope chốt” |
| Multi-event | Test isolation cross-tenant + missing-perm; UAT headless: login Owner → portfolio → mở 1 event Dashboard |
| Saved views | UAT: save → reload → filter khớp; user khác không thấy private view |
| EN | Snapshot/checklist i18n; headless locale=en nav readable |
| Custom roles | Matrix test: custom perm ⊆ catalog; Gate/API deny thiếu perm |
| Onboarding | UAT headless signup → tenant → checklist; rate-limit test; Operator suspend |
| Non-goals | Diff không chứa payment/SSO/Android/Wallet; không EAS |

Headless only: `scripts/web-uat.sh` / Playwright — **không** cliclick / Computer Use trên Chrome người dùng.

---

## 8. Rủi ro & câu hỏi còn lại (cho user / architect)

| # | Rủi ro / câu hỏi | Đề xuất mặc định BA | Ai chốt |
| --- | --- | --- | --- |
| Q1 | Owner org-wide `report.read` vs chỉ event assignment? | **Fail-closed theo assignment**; Owner có org overview chỉ events mình là Owner/assigned — ADR có thể mở Owner-all-events | architect + user |
| Q2 | Saved views: chỉ client hay server? | P0 **server user-scoped** nếu multi-device; localStorage chỉ spike | architect |
| Q3 | Custom roles có sửa built-in không? | **Không** — chỉ thêm set; built-in immutable | BA (đề xuất) |
| Q4 | Self-serve tạo ACTIVE ngay hay PENDING Operator? | **ACTIVE + limits thấp** + Operator queue quan sát; suspend sẵn | user nếu lệch |
| Q5 | Automation email có tính spam? | P1 in-app trước; email chỉ nếu staff notification channel đã có | PD + BA |
| Q6 | Có cần sửa văn bản O12/O14 trên DECISION-LOG? | Có — entry mới “O15 / Portal P2” do coordinator sau ADR | coordinator |

---

## 9. Non-goals (nhắc lại điều hành)

- Không cutover production (#502).
- Không mock auth/UAT; không EAS.
- Không mở revenue BI / SSO / billing / custom-domain.
- Không đổi dictionary O12 (chỉ **mở rộng bề mặt** multi-event trên cùng định nghĩa).
- Research này **≠** code complete **≠** acceptance complete **≠** pilot ready.

---

## 10. Kết luận điều hành

1. **Epic #491 Gói B** đủ để **mở discovery + xếp priority** năm capability P2; coding chờ PD∥ADR.
2. **P0 coding đề xuất:** multi-event portfolio (A) + saved views private (B) + EN shell (C).  
   **P1:** automation (B), custom roles (D), self-serve onboarding (E).
3. Multi-event = **reopen có kiểm soát** OUT O12/O14: counts-only, fail-closed, dictionary O12 — không BI marketing.
4. Custom roles = **permission sets trên catalog hiện có**, không invent `*.read` mới đã bị ADR-20 từ chối.
5. Self-serve onboarding phục vụ J1 Owner — Operator giữ limits/suspend; không billing.

---

## 11. Checklist nghiệm thu Task #499 (docs)

- [x] Problem / outcome theo persona PRD §3
- [x] In / out khớp Epic #491 + O10/O12/O14
- [x] JTBD + priority P0/P1
- [x] AC Given/When/Then cho A–E
- [x] Dependencies PD #500 / Architect #501 / Cutover #502
- [x] Success evidence + non-goals
- [x] Architecture impact: Có (ghi rõ)
- [x] Không sửa `apps/**`
