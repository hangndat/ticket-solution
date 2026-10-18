# Portal admin — Backend gaps & contract handoff

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-18 |
| Role | `backend` · [docs/agents/roles/backend.md](../agents/roles/backend.md) |
| Mode | Discovery / audit read-only — **không** code tính năng, **không** sửa OpenAPI/contracts/root |
| Architecture impact | **Có** — subdomain/session/UI migration (`portal.vemoki.com`) + đóng gap API list/search |
| Ownership duy nhất | File này (`docs/plans/PORTAL-BACKEND-GAPS.md`) |
| Source HEAD (lúc bắt đầu Task) | `400ad87a1401972476c79f17c4fd726ca7538063` |
| OpenAPI audit | `apps/api/openapi.json` title *Ticket API — D4 CS/export/events* **v0.4.0** (61 paths) |
| Non-goals | Feature code · commit/push/PR · GitHub board · deploy/DNS · cài package · spawn worker · đụng `apps/mobile` / `infra` dirty của Run khác · mở Android/payment/refund/transfer/seat/Wallet/SSO/billing/custom-domain |

> **Kết luận ngắn:** API Nest hiện đủ **mutate + vài list cursor event-scoped** (events, pending redemptions, CS tickets, notifications, config-versions, report snapshot) để vận hành MVP trên cùng host product. **Portal chuyên nghiệp Ant Design không được bịa API tùy ý** — phần lớn “thiếu list/search” đã có **contract/BFF kỳ vọng** (`packages/contracts`, `apps/web` BFF) nhưng **chưa có trong OpenAPI/controller**. `portal.vemoki.com` và **dashboard multi-event** là **đề xuất cần Gate/user duyệt**; không mặc định chuyển quyền từ O13 (`app.` chứa admin) hay O12/O14 (multi-event OUT).

---

## 1. Phạm vi & phương pháp

### 1.1 Đã đọc

- `AGENTS.md`, [PRD](../PRD.md), [TECHNICAL-DESIGN](../TECHNICAL-DESIGN.md) §10 API, [DECISION-LOG](../DECISION-LOG.md) O12/O13/O14, [ROADMAP](../ROADMAP.md)
- Policy: [PLATFORM-POLICY](../ops/PLATFORM-POLICY.md); host GTM: [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](./VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md); Dashboard OUT: [DASHBOARD-MARKET-SYNTHESIS](./DASHBOARD-MARKET-SYNTHESIS.md)
- O02 nav: [docs/design/o02-permission-nav/contract.md](../design/o02-permission-nav/contract.md)
- Source: `apps/api/src/*`, `apps/api/openapi.json`, `packages/backend/src/*` (membership, inventory, approval/redemption-status, reporting, cs, export, audit writers), `packages/contracts/src/import-invite.ts` + redemption forms, `apps/web/app/api/bff/**` + `apps/web/src/platform/contracts.ts` + `apps/web/src/admin/*` (**chỉ đọc** — ownership web không sửa)

### 1.2 Limitation / evidence

| Mục | Ghi chú |
| --- | --- |
| CRG | `list_graph_stats_tool` OK (~3888 nodes); `head_matches_build` trên SHA graph `141dba74…` — **lệch** worktree HEAD `400ad87a…`. Node path trong graph trỏ `/Users/admin/SideProject/ticket-solution/…` — dùng để tìm symbol; **source thắng** khi lệch. Embeddings = 0 → FTS/keyword, không semantic vector. |
| lean-ctx | `ctx_compose` / `ctx_read` dùng cho hotspot. |
| Runtime | **Không** chạy API/UAT/deploy. Không bịa proof SMTP/MinIO/prod. |
| OpenAPI vs code | Controllers trong `apps/api/src` khớp các path OpenAPI đã liệt kê; **BFF + `packages/contracts` đã vượt** OpenAPI (xem §3). |

### 1.3 Nguồn chính thức bên ngoài (URL + ngày truy cập)

| Chủ đề | URL | HTTP (HEAD/GET) | Ngày |
| --- | --- | --- | --- |
| Ant Design — Introduce (React UI library `antd`) | https://ant.design/docs/react/introduce | 301 → docs | 2026-10-18 |
| Ant Design — Components overview | https://ant.design/components/overview | 301 | 2026-10-18 |
| PostgreSQL RLS | https://www.postgresql.org/docs/current/ddl-rowsecurity.html | 200 | 2026-10-18 |
| NestJS OpenAPI | https://docs.nestjs.com/openapi/introduction | 200 | 2026-10-18 |

