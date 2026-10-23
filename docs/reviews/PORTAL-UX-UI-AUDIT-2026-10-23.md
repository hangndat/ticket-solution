# Portal UX/UI Audit — Assessment A (2026-10-23)

> **Đối chiếu coordinator:** Xem [bản tổng hợp sau kiểm chứng](./PORTAL-AUDIT-2026-10-23.md). Không kế thừa `PASS with known gap` bên dưới thành nghiệm thu UX; PUX-007/012 và một số nhận xét được loại hoặc chuyển kiến nghị. PA-01 mở rộng lỗi mobile từ riêng logo thành toàn bộ header theo ảnh đã mở. Trạng thái server ở §7 là thời điểm bàn giao, cleanup cuối ghi tại `assets/portal-audit-2026-10-23/coordinator/CLOSEOUT.md`.

| Trường | Giá trị |
| --- | --- |
| **Dual-agent** | **Assessment A** (UX/UI critique, session này) · **Assessment B** (detector / worker khác, coordinator quản lý — **không** đọc chéo) |
| **Reviewer** | Mira · ux (`reviewer-uiux`) — dispatch `task_e6d08601b679` + **auth pass** `task_439267b089a1` / `ctx_1867a7b94b16` |
| **Độc lập** | Review-only; không implementer cùng slice; không xem artifact Assessment B |
| **Exact SHA** | `b34187919ade8ab5e07efcab59ac0284097c663d` (`origin/main` khi bắt đầu audit) |
| **Scope** | `apps/portal/**`, neo `docs/design/PORTAL-ANTD-UX.md`, `PORTAL-PRO-REVAMP.md`, O02, ADR portal |
| **Phương pháp** | Source review + Orca browser: (1) unauth/BFF-down pass đầu; (2) **authenticated** với fixture coordinator (`/tmp/portal-audit-832-runtime/env.json`, seed D9 `mfest-demo` / event `mfest`, staff `staff@example.com`) từ ~02:09:58 |
| **Skills** | `impeccable` critique (single-context), `web-design-guidelines`, `vercel-react-best-practices` (đọc code), `orca-cli` browser |
| **Evidence** | `docs/reviews/assets/portal-audit-2026-10-23/ux/` · `ui-evidence-check.sh` **OK** (60 file sau auth pass) |
| **Runtime local** | `next start` @ `http://127.0.0.1:3413` + env fixture (mục 7) · checkout `/Users/admin/orca/workspaces/main/portal-audit` · **PID ~90046** (giữ đến coordinator xác nhận) |
| **Browser page** | Auth UAT: `6752f2e0-bc07-4821-b668-4ab1f18f0bb2` · Unauth pass: `4f0c52ad-0db9-43ff-bcdb-80dbfbb44acc` |

---

## Executive takeaways

1. **Khung Pro đã có trên main:** `PortalProLayout` (ProLayout mix), `PortalPage` (PageContainer), `PortalCursorProTable` — lớn phần revamp §3 PORTAL-PRO-REVAMP **đã bắt đầu**, không còn shell thuần `Layout`+`Menu` như baseline design doc 2026-10-20.
2. **Hoàn thành việc (task-first) ổn ở tầng pattern:** O02 deny-by-default (`capabilities.ts`), `SurfaceState` loading/error/denied/retry, `Modal.confirm` trên publish/members/setup, Gate **không** scan web — CTA iOS/deeplink; skip link + `focus-visible` global.
3. **Lỗ hổng lớn nhất cho staff thực tế:** **i18n không nhất quán** — hàng chục cột/filter/placeholder tiếng Anh trên màn VI mặc định (ops panels, platform, members); một số chuỗi “dịch” vẫn tiếng Anh trong bundle `vi` (`ops.export.panelInfo`).
4. **Authenticated UAT (fixture):** Staff Owner đăng nhập OIDC thật → shell Pro (tenant/event switcher, nhóm sider O02), event overview/readiness, setup/config/quota/sources, guests hub (tab Import + filter trên tab), CS support, gate report + iOS hint; locale **EN** đổi menu/labels nhưng **cột/tab ops vẫn EN** (`auth-event-guests-en-1440x1000.png`). Attendee `attendee@example.com` → empty org / self-serve CTA (`auth-attendee-deny-1440x1000.png`), không vào workspace staff.
5. **Verdict (scope A):** **PASS with known gap** — journey staff cốt lõi **đã kiểm runtime** trên fixture; gap còn: **i18n ops P1** (có ảnh EN locale), **platform operator / analytics / pending-export tương tác sâu / validation lỗi form** chưa UAT; chưa pilot-ready đến Wave 1 i18n.

