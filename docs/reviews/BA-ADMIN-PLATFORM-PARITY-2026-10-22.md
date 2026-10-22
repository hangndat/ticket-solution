# BA parity — `apps/web` admin/platform vs `apps/portal` (D-7 / Issue #791)

| Trường | Giá trị |
| --- | --- |
| Issue | [#791](https://github.com/hangndat/ticket-solution/issues/791) · Epic [#786](https://github.com/hangndat/ticket-solution/issues/786) |
| ADR | [ADR-20](../ops/ADR-20-PORTAL-ADMIN.md) — staff UI đích `portal.vemoki.com`; legacy `app./admin` + `/platform` giữ đến parity có evidence |
| Base SHA đối chiếu | `d1313079910995e3afc9ed196e124615ded3a2bc` (`origin/main`) |
| Phạm vi | Chỉ phân tích — **không** sửa `apps/**` trong Task này |
| Audit tham chiếu | `/tmp/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md` mục **6A.3** (~100 class legacy admin/platform xóa cùng route) |
| Evidence portal surfaces | [PORTAL-PR-429-web-harden-parity.md](./PORTAL-PR-429-web-harden-parity.md) |

---

## 1. Tóm tắt điều hành

| Câu hỏi | Kết luận |
| --- | --- |
| **Đủ để xóa route + `src/admin`/`src/platform` trên `apps/web`?** | **Thiếu** — còn gap chức năng Operator platform và một phần Notify (C-N) trước khi gỡ BFF legacy an toàn. |
| **Staff admin sự kiện (monolith `/admin`)?** | **Có / Một phần** — portal là superset theo route AntD; thiếu UI+BFF cho template/reminder notify. |
| **Bật redirect `app.→portal` (flag)?** | Có thể **sau** đóng gap + UAT headless portal trên SHA tích hợp; prod đã redirect `/admin` ở một số deploy (xem UAT prod) — không thay quyết định user ngoài D-7. |

**Owner đề xuất gap:** **web** (portal BFF + UI) + **coordinator** (Keycloak dual-run URI, flag deploy) — không mở MVP mới.

---

## 2. Ma trận chức năng — route & shell (`app/**`)

| Màn / hành động (web) | Parity | Portal (đích) | Web (legacy) |
| --- | --- | --- | --- |
| Shell admin tổng quan + job nav (setup / guests / gate / support) | **Có** (IA khác) | `app/page.tsx`, `app/t/[tenantId]/page.tsx`, sider `portal-shell.tsx` + `capabilities.ts` | `app/admin/page.tsx`, `admin-form.tsx` (`ADMIN_JOBS`) |
| Dual-run banner legacy → portal | **Có** | `src/components/dual-run-banner.tsx` (portal) | `src/portal/dual-run-banner.tsx` |
| Platform console shell | **Một phần** | `app/platform/page.tsx` (tabs Tenants / Health / Revoke / Audit) | `app/platform/page.tsx`, `platform-console.tsx` |
| OIDC platform login/logout | **Có** | `app/api/auth/platform/*` | `app/api/auth/platform/*` |
| Self-serve onboarding tenant | **Thiếu trên web** (portal only) | `app/onboarding/page.tsx`, `onboarding/[tenantId]/page.tsx` | — |
| Account security (staff) | **Có** | `app/account/security/page.tsx` | (web staff dùng `/auth` chung attendee) |

---

## 3. Ma trận — staff admin theo capability (monolith web → route portal)

Quy ước: **Có** = hành động tương đương + BFF portal tới Nest; **Một phần** = đọc/list OK, thiếu mutate hoặc UX khác; **Thiếu** = không route/UI/BFF portal.

| Nhóm (web `admin-form` / section) | Parity | Portal | Web |
| --- | --- | --- | --- |
| Chọn tenant / event (scope) | **Có** | URL `/t/{tenantId}/e/{eventId}/…`, shell switcher | Query `?tenantId=&eventId=` + `use-admin-scope.ts` |
| Tạo sự kiện | **Có** | `app/t/.../events/new/page.tsx` | Block trong `admin-form.tsx` + `POST /api/bff/admin/events` |
| Danh sách / metadata / publish / cancel / archive / clone | **Có** | `e/[eventId]/page.tsx`, `setup`, `publish` BFF dưới `tenants/.../events/...` | `event-lifecycle-section.tsx`, hooks `use-event-lifecycle-api.ts` |
| Readiness trước publish | **Có** | `src/prep/readiness.ts` + overview event | `admin-readiness-aside.tsx`, `readiness.ts` |
| Ticket types & sources | **Có** | `types/page.tsx`, `sources/page.tsx` | `ticket-source-section.tsx` |
| Quota | **Có** | `quota/page.tsx` | Trong `admin-form` / lifecycle |
| Config / brand / rollback | **Có** | `config/page.tsx`, branding BFF tenant | `config-brand-panel.tsx` |
| Import CSV / invitations | **Có** | `guests` tab import + `ImportInvitationsPanel` | `import-panel.tsx` |
| Pending redemption approve/deny | **Có** | `guests` tab pending + `PendingPanel` | `redemption-approval-section.tsx` |
| CS lookup / resend | **Có** | `support/page.tsx`, `CsPanel` | `cs-section.tsx` |
| Export jobs | **Có** | `guests#export`, `audit#jobs`, `ExportPanel` | `export-section.tsx` |
| Event report (gate metrics) | **Có** | `gate/page.tsx`, overview report | `event-report-section.tsx` |
| Audit & codes browse | **Có** | `audit/page.tsx`, `CodesPanel` | (gộp trong admin jobs / report CTA) |
| Notifications **list + retry** | **Có** | `NotificationsOpsPanel` + `GET …/notifications` | `notifications-panel.tsx` (phần list) |
| Notification **template** preview/publish | **Thiếu** | Client `src/ops/notifications.ts` có path upstream; **không** có `app/api/bff/.../notification-templates/*` | `notifications-panel.tsx` + `app/api/bff/admin/notification-templates/*` |
| Event **reminders** preview/create/cancel | **Thiếu** | Cùng — **không** `…/reminders/*` trên portal BFF | `notifications-panel.tsx` + `app/api/bff/admin/reminders/*` |
| Tenant members / invites | **Có** (portal tốt hơn) | `members/page.tsx` (role presets, ProTable) | `tenant-staff.tsx` (gọi platform BFF trên web) |
| Org analytics | **Thiếu trên web** | `analytics/page.tsx` | — |
| Deep-link Gate scan (staff) | **Có** | `gate/page.tsx` + deeplink `app./gate` | Job «Cổng» trong admin (approval, không thay scanner) |

---

## 4. Ma trận — Platform Operator (`/platform`)

| Hành động | Parity | Portal | Web |
| --- | --- | --- | --- |
| `/platform/me` (operator + MFA assurance) | **Có** | `GET app/api/bff/platform/me` | `GET app/api/bff/platform/me` |
| Danh sách tenant (cursor) | **Có** | `platform/page.tsx` + `GET …/platform/tenants` | (web: chỉ form UUID thủ công) |
| **Tạo tenant** (provision + owner invite) | **Thiếu** | Không `POST` trên `apps/portal/app/api/bff/platform/tenants/route.ts` (chỉ GET) | `POST /api/bff/platform/tenants` + form `platform-console.tsx` |
| Tenant **detail** (version, limits, flags) | **Thiếu** | Không BFF `…/platform/tenants/[tenantId]` | `GET /api/bff/platform/tenants/[tenantId]` |
| **Suspend / Activate** | **Thiếu** | Không BFF `…/status` | `POST …/status` |
| Cập nhật **limits/flags** | **Thiếu** | Không BFF `…/limits` | `PUT …/limits` |
| Tenant **health** | **Có** | Tab Health + `…/health` | Nút Health trong console |
| **Tạo** support grant (`cs.read`) | **Thiếu** | Chỉ **revoke** grant: `support-grants/[grantId]/revoke` | `POST /api/bff/platform/support-grants` |
| Revoke support grant | **Có** | Tab Revoke | (web không có revoke UI — portal **hơn**) |
| Platform **audit** list | **Thiếu trên web** | `GET …/platform/audit` + tab Audit | — |

**Ghi chú BA:** Với Operator, portal **không** đạt parity «xóa web» vì web vẫn là nơi duy nhất provision/suspend/limits/grant-create qua BFF `apps/web`.

---

## 5. Ma trận — `src/admin` & `src/platform` (logic client)

| Module web | Parity | Portal tương đương |
| --- | --- | --- |
| `src/admin/*` (33 file) — client BFF admin | **Một phần** | `apps/portal/src/ops/*`, `prep/*`, `client/portal-fetch.ts` — path BFF đổi sang `/api/bff/tenants/{t}/events/{e}/…` |
| `src/platform/*` (7 file) — OIDC + platform fetch | **Một phần** | `apps/portal/src/oidc/platform-config.ts`, `ops/platform-zone.ts` — thiếu forward cho mutate tenant/grant-create |

Không cần «migrate» `src/admin` sang Tailwind (D-7 / 6A.3): **xóa** sau redirect + gỡ `app/api/bff/admin/*`.

---

## 6. Phụ thuộc khi xóa (checklist AC #2)

### 6.1 Keycloak / OIDC (ADR-20 §3.1, ~dòng 30, 71–73)

| Hạng mục | Hiện trạng | Việc cần (owner: **coordinator** + user ops prod) |
| --- | --- | --- |
| `ticket-admin-web` redirect | Portal URI đã có trong `infra/keycloak/realm-ticket.json` (`https://portal.vemoki.com/api/auth/callback`) | Giữ dual-run URI `app./api/auth/callback` đến khi gỡ admin web |
| Legacy `/api/admin/auth/callback` trên realm | Khai báo lịch sử; **không** implement trên web | Có thể gỡ URI khỏi realm **sau** không còn traffic (metric/log) |
| `ticket-platform-web` | Portal `…/api/auth/platform/callback` đã khai báo | Dual-run: giữ URI `app.` đến khi xóa `/platform` web |
| Client attendee `ticket-web` | Không đổi | Đảm bảo không gộp cookie cross-host (`Domain=.vemoki.com` — **cấm**) |

### 6.2 BFF `apps/web`

| Khối | Số route (ước lượng) | Sau xóa |
| --- | --- | --- |
| `app/api/bff/admin/**` | ~45 handlers | Gỡ toàn bộ; consumer chỉ portal |
| `app/api/bff/platform/**` | ~7 handlers | Gỡ sau parity Operator mutate |
| `app/api/auth/platform/*` | 3 | Gỡ khi không host `/platform` trên app |

### 6.3 Nav / capabilities (`apps/web`)

| File | Thay đổi đề xuất |
| --- | --- |
| `src/nav/capabilities.ts` | Bỏ link `nav-admin`, `nav-platform`; CTA portal khi `PORTAL_ORIGIN` |
| `src/nav/staff-route-guard.ts` | Bỏ `StaffRoute '/admin'` hoặc chỉ redirect |
| `src/nav/staff-denied-copy.ts` | Giữ CTA `portalHref('/admin')` |
| `src/nav/load-nav-capabilities.ts` | Bỏ `platformGet` nếu không còn nav platform |

### 6.4 Redirect (khi **đủ** parity — flag ADR-20 §8)

| Nguồn (`app.vemoki.com`) | Đích (`portal.vemoki.com`) | Ghi chú |
| --- | --- | --- |
| `GET/HEAD /admin` | `/` hoặc `/t/{tenantId}` nếu map được từ query allowlist | Query allowlist: `tenantId`, `eventId`, `intent`, `tab`, `job` — `src/portal/dual-run.ts` |
| `GET/HEAD /admin?…&job=gate` | `/t/{t}/e/{e}/gate` | Cần adapter mapping `job` → path (task web sau BA) |
| `GET/HEAD /platform` | `/platform` | Giữ query allowlist |
| `POST/PUT/PATCH` tới `/api/bff/admin/*` | **Không** redirect | Fail hoặc 410 sau cutover có chủ đích |

Env: `PORTAL_ORIGIN`, `PORTAL_ADMIN_REDIRECT` (default **OFF**), `PORTAL_DUAL_RUN_BANNER`.

### 6.5 Test & tài liệu

| Khu vực | File / lệnh |
| --- | --- |
| Dual-run unit | `apps/web/tests/portal-dual-run.test.ts` |
| Admin BFF integration | `apps/web/tests/routes.integration.mjs` (khối `/api/bff/admin/*`) |
| Staff guard | `staff-route-guard.test.ts`, `staff-denied-copy.test.ts` |
| UAT legacy | `admin-uat.mjs`, `admin-chrome-uat.mjs`, `a11y-redeem-admin-gate-uat.mjs` — chuyển scope portal hoặc xóa |
| 6A.4 gate | `test ! -d apps/web/app/admin && test ! -d apps/web/app/platform` |
| Runbook | Cập nhật `docs/ops/PORTAL-LOCAL-CUTOVER-PREP.md`, deploy nginx (đã có `portal.vemoki.com`) |

### 6.6 Email / link

Staff invite accept → **portal** (ADR-20 §5). Rà soát template email còn `app.vemoki.com/admin` → đổi sang portal path `/onboarding/...` hoặc `/t/...` (**coordinator** / content).

---

## 7. Danh sách xóa đề xuất (chỉ khi parity **Có**)

### 7.1 `apps/web/app`

```
apps/web/app/admin/                    # 14× tsx
apps/web/app/platform/                 # 2× tsx
apps/web/app/api/bff/admin/            # toàn cây
apps/web/app/api/bff/platform/         # sau parity Operator
apps/web/app/api/auth/platform/        # khi cutover platform host
```

### 7.2 `apps/web/src`

```
apps/web/src/admin/                    # 33 file
apps/web/src/platform/                   # 7 file (oidc platform trên app)
```

### 7.3 CSS legacy (audit 6A.3)

- ~**100** class trong `live-pulse-legacy.css` gắn `app/admin`, `app/platform`, `src/admin`, `src/platform` — xóa cùng route (không migrate).

### 7.4 Giữ (dual-run / attendee)

- `apps/web/src/portal/dual-run.ts`, `dual-run-banner.tsx` — đến khi tắt redirect và xóa banner.

---

## 8. Gap cần đóng trước «Đủ để xóa»

| ID | Gap | Owner | Acceptance gợi ý |
| --- | --- | --- | --- |
| G-791-1 | Portal BFF + UI **notification-templates** + **reminders** | **web** | Parity với `apps/web/app/api/bff/admin/notification-templates/*` và `reminders/*`; UI trên `guests#notifications` hoặc tab riêng |
| G-791-2 | Portal BFF **POST** tenant, **GET** detail, **POST** status, **PUT** limits | **web** | Feature parity `platform-console.tsx` |
| G-791-3 | Portal UI **create support grant** | **web** | `POST /api/bff/platform/support-grants` trên portal process |
| G-791-4 | Redirect mapping `job`/`tab` legacy → portal path | **web** | Test T1 ADR-20 mở rộng; document trong runbook |
| G-791-5 | UAT headless portal sau gap (không thay #439) | **coordinator** | Evidence SHA trên PR tích hợp |

**Không** coi gap G-791-2 là blocker nếu product quyết định Operator chỉ dùng CLI/API — cần **user** explicit; mặc định BA: giữ parity với web hiện tại.

---

## 9. Kết luận BA (AC #3)

| Verdict | **Thiếu** |
| --- | --- |
| Lý do | Staff event ops ~**95%** trên portal; **Notify C-N** (template/reminder) và **Platform mutate** (provision/suspend/limits/grant-create) chưa có trên `apps/portal` trong khi vẫn tồn tại trên `apps/web`. |
| Được phép ngay (D-7) | **Đóng băng** UI/CSS admin/platform web (audit mục 5); không thêm selector legacy; tiếp tục dual-run banner/redirect theo ADR-20. |
| Không được (Task này) | Xóa route/BFF web; bật prod cutover; deploy DNS — ngoài phạm vi #791. |

---

## 10. Evidence đối chiếu

```bash
# Đếm surface web (baseline SHA trên)
find apps/web/app/admin -name '*.tsx' | wc -l    # 14
find apps/web/app/platform -name '*.tsx' | wc -l # 2
find apps/web/src/admin -type f | wc -l          # 33
find apps/web/src/platform -type f | wc -l       # 7

# Portal routes (app router)
find apps/portal/app -name 'page.tsx' | wc -l    # 23

# Gap BFF reminders/templates trên portal
rg -l 'reminders|notification-templates' apps/portal/app/api || true  # (empty at SHA trên)
```

**Đọc thêm:** `docs/ops/ADR-20-PORTAL-ADMIN.md` §8 migration; `apps/portal/tests/portal-menu-keys.test.ts`, `ops-paths.test.ts`.

---

*Kazu · product-ba · Issue #791 · SHA `d1313079910995e3afc9ed196e124615ded3a2bc`*