UI Ant Design = **consumer web** (Task khác). File này chỉ nêu **hệ quả contract/session** khi tách portal.

---

## 2. Host / session / Gate boundary (đề xuất — chưa chốt)

### 2.1 Hiện trạng đã chốt (O13)

| Host | Vai trò O13 |
| --- | --- |
| `vemoki.com` | Marketing / GTM |
| `app.vemoki.com` | **Product** — auth, **admin**, redeem, gate, guest event |

Nguồn: DECISION-LOG **O13**; [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH §8](./VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md).

### 2.2 Đề xuất Run này (chưa = quyết định)

| Host | Vai trò đề xuất |
| --- | --- |
| `vemoki.com` | Marketing (giữ O13) |
| `app.vemoki.com` | Attendee / guest product (redeem, vé, public event) |
| `portal.vemoki.com` | Staff admin (Ant Design) |

**Gate bắt buộc trước coding/deploy DNS:**

1. User/coordinator **chốt** tách admin khỏi `app.` hay giữ O13 (admin trên `app.`).
2. Task **architect**: cookie/`PUBLIC_WEB_ORIGIN`/CORS/Keycloak redirect URI/BFF origin allowlist — **không** coi subdomain là bằng chứng quyền (TD: subdomain ≠ authz).
3. **Session boundary:** cookie portal vs attendee — SameSite/Domain; staff MFA audience (`ticket-platform-api` vs attendee) giữ fail-closed như hiện tại.
4. **Gate surface:** màn Gate day-of ở `app.` (kiosk) hay `portal.`? Đề xuất mặc định nghiên cứu: **Gate giữ trên product/kiosk host**; portal = setup/CS/report — **cần chốt**, không mặc định chuyển.
5. Platform operator console: cùng `portal.` path `/platform` hay host riêng — **mở**, không tự cấp.

**Không** mặc định chuyển quyền O13; không deploy/DNS trong Task này.

---

## 3. Bản đồ capability: có trên API vs thiếu / lệch contract

Ký hiệu: **API** = có trong `openapi.json` + controller · **BE** = logic `packages/backend` · **BFF** = `apps/web` forward · **CTR** = khai báo `packages/contracts` · **UX** = chỉ UI.

### 3.1 Đã có (đủ cho MVP admin hiện tại)

| Capability | Endpoint (prefix `/v1`) | List/search/filter/cursor | Quyền (server) | Ghi chú |
| --- | --- | --- | --- | --- |
| Discovery staff | `GET /me/tenants`, `GET /me/events` | — | Membership / assignment | O02 chrome |
| Events | `GET/POST …/events`, `GET/PATCH …/{eventId}`, archive/cancel/clone | **cursor+limit** list | `event.list` / create / mutate | |
| Ticket types / sources | `POST …/ticket-types`, `POST …/sources` | **Không list** | event admin | Tạo có; browse thiếu → §3.2 |
| Quota | `GET …/quota` | snapshot | `inventory.import` path | |
| Import codes (đồng bộ) | `POST …/imports` | body raw codes ≤500 | `inventory.import` | **Khác** CTR multi-step job |
| Pending redemptions | `GET …/redemptions?status=PENDING_REVIEW&cursor&limit` | cursor; **chỉ** PENDING_REVIEW | `redemption.approve` | Email **masked**; không filter source/type/q |
| Approve / deny | `POST …/redemptions/{id}/approve\|deny` | — | + Idempotency-Key | |
| CS tickets | `GET …/tickets?q&cursor&limit` | q=uuid\|email\|code; limit≤50 | `cs.lookup` | Detail + resend |
| Event report | `GET …/report` | aggregate O12 | `report.read` | Counts + `asOf`; **không** PII |
| Notifications | `GET …/notifications?cursor` | cursor only | notify perms | Retry riêng |
| Config versions | list/preview/publish/rollback + assets | cursor list versions | publish/config | |
| Exports | create / status / download | filter trên create body | `export.*` | Async + MinIO |
| Branding tenant | GET/PUT branding | — | tenant.profile-ish | |
| Membership invite **create** | `POST …/invites` | — | `members.manage` | |
| Membership **revoke** | `POST …/members/{id}/revoke` | — | `members.manage` + last-Owner | |
| Platform tenant | create / get / status / limits | **Không list** OpenAPI | operator | BFF kỳ vọng GET list |
| Support grant | create + tickets under grant | — | operator + MFA | Audit mỗi read |
| Gate | sessions / reserve / confirm / undo / offline-sync / revoke | — | Scanner/Supervisor | Day-of; không gộp portal mặc định |
| Public events | `GET /public/…` | cursor | published only | Attendee host |