---

## 1. Mẫu chuẩn đã đối chiếu

| Mẫu | Dùng cho |
| --- | --- |
| `PORTAL-ANTD-UX.md` | Personas, host triad, flow staff, parity cutover |
| `PORTAL-PRO-REVAMP.md` | ProLayout/PageContainer/ProTable, visual budget token v2 |
| `o02-permission-nav/contract.md` | Nav deny-by-default, `staffEligible`, permissions server SoT |
| O16/O18 (ui-workflow) | Cấu trúc finding, chrome probe, evidence |

---

## 2. Coverage matrix (route × persona × state)

**Personas:** Owner/Manager · CS/Supervisor · Scanner (hint only) · Platform Operator · Unauthenticated.

| Route / journey | Owner/Mgr | CS / Supervisor | Scanner | Platform Op | Unauth | Runtime | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` home redirect / empty org | — | — | — | — | Redirect login (snapshot) | Partial | ✓ |
| `/auth` landing + `?error=` | — | — | — | — | **Checked** 1440/1024/390/430 | **Checked** | ✓ |
| `/onboarding`, `/onboarding/[tenantId]` | **Checked** (first-run) | — | — | — | Unknown (no BFF) | **Checked** staff | ✓ |
| `/account/security` | — | — | — | — | Unknown (no BFF) | Partial | ✓ |
| `/platform` | — | — | — | Perm-gated | Unknown (no BFF) | **Not checked** (no platform role) | ✓ |
| `/t/[tenantId]` org overview | **Checked** 1440 | — | — | — | — | **Checked** | ✓ |
| `/t/.../events`, `/events/new` | **Checked** events list | — | — | — | — | List **Checked**; **new** not checked | ✓ |
| `/t/.../members`, `/settings` | Members **Checked** | — | — | — | — | Members **Checked**; settings **Not checked** | ✓ |
| `/t/.../e/[eventId]` overview + readiness | **Checked** 1440/390/1024 | — | — | — | — | **Checked** | ✓ |
| setup / types / sources / quota / config | **Checked** setup+config+quota+sources | — | — | — | — | **Checked** | ✓ |
| `/guests` (import/pending/notify/export) | **Checked** Import tab VI+EN | — | — | — | — | **Checked**; pending/export click **Not checked** | ✓ |
| `/gate` report + CTAs | **Checked** 1440 | — | — | — | — | **Checked** | ✓ |
| `/support`, `/audit` | Support **Checked** | — | — | — | — | Support **Checked**; audit **Not checked** | ✓ |
| `/analytics` (P2) | — | — | — | — | — | **Not checked** | ✓ |
| Tenant/event switcher, breadcrumb, back | Switcher visible | — | — | — | — | **Partial** (chưa đổi tenant thứ 2) | ✓ |
| Locale VI/EN toggle | **Checked** EN guests | — | — | — | — | **Checked** | ✓ |
| Table filter/sort/pagination/density | ProTable events/members | — | — | — | — | **Partial** (chưa sort/paginate tay) | ✓ |
| Empty/loading/error/denied/retry | Auth + BFF-down | — | — | — | **Checked** bff-down + attendee empty | Partial | ✓ |
| Keyboard/focus/contrast/touch | — | — | — | — | Auth landing + shell | Partial | ✓ |
| Chrome wrap probe | **1 issue** mobile logo | — | — | — | **Checked** unauth auth | **Checked** auth shell 390 | — |

**Ghi chú:** “—” = cần authenticated fixture; ô **Not checked** là limitation có chủ đích, không phải PASS im lặng.

---

## 3. Điểm mạnh (giữ)

- **IA O02 trong code:** nhóm sider `nav-org` / `nav-event-run` / `nav-event-setup` / `nav-platform`; `pathnameMatchesMenuPath` + longest-prefix (`portal-menu-keys.ts`) — sub-route guests/pending không làm mất highlight menu.
- **Shell Pro:** `ProLayout` `layout="mix"`, `breakpoint="lg"`, locale trong account dropdown, `#portal-main` + skip link (`shell.skipNav`).
- **Access surfaces:** `useEventAccess` / `useTenantAccess` + `SurfaceState` + `Result` permission-denied có retry/back.
- **Gate boundary:** `gate/page.tsx` report-only; `GateStayAppNotice` / scan hint — khớp GATE-STAY-APP.
- **Destructive:** `Modal.confirm` trên publish, member revoke, setup actions (config/event home).
- **A11y một phần:** `aria-label` trên filter toolbar pending/notifications/export; `role="search"`; global `*:focus-visible`; `prefers-reduced-motion` → tắt motion token AntD (`providers.tsx`).
- **Auth UX unauth:** copy VI rõ ràng, alert cookie host-only; lỗi OIDC map key (`auth/page.tsx`) — screenshot `unauth-auth-error-*`.

