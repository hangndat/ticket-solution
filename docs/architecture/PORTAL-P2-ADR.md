# PORTAL-P2 — ADR handoff: multi-event analytics + roles/onboarding + contract boundaries

| Trường | Giá trị |
| --- | --- |
| Artifact | `docs/architecture/PORTAL-P2-ADR.md` (handoff; **không** tự cấp số ADR-ops — coordinator có thể promote sang `docs/ops/ADR-21-…` khi chấp nhận) |
| Ngày soạn | **2026-10-19** |
| Trạng thái | **Đề xuất** — đủ để planner/ownership triển khai trong phạm vi Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) gói **B**; chi tiết JTBD/AC ưu tiên theo BA [#499](https://github.com/hangndat/ticket-solution/issues/499) / PD [#500](https://github.com/hangndat/ticket-solution/issues/500) khi sẵn |
| Role | `architect` · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) · Mode **Thiết kế** |
| Issue / Story / Epic | [#501](https://github.com/hangndat/ticket-solution/issues/501) · Story [#493](https://github.com/hangndat/ticket-solution/issues/493) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) |
| Run / Task | `run_d04055a8969b` · `task_f68535ab698b` |
| Base SHA đã đối chiếu | `3c108886436e6f8d9bfe6807021cbfdade59dd6a` (`origin/main` tại worktree) |
| Decision Log | **O17** (mở lại OUT multi-event từ O12/O14) — xem [`DECISION-LOG.md`](../DECISION-LOG.md) |
| Tiền đề | ADR-20 · O12 dictionary · O14 · O16 · [`PORTAL-ROADMAP.md`](../plans/PORTAL-ROADMAP.md) §P2 · [`PORTAL-PRODUCT-RESEARCH.md`](../plans/PORTAL-PRODUCT-RESEARCH.md) Wave 3 |

Architecture impact: **Có**.

---

## 1. Phạm vi và non-goals

### Mục tiêu (Gói B — P2 sản phẩm)

1. **Mở lại** phần OUT O12 §5 / O14 §6 về **multi-event Owner portfolio analytics** (không mở revenue/UTM/seat/Wallet/RFID BI — vẫn O10).
2. Handoff kỹ thuật cho **saved views / automation nhẹ**, **portal EN**, **custom roles**, **self-serve onboarding** — ranh giới contract, authz, migration, ownership.
3. Giữ Nest modular monolith, PG SoT, RLS/tenant transaction-local, deny-by-default, role-map server allowlist.

### Non-goals (cấm trong handoff này)

| OUT | Lý do |
| --- | --- |
| Cutover / DNS / TLS / dual-run ON prod | Chỉ Issue [#502](https://github.com/hangndat/ticket-solution/issues/502) / Story C |
| Enterprise SSO mới, billing, custom-domain/sender | O07 / O10 / O16 |
| Payment / refund / transfer / seat / Wallet / Android | O10 |
| Validate-only desk / resolution desk | O14 §6 vẫn OUT trừ user mở riêng |
| Mock auth / mock UAT / EAS Cloud Build | Rule dự án |
| Free-form client permission arrays | `membership.ts` + `role-map.ts` invariant |
| Đổi dictionary KPI O12 per-event | Chỉ **tái dùng** field đã có khi aggregate |

### Quan hệ BA / PD

- Epic [#491] đã ủy quyền user **A+B+C** (19/10/2026) gồm «mở lại OUT O12/O14» multi-event analytics → Decision Log **O17** ghi phạm vi sản phẩm.
- BA [#499] (`docs/plans/PORTAL-P2-BA.md`) chốt JTBD/AC/priority **trong** khung O17; PD [#500] IA/UX. Architect **không** chờ file BA để khóa ranh giới kỹ thuật dưới đây; nếu BA cắt scope hẹp hơn (ví dụ chỉ portfolio, hoãn custom roles), coding Task tôn AC BA — ADR này vẫn đúng làm ceiling.

---

## 2. Evidence đã đọc (facts)

| Nguồn | Fact ràng buộc P2 |
| --- | --- |
| `packages/backend/src/reporting.ts` | `EventReport` event-scoped; `report.read` + event assignment; counts only; `asOf` watermark; O12 quota/check-in/reject/emailNeedsCs |
| `apps/api/src/reporting.ts` | `GET …/tenants/{t}/events/{e}/report` (và audit) — **chưa** có portfolio endpoint |
| `packages/backend/src/role-map.ts` | `ROLE_SCHEMA_VERSION = 1`; roles cố định Owner/Manager/CS/Supervisor/Scanner; permissions server-derived |
| `packages/backend/src/membership.ts` | `requireTenantPermission`; production **không** nhận arbitrary permissions từ client |
| `packages/backend/src/membership-invite.ts` | Invite/accept gắn `MembershipRole` + optional eventAssignments |
| `packages/backend/src/platform-tenant.ts` | `provisionTenant` = Operator path; không self-serve public |
| ADR-20 / O16 | Portal `apps/portal`, AntD VI pilot, Gate stay app, Platform zone tách |
| O12 | Dictionary KPI; **chỉ event-scoped** (OUT multi-event đến O17) |
| O14 §6 | Multi-event / metrics product **OUT** đến khi user mở lại → O17 |
| O03 | Baseline 2 event đồng thời / 20k vé — portfolio query phải có budget & fail-closed |

**CRG:** `code-review-graph-ticket` ready (~3888 nodes); `EventReport` / `readEventReport` verified in source.

---

## 3. Quyết định đề xuất (tên tường minh)

| Mã | Quyết định |
| --- | --- |
| `P2-PORTFOLIO-REOPEN` | Mở multi-event **portfolio analytics** cho Owner (và actor có quyền đủ) trên portal; **không** mở BI doanh thu/UTM |
| `P2-EVENTREPORT-REUSE` | Portfolio = tổng hợp / danh sách snapshot tái dùng dictionary O12; không invent metric mới ở wave đầu |
| `P2-AUTHZ-ASSIGNMENT` | Mỗi dòng event trong portfolio chỉ hiện khi actor có `report.read` trên event đó (Owner vẫn cần assignment — khớp ADR-20 audit) |
| `P2-ROLES-PRESET` | «Custom roles» P2 = **named server presets** (versioned role-map), không UI tick từng permission tùy ý |
| `P2-ONBOARD-PENDING` | Self-serve = tạo tenant **PENDING** + Owner invite sau email verified; ACTIVE chỉ Operator (hoặc policy tương đương đã có) — không auto-ACTIVE từ marketing form |
| `P2-VIEWS-PHASED` | Saved views: P2a local/portal prefs; P2b server share/automation chỉ khi BA ưu tiên và có contract |
| `P2-LOCALE-ADDITIVE` | Portal EN = locale pack AntD + copy portal; mặc định VI (O04) giữ; không đổi marketing O13 |

---

## 4. Multi-event portfolio analytics

### 4.1 Vấn đề

O12/O14 cố ý event-scoped. Owner vận hành nhiều event cần **một trang portfolio** (readiness/quota/check-in/email CS tóm tắt) mà không mở BI đa chiều.

### 4.2 Phương án so sánh

| Phương án | Lợi | Hại | Kết luận |
| --- | --- | --- | --- |
| **A — Endpoint portfolio mới** `GET /v1/tenants/{t}/reports/portfolio` | Một round-trip; watermark chung; dễ budget/limit | Cần Nest + OpenAPI + tests | **Chọn** |
| B — Client N× `EventReport` | Không đụng BE | N+1, p95 xấu, watermark lệch từng call | Loại cho pilot nhiều event |
| C — Materialized BI / warehouse | Scale sau | Redis/warehouse SoT lệch PG; ngoài scope | Loại |

### 4.3 Contract đề xuất (coordinator confirm trước merge OpenAPI)

```http
GET /v1/tenants/{tenantId}/reports/portfolio?cursor=&limit=
Authorization: Bearer <staff access>
```

**Authz:** membership ACTIVE trên tenant; với mỗi event trả về, `requireTenantPermission(…, permission: 'report.read', eventId)`. Không tạo `tenant.report.read` ở wave đầu (tránh Owner thấy event chưa được assign).

**Response (sketch — không PII):**

| Field | Semantics |
| --- | --- |
| `asOf` | `clock_timestamp()` một lần cho toàn response |
| `items[]` | Mỗi phần tử: `eventId`, `title?` (nếu đã có trên list events), subset O12: `checkInSuccessCount`, `pendingApprovalCount`, `emailNeedsCsCount`, `quotaRemaining`, `quotaCapacityState`, `ticketsByState` (optional wave-2) |
| `nextCursor` | Opaque; **cấm** bịa `total` |
| `limit` | Default ≤ 20; hard max ≤ 50 (khớp O03 / reporting budget) |

**Errors:** thiếu membership → 403/404 fail-closed (không leak tồn tại tenant); event không assign `report.read` → **không** xuất hiện trong `items` (không 403 từng event).

**Idempotency / freshness:** read-only; portal refresh thủ công (O12); UI fail-closed khi `unknown`/error — không vẽ số giả.

**Compatibility:** giữ `GET …/events/{e}/report` nguyên; portfolio là additive.

### 4.4 DB / performance

- Chỉ aggregate SQL đã có pattern trong `readEventReport` (COUNT / checkins / audit reject / notifications DEAD) scoped `tenant_id` + `event_id IN (…)`.
- Không Redis cache làm SoT; cache ngắn (nếu có) chỉ hint, luôn kèm `asOf`.
- Index: tái dùng index hiện có trên `tickets`, `checkins`, `audit_log` / notifications — BE đo EXPLAIN trên fixture ≥2 events trước claim p95.

### 4.5 Ownership / wave coding

| Task | Owner | Dep |
| --- | --- | --- |
| OpenAPI + Nest portfolio + DB tests (RLS, assignment filter, limit) | **backend** | Contract confirm (coordinator) |
| Portal AntD portfolio page + manual refresh + deep-link event Dashboard | **web** (`apps/portal`) | BE endpoint hoặc stub BFF sau contract |
| AC / copy KPI | **product-ba** | O12 dictionary |
| IA layout | **product-design** | — |
| DoD ± security (authz/PII) | `reviewer-dod` + `reviewer-security` | exact SHA |

---

## 5. Saved views / automation

### 5.1 Phạm vi đề xuất

| Phase | Scope | Contract |
| --- | --- | --- |
| **P2a** | Filter/sort/column prefs trên list Events / Guests / Pending — lưu **local** (portal) theo `userId+tenantId` key | Không Nest |
| **P2b** (chỉ nếu BA ưu tiên) | Named saved view **shareable** trong tenant; optional “automation” = deep-link + filter cố định, **không** workflow engine / cron tùy ý | `GET/POST/PATCH/DELETE /v1/tenants/{t}/saved-views` — payload versioned JSON schema allowlist; permission `event.list` hoặc `members.manage` tùy BA |

### 5.2 Non-goals automation

- Không outbound webhook/Zapier.
- Không auto-approve / auto-resend từ saved view.
- Không schedule job mới ngoài outbox ADR-17 hiện có.

---

## 6. Portal EN (locale)

| Quyết định | Chi tiết |
| --- | --- |
| Default | VI (O04) |
| EN | Additive: AntD `en_US` + dictionary copy portal; selector user/org pref |
| Host | Chỉ `portal.vemoki.com` — không đổi `vemoki.com` VI+EN (O13) |
| Email | Template EN **out of band** trừ Task comms riêng; P2 UI không bắt buộc EN transactional |
| Ownership | **web**; không BE schema bắt buộc wave đầu (pref cookie/local ok); nếu sync org default locale → Task BE nhỏ sau |

---

## 7. Custom roles (RBAC)

### 7.1 Invariant (không thương lượng)

1. Client **không** gửi mảng permission tùy ý khi invite/accept (`role-map` là nguồn).
2. Mọi grant đi qua `tenantPermissionsForRole` / `eventPermissionsForRole` (hoặc bảng preset server).
3. Deny-by-default; RLS + `requireTenantPermission` giữ nguyên.

### 7.2 Phương án

| Phương án | Mô tả | Kết luận |
| --- | --- | --- |
| **A — Named presets** | Thêm role enum mới (vd. `ManagerReadOnly`, `CSLead`) hoặc `CustomRole` rows với `permissions` copy từ template server; bump `ROLE_SCHEMA_VERSION` | **Chọn cho P2** |
| B — UI matrix tick permission | Eventbrite-like | Loại: phá allowlist, khó audit, migration nguy hiểm |
| C — Reuse 5 roles + chỉ UX labels | Không đủ AC «custom roles» | Chỉ nếu BA hạ scope |

### 7.3 Contract / migration sketch (A)

1. Migration: bảng `role_presets` (tenant-scoped **hoặc** platform-global templates) — `id`, `tenant_id` nullable, `name`, `schema_version`, `tenant_permissions text[]`, `event_permissions text[]`, `created_at`; RLS theo tenant.
2. `memberships.role` giữ string; giá trị mới phải pass server validator (enum ∪ preset id).
3. Invite API: `role: MembershipRole | { presetId }` — OpenAPI discriminated union; reject unknown preset.
4. Tests bắt buộc: cross-tenant preset 404; Scanner không nhận `export.*` qua preset giả; revoke membership vẫn fail-closed.

**Handoff:** BE owns migration + invite path; web owns preset picker UI; **không** portal “permission checkbox” ở P2.

---

## 8. Self-serve onboarding

### 8.1 Hiện trạng

- Operator: `provisionTenant` → ACTIVE + limits.
- Marketing O13: form «Đăng ký quan tâm» ≠ tạo tenant.
- Staff invite accept đã có (`membership-invite` + portal/app invite UX).

### 8.2 Phương án

| Phương án | Flow | Kết luận |
| --- | --- | --- |
| **A — PENDING self-serve** | Public/authenticated signup → tạo tenant `PENDING` + membership Owner inactive/pending → email verify → Operator `ACTIVE` (reuse `setTenantStatus`) | **Chọn** |
| B — Auto ACTIVE | Marketing form tạo org dùng ngay | Loại: abuse/quota/spam; lệch platform limits |
| C — Chỉ UX wizard sau Operator provision | Không «self-serve» thật | Fallback nếu BA cắt scope |

### 8.3 Trust boundary

| Surface | Client | Ghi chú |
| --- | --- | --- |
| Signup API | Public rate-limited **hoặc** authenticated Keycloak user chưa có tenant | Không dùng staff `ticket-admin-web` secret ở browser |
| Activate | Platform Operator + MFA (ADR-20) | Lý do/reason bắt buộc khi suspend; activate tương tự audit |
| First-event checklist | Portal VI(+EN) | Publish ≠ mở redeem ≠ mở Gate (PRD M03) — chỉ UX/readiness, không đổi invariant |

**Contract sketch:** `POST /v1/public/tenant-registrations` (tên cuối do coordinator) → `{ registrationId, tenantId, status: 'PENDING' }`; idempotency-key bắt buộc; không trả secrets.

---

## 9. Sơ đồ ranh giới (logic)

```text
portal.vemoki.com (staff)
  ├─ Portfolio (P2) ──GET portfolio──► Nest (PG aggregates, report.read per event)
  ├─ Event Dashboard ─GET EventReport► Nest (giữ O12)
  ├─ Team / presets ──invite role───► role-map / role_presets (server)
  └─ Onboarding wizard ◄── PENDING ── public registration + Operator ACTIVE

app.vemoki.com          Gate / attendee (không đổi host)
platform zone           Operator provision/activate/health (ADR-20)
```

---

## 10. Cập nhật Decision Log (O12 / O14)

| Trước | Sau (O17) |
| --- | --- |
| O12 §5: chỉ event-scoped; multi-event = pha sau | **Cho phép** portfolio multi-event theo §4; dictionary per-event **giữ** |
| O14 §6: multi-event / metrics product OUT | **Mở multi-event portfolio**; «metrics product» tuỳ tiện / revenue BI **vẫn OUT** |
| O16: không mở P2/multi-event BI | P2 được ủy quyền Epic #491; BI doanh thu vẫn OUT |

Chi tiết dòng Decision Log: mục **O17** trong [`DECISION-LOG.md`](../DECISION-LOG.md).

---

## 11. Test / evidence matrix (khi coding — exact SHA)

| # | Case | Pass khi |
| --- | --- | --- |
| T1 | Portfolio không có `report.read` trên event B | Event B không có trong `items` |
| T2 | Cross-tenant tenantId | 403/404; không leak |
| T3 | `limit` > max | Clamp hoặc 400; không full-scan |
| T4 | Watermark | Một `asOf` ISO cho response |
| T5 | Preset forge permissions | Invite với permission lạ → reject |
| T6 | Self-serve | PENDING không gọi được admin mutations như ACTIVE |
| T7 | RLS | Runtime DB role không đọc cross-tenant raw |
| T8 | Portal EN | Default VI; EN switch không vỡ AntD SSR |
| T9 | Gate regression | `app./gate` không phụ thuộc portfolio |
| T10 | Headless UAT | Owner: login portal → portfolio → deep-link event report |

Docs-only Task #501: không chạy runtime Nest; verify link/path bằng kiểm tra file tồn tại trên tip SHA.

---

## 12. Ownership / dependencies thật

```text
BA #499 (AC) ∥ PD #500 (IA) ∥ Architect #501 (file này)
        │
        ▼ coordinator confirm contract §4.3 / §7.3 / §8.3
        │
        ├─► BE portfolio (+ tests) ──► web portfolio UI
        ├─► BE role presets (nếu AC BA giữ custom roles) ──► web picker
        ├─► BE/public registration (nếu AC BA giữ self-serve) ──► web wizard
        └─► web EN locale (có thể ∥ không phụ thuộc BE)
```

Cutover prod [#502]: **không** phụ thuộc P2 coding; P2 không block Story C.

---

## 13. Phương án đã xét / loại (tóm tắt)

- Warehouse/Redis SoT cho portfolio → loại.
- Client N+1 EventReport làm portfolio chính thức → loại.
- Permission checkbox UI → loại.
- Auto-ACTIVE self-serve → loại.
- Mở validate-only / payment / SSO cùng P2 → loại.

---

## 14. Kết luận

**Đủ để triển khai trong scope** kỹ thuật P2 sau khi coordinator xác nhận contract sketches (§4.3, §7.3, §8.3) và BA gắn AC/priority.

| Hạng mục | Verdict |
| --- | --- |
| Mở OUT O12/O14 multi-event (portfolio) | **Đề xuất chấp nhận** theo Epic #491 → ghi O17 |
| Custom roles | Preset server — **Đề xuất** |
| Self-serve onboarding | PENDING + Operator ACTIVE — **Đề xuất** |
| Saved views / EN | Phased / additive — **Đề xuất** |
| Cutover prod | **Ngoài scope** (#502) |

Blocker cứng cho docs handoff: **không**. Blocker cho coding feature: thiếu AC BA chi tiết chỉ trì hoãn **thứ tự** Story, không hủy khung ADR.

---

## 15. Checklist DoD đối chiếu implementation (sau này)

Khi PR coding P2: reviewer đối chiếu exact SHA với §3–§8; design drift (endpoint khác, permission mới không qua role-map, BI revenue, auto-ACTIVE) → FAIL hoặc Architect revalidation session khác tác giả.