### 3.2 Lệch BFF/CTR ↔ API (ưu tiên đóng trước “portal đẹp”)

Đây **không** phải invent API mới tùy ý — consumer/web + contracts **đã** mô tả; Nest OpenAPI **thiếu**.

| Gap | BFF / CTR kỳ vọng | OpenAPI / controller | Phân loại | Dep |
| --- | --- | --- | --- | --- |
| **G-M1** List members | `GET /tenants/{t}/members` (BFF + `PLATFORM_PATHS`) | **Không** | API extension | role-map + RLS; pagination |
| **G-M2** List membership invites | `GET …/invites` | Chỉ `POST` | API extension | mask email; state filter |
| **G-M3** Change role / event-assignment | `…/members/{id}/role`, `…/event-assignments/{eventId}` | **Không** | API extension | deny-by-default; last-Owner |
| **G-M4** Invite revoke/resend (membership) | BFF `…/invites/{id}/revoke\|resend` | **Không** (revoke member ≠ revoke invite) | API extension | rate-limit resend |
| **G-P1** Platform tenants list | `GET /platform/tenants` BFF | Chỉ `POST` + `GET /{id}` | API extension | operator + cursor |
| **G-P2** Tenant health / support revoke | `PLATFORM_PATHS` health + grant revoke | Một phần thiếu OpenAPI | API extension | ops |
| **G-I1** Import job lifecycle | CTR `IMPORT_ENDPOINTS`: get/preview/commit/errors + BFF `/admin/imports/*` | Chỉ `POST …/imports` sync codes | API extension **hoặc** cắt BFF về sync | MinIO upload; worker; quota |
| **G-I2** Guest invitations list/dispatch | CTR `listInvitations` + dispatch(-preview) + BFF `/admin/invitations` | **Không** path nào | API extension | privacy: không raw email/token trong list |
| **G-I3** Invitation claim | CTR `POST …/invitations/claim` | **Không** | API extension | attendee path — có thể `app.` |
| **G-C1** List/search redemption **codes** | UI portal cần browse inventory | Chỉ import + quota | API extension | **không** trả raw code; mask/HMAC lookup như CS |
| **G-A1** Staff audit log browser | `audit_logs` / `platform_audit_logs` **write** nhiều nơi | **Không** GET list staff | API extension / business | retention O06; filter action/from/to; no PII leak |
| **G-R1** Pending filter nâng cao | — | Chỉ status cố định + cursor | API extension nhỏ | q/sourceId/ticketTypeId optional |
| **G-R2** BFF list pending | Approve/deny BFF có; **không** thấy list route đối xứng | API list đã có | **UX / BFF wire** | forward GET đã có |
| **G-T1** List ticket-types / sources | — | Chỉ POST | API extension nhỏ | event-scoped |
| **G-N1** Notification filter | — | cursor only | API extension nhỏ | state/channel |
| **G-E1** Exports history list | — | get by id only | API extension nhỏ | |
| **G-D1** Dashboard multi-event Owner | PRD §5 “Đầy đủ” | Event report **một** event | **New business proposal** | O12/O14 **OUT** — cần duyệt lại (§6) |

### 3.3 UX-only (không cần API mới)

| Mục | Ghi chú |
| --- | --- |
| Ant Design shell, Table/Form/Menu, progressive disclosure Setup/Guests/Gate/Support | Dùng DTO/list đã có; a11y/i18n |
| Deep-link từ `EventReport` → pending/CS (O12 P3) | `pendingApprovalCount` / `emailNeedsCsCount` đã có |
| Ẩn nav theo O02 permissions | Client chỉ đọc server allowlist |
| Watermark `asOf` + refresh thủ công | Đã có field report |
| Host-aware marketing vs product | O13 web — ngoài BE trừ redirect URI |

---

## 4. Ma trận data boundary (tenant / event / RBAC)