---

## 4. Findings

Quy ước: **P0** chặn pilot/AC · **P1** sai AC hoặc blocker journey rộng · **P2** defect có evidence · **P3** polish/a11y nhỏ · **Kiến nghị** = ngoài AC (PD).

### PUX-001 · P1 · copy/locale · Cột & placeholder ops panels tiếng Anh khi locale mặc định VI

| | |
| --- | --- |
| **Impact** | CS/Supervisor/Owner đọc bảng filter trên nền VI — nhãn EN gây lệch mental model, khó đào tạo; vi phạm PORTAL-PRO-REVAMP “chỉ `t(key)`” trên hub Guests và ops. |
| **Evidence** | Source: paths trên + runtime EN locale `auth-event-guests-en-1440x1000.png` (tab «Export CSV / recovery…», labels «Code column», «Import job ID»; menu EN nhưng tab export vẫn EN technical) |
| **Route/state** | `/t/.../guests` — **runtime Checked** (fixture Owner) |
| **AC/mẫu** | PORTAL-PRO-REVAMP §1.2 Hub Guests; locale VI mặc định §Ràng buộc |
| **Đề xuất** | Thay `title`/`placeholder` bằng `MessageKey`; tái dùng pattern `pending-panel` (đã `t(...)`) |
| **Owner** | web (`apps/portal`) |
| **Đóng khi** | Snapshot authenticated VI: 0 literal EN trên column header ops; `i18n.test` bổ sung guard grep EN columns |

### PUX-002 · P2 · copy/locale · Chuỗi “dịch” vẫn tiếng Anh trong bundle `vi`

| | |
| --- | --- |
| **Impact** | Tab Export hiển thị “Export CSV / recovery · G-E1 history filter” ngay cả locale VI. |
| **Evidence** | `messages.ts` — key `ops.export.panelInfo` **cùng chuỗi EN** cho `vi` và `en`; dùng làm tab label `guests/page.tsx:183` |
| **AC/mẫu** | Giữ key i18n hiện có — không invent; nhưng **phải** có bản VI |
| **Đề xuất** | Việt hóa `vi` value; EN giữ technical nếu cần |
| **Owner** | web + PD copy ngắn |

### PUX-003 · P2 · copy/locale · Wordmark/metadata “Vemoki Portal” không qua i18n

| | |
| --- | --- |
| **Impact** | EN users vẫn thấy brand EN (chấp nhận) nhưng **title trang** không đổi theo locale; auth card lặp literal. |
| **Evidence** | Runtime: `unauth-auth-1440x1000.png` (heading EN); source: `auth/page.tsx:44`, `portal-pro-layout.tsx:120`, `layout.tsx:18` (TODO #566 P0-1 đã ghi) |
| **Đề xuất** | Key `shell.brand` + metadata động theo cookie locale |
| **Owner** | web |

### PUX-004 · P2 · copy/locale · `formatReportAsOf` cố định `vi-VN`

| | |
| --- | --- |
| **Impact** | Gate/report “as of” luôn format Việt dù user chọn EN — lệch i18n date/time. |
| **Evidence** | `ops/report.ts:120-131` — `Intl.DateTimeFormat('vi-VN', …)` không dùng `locale` |
| **Route** | `/t/.../gate` — source-only |
| **Đề xuất** | Map `PortalLocale` → `en-US` / `vi-VN`; timezone policy PD (UTC vs tenant) |
| **Owner** | web |

### PUX-005 · P2 · lệch mẫu/AC · Design token v2 chưa map (revamp visual budget)

| | |
| --- | --- |
| **Impact** | Portal staff không bám Live Pulse v2 (ink/paper/signal/focus) như PORTAL-PRO-REVAMP §0 — lệch marketing/attendee uplift. |
| **Evidence** | `vemoki.ts` + `globals.css` dùng `#22241f` / `#f7f6f1` / `#9b3a18` / `#235fd0`; revamp doc: `#0B1220` / `#F4F6F8` / `#E11D48` / `#2563EB` |
| **Kiến nghị PD** | Chốt một bộ token staff — **không** đề xuất đổi AntD → Tailwind |
| **Owner** | PD + web |

### PUX-006 · P2 · IA · Guests hub: filter nguồn/loại vé **trên** tab ProCard

| | |
| --- | --- |
| **Impact** | User đổi tab vẫn thấy filter import — dễ hiểu filter áp cho tab sai (đặc biệt pending vs import). |
| **Evidence** | `guests/page.tsx:200-228` — filter ngoài `ProCard` tabs |
| **AC/mẫu** | PORTAL-PRO-REVAMP §1.2 “filter trong tab Import” |
| **Đề xuất** | Chuyển filter vào panel Import; pending/notifications giữ filter riêng trong panel |
| **Owner** | web (IA nhỏ — PD xác nhận nếu đổi hành vi) |

### PUX-007 · P2 · copy/locale · Members table trộn EN/VI

| | |
| --- | --- |
| **Impact** | Cột `Email` (EN) cạnh `Giao` (VI viết tắt) — không nhất quán professional portal. |
| **Evidence** | `members/page.tsx:374,574-584` |
| **Đề xuất** | `t('members.column.email')`, `t('members.column.delivery')` |
| **Owner** | web |

### PUX-008 · P3 · a11y · Spinner CSS không tôn `prefers-reduced-motion`

| | |
| --- | --- |
| **Impact** | `SurfaceState` loading vẫn quay (`globals.css` `@keyframes portal-surface-loading-spin`) khi user bật reduce motion — AntD motion đã tắt. |
| **Evidence** | `globals.css:68-71` vs `providers.tsx:34-39` |
| **Đề xuất** | `@media (prefers-reduced-motion: reduce) { animation: none }` |
| **Owner** | web |

### PUX-009 · P3 · a11y · `aria-label` kỹ thuật tiếng Anh

| | |
| --- | --- |
| **Impact** | Screen reader đọc “exportId” thay vì nhãn người dùng. |
| **Evidence** | `export-panel.tsx:241` |
| **Đề xuất** | `aria-label={t('ops.export.idField')}` |
| **Owner** | web |

### PUX-010 · P3 · IA · Deep link hash guests không sync URL khi đổi tab

| | |
| --- | --- |
| **Impact** | `#pending` mở đúng tab lần đầu; đổi tab không cập nhật hash — back/refresh có thể lệch kỳ vọng. |
| **Evidence** | `guests/page.tsx:33-45` đọc hash; `onChange: setActiveTab` không `history.replaceState` |
| **Owner** | web |

### PUX-011 · P2 · chrome · ProTable ops chưa toolbar/search thống nhất

| | |
| --- | --- |
| **Impact** | Một số màn dùng `PortalCursorProTable` (events, members) — tốt; ops panels vẫn `Table` thuần + filter thủ công — trải nghiệm lọc không đồng nhất. |
| **Evidence** | So sánh `events/page.tsx` vs `export-panel.tsx` |
| **Kiến nghị** | Wave 2 revamp: bọc panel bằng `PortalCursorProTable` hoặc ProTable `search` — **không** đổi BFF |
| **Owner** | web |

### PUX-013 · P2 · chrome · Wordmark «Vemoki Portal» xuống 2 dòng trên mobile shell

| | |
| --- | --- |
| **Impact** | Header staff trên 390px: logo/link chiếm 2 dòng — lệch chrome chuyên nghiệp, giảm không gian tenant switcher. |
| **Evidence** | `probe-auth-shell-header-390x844.json` (`issues`: `Vemoki Portal`, `lines: 2`); `auth-shell-header-390x844.png` |
| **Route/state** | `/t/.../events` authenticated |
| **Đề xuất** | Rút gọn logo mobile (icon/wordmark một dòng) hoặc `white-space: nowrap` + ellipsis trong ProLayout `logo` |
| **Owner** | web |

### PUX-012 · Kiến nghị (P3) · Hiển thị UUID/slug thô trên title

| | |
| --- | --- |
| **Impact** | Một số màn vẫn expose ID trong table (cần cho ops) — đảm bảo **title** PageContainer không lộ UUID (revamp anti-pattern). |
| **Evidence** | Review source `types/page.tsx` (`title: 'ID'`), quota Capacity EN |
| **Owner** | web + PD |

---

## 5. Nguyên nhân hệ thống & wave ưu tiên

| Root cause | Findings | Wave |
| --- | --- | --- |
| **Ops panels port nhanh từ admin web — chưa i18n hóa cột** | PUX-001, 007, 009 | **Wave 1 (quick win)** — grep + `MessageKey` |
| **Bundle vi copy thiếu / placeholder EN** | PUX-002, 003 | Wave 1 |
| **Locale không truyền vào formatters** | PUX-004 | Wave 1 |
| **Revamp Pro một nửa (shell yes, ops tables mixed)** | PUX-011 | Wave 2 |
| **Token staff chưa sync visual budget v2** | PUX-005 | Wave 2 — **cần PD** |
| **IA Guests hub** | PUX-006, 010 | Wave 2 — PD xác nhận |
| **ProLayout logo responsive** | PUX-013 | Wave 1 |

**PD decisions cần review:** token v2 vs giữ v1 staff; timezone hiển thị report; có việt hóa hoàn toàn thuật ngữ kỹ thuật (Export ID) hay giữ EN cho power users.

---

## 6. Runtime evidence (Orca browser)

| Artifact | URL / state | Viewport | Ghi chú |
| --- | --- | --- | --- |
| `unauth-auth-1440x1000.png` | `/auth` | 1440×1000 | VI copy, CTA rõ |
| `unauth-auth-1024x900.png` | `/auth` | 1024×900 | Probe: 0 wrap |
| `unauth-auth-390x844.png` | `/auth` | 390×844 | Mobile card full width |
| `unauth-auth-error-1440x1000.png` | `/auth?error=access_denied` | 1440×1000 | Result error + retry login |
| `unauth-auth-error-430x932.png` | same | 430×932 | |
| `unauth-bff-down-unknown-1440x1000.png` | `/onboarding` (no API) | 1440×1000 | **Chung** unknown cho onboarding/platform/account khi không BFF |
| `unauth-bff-down-unknown-390x844.png` | same | 390×844 | |
| `snapshot-unauth-auth-*.json` | DOM snapshot Orca | — | Tái hiện không cần ảnh |
| `probe-unauth-auth-*.json` | chrome-wrap probe | — | `issues: []` |

**Lệnh tái hiện (mẫu):**

```text
orca tab create --url http://127.0.0.1:3413/auth --worktree path:/…/portal-audit-832-ux --json
orca exec --page <id> --command "set viewport 1440 1000"
orca exec --page <id> --command "goto http://127.0.0.1:3413/auth"
orca exec --page <id> --command "screenshot docs/reviews/assets/portal-audit-2026-10-23/ux/unauth-auth-1440x1000.png"
```

**PNG hash (đầu SHA-256):** `2880e8df65e7` auth 1440 · `c3a481a7dfbf` auth 1024 · `7e9c07a65a8e` auth 390 · `7115803c7bfc` auth error 1440 · `8c98ea82b10a` error 430 · `a23690dc6d52` bff-down 1440 · `4d635320a776` bff-down 390.

**Giới hạn unauth pass:** Dev `next dev` gây CDP screenshot timeout; unauth chụp trên `next start` **không** env OIDC.

### 6.1 Authenticated staff (fixture D9, `task_439267b089a1`)

| Artifact | Route / persona | Viewport |
| --- | --- | --- |
| `auth-onboarding-1440x1000.png` | Onboarding MFest | 1440 |
| `auth-org-overview-1440x1000.png` | Org overview | 1440 |
| `auth-events-list-1440x1000.png` | Events ProTable | 1440 |
| `auth-event-home-{1440,390x844,1024x900}.png` | Event dashboard + readiness | multi |
| `auth-event-setup/config/quota/sources/guests/support/gate-1440x1000.png` | Setup slice | 1440 |
| `auth-event-guests-en-1440x1000.png` | Guests hub locale **EN** | 1440 |
| `auth-members-1440x1000.png` | Members | 1440 |
| `auth-attendee-deny-1440x1000.png` | Attendee empty org | 1440 |
| `auth-shell-header-390x844.png` | Shell chrome | 390 |
| `probe-auth-*.json` | Chrome wrap per màn | — |

**Fixture:** API `http://127.0.0.1:3410`, Keycloak `http://127.0.0.1:8480/realms/ticket`, tenant `d9d9f001-0001-4000-8000-000000000001`, event `d9d9f001-0002-4000-8000-000000000001`. Env: `/tmp/portal-audit-832-runtime/env.json` (load qua Python, không commit). **Ghi chú UAT:** Keycloak `CONFIGURE_TOTP` required-action đã xóa trên user demo qua Admin API để hoàn tất login — thao tác fixture, không đổi `apps/portal`.

**Top findings xem lại trên tab `6752f2e0-bc07-4821-b668-4ab1f18f0bb2`:** PUX-001 (`auth-event-guests-en-1440x1000.png`), PUX-013 (`auth-shell-header-390x844.png`), PUX-006 (`auth-event-guests-1440x1000.png` filter trên tab).

---

## 7. Local server (audit)

| | |
| --- | --- |
| **URL** | `http://127.0.0.1:3413` |
| **CWD** | `/Users/admin/orca/workspaces/main/portal-audit` (SHA khớp) |
| **Env** | `python3 -c "import json,os; ... env.json"` → `pnpm --filter @ticket/portal exec next start --port 3413 --hostname 127.0.0.1` |
| **PID (auth pass)** | ~`90046` (log `/tmp/portal-audit-832-runtime/portal-3413.log`) — **đang chạy** cho coordinator review |
| **Dừng** | `kill $(lsof -t -i:3413)` sau coordinator xác nhận |

---

## 8. Limitations & verdict

| Limitation | Hệ quả |
| --- | --- |
| Auth pass đầu thiếu env | Đã thay bằng fixture coordinator; **không** tính là product bug |
| Platform operator / analytics / form error paths | Vẫn **not checked** |
| Assessment B độc lập | Không dùng detector/report B |
| Không production / không secrets | Chỉ local unauth + source |
| Screenshot dev mode | Timeout — dùng production `next start` |

**UX verdict (Assessment A):** **PASS with known gap** — staff Owner journey **đã xác minh runtime** (fixture); shell Pro + O02 + readiness/guests/gate/CS **usable**. Gap: **i18n ops P1** (runtime EN chứng minh), chrome mobile logo (PUX-013), platform/analytics/destructive modal live chưa UAT. **Không** pilot-ready đến Wave 1 i18n + chrome fix.

**Questions skipped:** Phạm vi đã đủ trong task spec; kiến nghị Wave/PD để user/coordinator review.

---

*Reviewer: Mira · ux · `task_e6d08601b679` + `task_439267b089a1` · SHA `b34187919ade8ab5e07efcab59ac0284097c663d`*