Neo: [PLATFORM-POLICY](../ops/PLATFORM-POLICY.md) + `requireTenantPermission` (transaction-local).

| Actor | Tenant scope | Event scope | Portal data được thấy | Bị cấm |
| --- | --- | --- | --- | --- |
| Owner | profile, members, event.create/list | Cần **assignment** để mutate event như Manager | Members/invites (khi G-M*), events list | Bypass event checks; arbitrary permissions API |
| Manager | discovery assigned-only | config, publish, inventory, approve, report, export | Pending, import, report, config | CS resend nếu không có perm; platform tenants |
| CS | — | `cs.lookup` / `cs.resend` | Ticket search masked + timeline | Quota change; approve; export* (trừ khi grant riêng — hiện không) |
| Supervisor | — | Gate + undo + revoke ticket | Gate ops; không full report trừ perm | Export/import mặc định |
| Scanner | — | `gate.confirm` | Gate confirm only | Admin workbench (O02) |
| Platform operator | `/platform/*` | support grant **event-scoped** read | Tenant limits/status; grant tickets | Impersonate; audience mobile attendee |
| Attendee | — | own redemptions/tickets | `/me/*` | Staff lists |

**Invariants giữ nguyên (không đề xuất nới):**

1. Tenant context **transaction-local**; query parameterized; runtime DB role **không** bypass RLS ([PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).
2. Quota / check-in concurrency: **PostgreSQL SoT**; Redis **không** SoT (ADR-17 outbox PG).
3. Async jobs: leased outbox + worker — không chuyển SoT sang Redis.
4. List staff: email/code **masked**; invitation list fail-closed nếu CTR thấy raw email/token (web `invitation.ts` đã enforce parse).
5. 404 vs 403: không leak cross-tenant existence ngoài policy hiện hành.
6. Idempotency-Key bắt buộc trên approve/deny/resend/export mutations.

---

## 5. Contract handoff & AC đề xuất (từng API thật cần)

Coordinator sở hữu root `packages/contracts` + regen OpenAPI. Backend chỉ implement sau handoff.

### 5.1 P0 — đóng lệch staff/platform (portal unblock)

| ID | Contract đề xuất | AC (denied / cross-tenant / concurrency / cursor / privacy) |
| --- | --- | --- |
| **H-M1** | `GET /tenants/{t}/members?cursor&limit` → page `{ items, nextCursor }` | 401/403 thiếu `members.manage`; tenant B id → 404/403 không leak; cursor ổn định; **không** email raw (mask); revoked filter default active |
| **H-M2** | `GET /tenants/{t}/invites?cursor&limit&state?` | Như trên; pending/expired/used; resend không reset vô hạn (rate-limit) |
| **H-M3** | `POST …/invites/{id}/revoke`, `POST …/resend` | Idempotency; LAST_OWNER không áp dụng invite; audit |
| **H-M4** | `PATCH …/members/{id}/role` + event-assignment PUT/DELETE | Role-map only; last-Owner; revoke fail-closed request sau |
| **H-P1** | `GET /platform/tenants?cursor&limit` | Operator + MFA assurance; không attendee audience |

### 5.2 P0/P1 — import & guest invitations (CTR đã có)

| ID | Contract | AC |
| --- | --- | --- |
| **H-I1** | Implement đủ `IMPORT_ENDPOINTS` **hoặc** ADR cắt BFF về `POST` sync + document breaking | Preview **không** reserve quota; commit idempotent; errors page cursor; cross-tenant importId → not found |
| **H-I2** | `GET …/invitations` + dispatch-preview + dispatch | List = `InvitationSummary` masked; previewRevision bắt buộc commit; concurrent dispatch → conflict ổn định; **không** raw token |
| **H-I3** | `POST …/invitations/claim` (attendee host) | Email verified; token one-time; quota/issue invariants D2 |

### 5.3 P1 — inventory codes & audit

| ID | Contract | AC |
| --- | --- | --- |
| **H-C1** | `GET …/codes?cursor&limit&state&sourceId&q` | `q` chỉ HMAC/lookup như CS — **không** list raw secrets; states HELD/AVAILABLE/…; permission `inventory.import` hoặc `inventory.read` mới (role-map — **cần chốt** thêm perm vs tái dụng import) |
| **H-A1** | `GET …/events/{e}/audit?cursor&from&to&action` | `audit.read` mới hoặc Supervisor/Manager map; **không** payload PII đầy đủ; O06 TTL; platform_audit tách `/platform/audit` |

### 5.4 P2 — convenience filters (sau P0)

Pending `q`/source/type; notification `state`; exports list; ticket-types/sources GET — additive OpenAPI, cursor chung, permission hiện có.

### 5.5 Không làm trong portal BE wave

- Payment/refund/transfer/seat/Wallet/Android.
- SSO doanh nghiệp / billing / custom-domain (sau MVP PRD).
- Validate-only Gate desk (O14 OUT) trừ user mở lại.
- Đổi SoT quota/check-in sang Redis.

---

## 6. Dashboard multi-event (trước đây OUT — đề xuất cần duyệt)

O12/O14: Dashboard **event-scoped**; multi-event Owner overview = **pha sau / OUT**.

**Đề xuất (không tự reopen coding):**

| Mục | Nội dung |
| --- | --- |
| Nhu cầu portal | Owner agency nhìn nhiều event (readiness/pending/check-in) trên `portal.` |
| BE tối thiểu | `GET /tenants/{t}/events/report-summary?cursor` — aggregate **counts only** per event (reuse dictionary O12), permission `report.read` hoặc `event.list`+assignment rule **cần chốt** |
| AC | Không PII; không cross-tenant; không thay `#229` readiness AC; watermark `asOf`; fail-closed khi thiếu perm từng event |
| Gate | User **duyệt** mở lại OUT O14 trước Wave coding |

---

## 7. Hệ quả Ant Design portal (cho web — không code ở đây)

- Table server-side: **cursor** (không offset) — khớp TD §10.
- Mọi mutation qua BFF + CSRF/same-origin như hiện tại; portal host mới → cập nhật origin allowlist (architect).
- Không tin role name trên client; chỉ `tenantPermissions` / event `permissions`.
- Empty/error/pending states theo PD; BE trả code ổn định (`PERMISSION_DENIED`, `MEMBERSHIP_REVOKED`, …).

---

## 8. Đề xuất wave (coordinator — discovery only)

```text
Gate0  User chốt host: giữ O13 (admin@app) HAY portal.vemoki.com (+ Gate host)
       + có/không mở multi-event summary (OUT O14)

Wave1  architect: ADR session/cookie/OIDC/CORS cho portal (nếu Gate0 = tách)
       ∥ coordinator: contract handoff H-M* + H-P1 (align BFF đã có)

Wave2  backend: implement H-M* / H-P1 + regen OpenAPI
       ∥ web: Ant Design portal shell consume lists (ownership web)

Wave3  coordinator+BE: H-I1/H-I2 quyết cắt BFF hay implement CTR
       ∥ BE H-C1 codes list masked

Wave4  H-A1 audit browser (sau privacy review)
       → chỉ khi Gate0 mở: multi-event summary
```

Dependencies thật: **contract trước** consumer web; architect trước DNS/cookie nếu tách host. Không serialize BA→PD→BE giả tạo cho slice đã unblocked.

---

## 9. Checklist nghiệm thu nghiên cứu (Task này)

- [x] Map CRUD/list vs missing (pending, codes, invitations, members, audit, report)
- [x] Phân UX-only / API extension / new business
- [x] RBAC + RLS/quota/outbox invariants
- [x] Handoff + AC denied/cross-tenant/cursor/privacy
- [x] Multi-event ghi **đề xuất cần duyệt** (không reopen)
- [x] `portal.vemoki.com` ghi Gate — không mặc định chuyển O13
- [x] Không sửa code ngoài file này; không commit/push

**Không** claim: portal production-ready, API đã đủ professional, hay DNS đã tách.

---

## 10. Liên kết

- Role: [backend.md](../agents/roles/backend.md)
- O12 Dashboard: [DECISION-LOG O12](../DECISION-LOG.md) · [DASHBOARD-MARKET-SYNTHESIS](./DASHBOARD-MARKET-SYNTHESIS.md)
- O13 Host: [DECISION-LOG O13](../DECISION-LOG.md) · [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](./VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md)
- O14 OUT multi-event: [DECISION-LOG O14](../DECISION-LOG.md)
- Policy roles: [PLATFORM-POLICY](../ops/PLATFORM-POLICY.md)
