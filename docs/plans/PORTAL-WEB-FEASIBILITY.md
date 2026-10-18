# Portal admin riêng (`portal.vemoki.com`) — feasibility & roadmap (Ant Design)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-18 |
| Role | `web` · [docs/agents/roles/web.md](../agents/roles/web.md) |
| Mode | **Chỉ discovery / design / roadmap** — không code tính năng, không cài package |
| Architecture impact | **Có** — subdomain thứ ba, session/cookie/OIDC, tách UI staff vs attendee/marketing |
| Output duy nhất | File này (`docs/plans/PORTAL-WEB-FEASIBILITY.md`) |
| Source HEAD lúc bắt đầu Task | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Non-goals | Edit `apps/web` / `apps/mobile` / infra · commit/push/PR · GitHub board · deploy/DNS · spawn worker · Android/payment/refund/transfer/seat/Wallet · SSO/billing/custom-domain |

> **Quyền quyết định:** file này **đề xuất** Gate boundary, host model và ownership `apps/web` vs `apps/portal`. **Không** mặc định chuyển quyền. Chốt cuối thuộc **coordinator gốc + architect** (và user khi đổi O13 host map).

---

## 0. Kết luận ngắn (executive)

1. **Hiện trạng:** staff admin + platform + Gate + attendee + marketing đang **một monolith Next** (`apps/web`), UI **custom D6 tokens** (không Ant Design). O13 đã chốt `vemoki.com` = marketing, `app.vemoki.com` = product (gồm `/admin`, `/gate`, `/platform`).
2. **Khả thi Ant Design trên stack hiện tại:** `antd@6.6.6` (npm, published 2026-10-12) peer `react>=18` — khớp React `19.3.1` / Next `16.4.2` đã pin. SSR App Router: official `@ant-design/nextjs-registry`. **Không** mặc định ProComponents / Umi / Ant Design Pro (peer ProComponents còn `antd^5`, chưa chứng minh antd 6).
3. **Portal host `portal.vemoki.com`:** hợp lý để tách **staff admin UX** khỏi attendee/marketing, nhưng là **mở rộng O13** → bắt buộc Task **architect** (cookie host-only, Keycloak clients, nginx, env) trước coding. Ownership package (`apps/web` host-aware vs `apps/portal` mới) **chưa chốt** — đề xuất options bên dưới.

---

## 1. Phạm vi & nguồn đã đọc

### 1.1 Docs bắt buộc

- `AGENTS.md`, [PRD](../PRD.md), [TECHNICAL-DESIGN](../TECHNICAL-DESIGN.md), [DECISION-LOG](../DECISION-LOG.md) (O07/O13), [ROADMAP](../ROADMAP.md)
- O13 handoff: [docs/architecture/o13-marketing-app-subdomain.md](../architecture/o13-marketing-app-subdomain.md)
- GTM research: [docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md](./VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md)
- Role: [docs/agents/roles/web.md](../agents/roles/web.md)

### 1.2 Source audit (line evidence)

| Hạng mục | Evidence |
| --- | --- |
| Stack pin | `apps/web/package.json` L1–31: `next@16.4.2`, `react@19.3.1`, `react-dom@19.3.1`, `@ticket/contracts` — **không** có `antd` |
| Exact versions | `.npmrc` L1: `save-exact=true` |
| Admin monolith | `apps/web/app/admin/admin-form.tsx` **2390** dòng; panels: `config-brand-panel.tsx`, `import-panel.tsx`, `notifications-panel.tsx`, `tenant-staff.tsx` |
| Host O13 | `apps/web/src/marketing/hosts.ts` L6–26: `DEFAULT_PRODUCT_ORIGIN=https://app.vemoki.com`; `PRODUCT_PATH_PREFIXES` gồm `/admin`, `/platform`, `/gate`, `/api/bff`… |
| Authz soft-guard | `apps/web/src/nav/staff-route-guard.ts` — `requireAdminCapabilityOrHome` / `requireGateCapabilityOrHome` (fail-closed) |
| Next headers | `apps/web/next.config.ts` L1–3: **empty config** — chưa CSP app-level |
| Cookie | `apps/web/src/oidc/cookies.ts` — `sameSite: 'lax'`, host-only (khớp O13 B2) |
| BFF admin | ~39 `route.ts` dưới `apps/web/app/api/bff/admin/` |
| UI hiện tại | `apps/web/app/globals.css` + `apps/web/src/ui/surface-state.tsx` — design system D6, không component lib |

### 1.3 Limitation công cụ

- **CRG** (`code-review-graph-ticket`): `list_graph_stats_tool` OK (~3888 nodes) nhưng graph build SHA lúc gọi (`141dba74…`) **≠** task HEAD `400ad87a…` → dùng graph chỉ định hướng; **line evidence lấy từ source + `rg`**.
- Không chạy runtime/benchmark trong Task này (non-goal); số bundle/perf dưới đây là **đề xuất đo**, không phải proof.

### 1.4 Nguồn Ant Design chính thức (truy cập 2026-10-18 UTC)

| Nguồn | URL | Ngày truy cập | Claim dùng được |
| --- | --- | --- | --- |
| npm `antd` latest | `https://registry.npmjs.org/antd` | 2026-10-18 | `dist-tags.latest` = **6.6.6**, time `2026-10-12T06:47:33.903Z`; peer `react`/`react-dom` `>=18.0.0`; dep `dayjs` `^1.11.11` |
| npm `@ant-design/nextjs-registry` | `https://registry.npmjs.org/@ant-design/nextjs-registry` | 2026-10-18 | **1.3.0** (2025-11-27); peer `antd>=5`, `next>=14`, `@ant-design/cssinjs>=1` |
| npm `@ant-design/pro-components` | `https://registry.npmjs.org/@ant-design/pro-components` | 2026-10-18 | **2.8.10**; peer **`antd: ^4.24.15 \|\| ^5.11.2`** — **không** khai báo antd 6 |
| Docs Use with Next.js | `https://ant.design/docs/react/use-with-next` | 2026-10-18 | App Router → `AntdRegistry` từ `@ant-design/nextjs-registry` để SSR CSS-in-JS |
| Docs i18n | `https://ant.design/docs/react/i18n` | 2026-10-18 | Locale **`vi_VN`** listed |
| Locale file | `https://unpkg.com/antd@6.6.6/es/locale/vi_VN.js` | 2026-10-18 | HTTP 200 |
| Component App | `https://ant.design/components/app` | 2026-10-18 | Bọc `App` + `App.useApp` thay static `message`/`modal`/`notification` dưới ConfigProvider |
| Compatible style | `https://ant.design/docs/react/compatible-style` | 2026-10-18 | `StyleProvider` / `hashPriority` khi xung đột specificity / layer |
| Registry README | `https://github.com/ant-design/nextjs-registry` | 2026-10-18 | `AntdRegistry` trong RootLayout App Router |

---

## 2. Bối cảnh sản phẩm & host map

### 2.1 Đã chốt (O13) — không đảo trong file này

| Host | Vai trò |
| --- | --- |
| `vemoki.com` (+ www) | Marketing / sales |
| `app.vemoki.com` | Product: auth, admin, redeem, gate, guest `/t/…`, platform (hiện tại) |
| `api.vemoki.com` / `auth.vemoki.com` | Nest / Keycloak (giữ) |

Invariant: cookie session **host-only** — **cấm** `Domain=.vemoki.com` (O07 / O13 B2).

### 2.2 Đề xuất mở rộng (chưa chốt)

| Host | Vai trò đề xuất | Ghi chú |
| --- | --- | --- |
| `vemoki.com` | Marketing | Giữ O13 |
| `app.vemoki.com` | Attendee + public product (redeem/claim/guest) + **có thể** Gate web | Thu hẹp product path |
| **`portal.vemoki.com`** | Staff **tenant admin** (+ optional platform console) + Ant Design | Subdomain mới — DNS/TLS/OIDC/nginx |

```text
Đề xuất (chờ architect/coordinator):
  vemoki.com          → marketing
  app.vemoki.com      → attendee / guest / redeem / claim (+ Gate? — §5)
  portal.vemoki.com   → /admin (+ /platform?) Ant Design staff UI
  api. / auth.        → giữ
```

**Không** tự deploy DNS. Wave architect phải cập nhật O13 (hoặc ADR portal) trước consumer.

---

## 3. Inventory UI hiện tại — reusable vs tách

### 3.1 Cây route `apps/web` (snapshot HEAD Task)

| Surface | Path | Audience | Gắn portal? |
| --- | --- | --- | --- |
| Marketing | `/marketing/*` (host apex) | Buyer | **Không** — giữ apex / D6 brand |
| Home / demo | `/` (product) | Mixed | Attendee host |
| Admin | `/admin` | Tenant staff | **Có** — mục tiêu AntD |
| Platform | `/platform` | Platform ops | **Có (khuyến nghị cùng portal)** hoặc slice riêng |
| Gate web | `/gate` | Day-of staff | **Đề xuất giữ `app.` hoặc iOS-first** — §5 |
| Redeem / claim / invite | `/redeem`, `/claim`, `/invite` | Guest | `app.` |
| Guest event | `/t/...` | Public | `app.` |
| Account | `/account` | Authenticated user | Thường `app.` (attendee self-serve) |
| Auth BFF | `/api/auth/*`, `/api/auth/platform/*` | Browser | Theo host session |
| Admin BFF | `/api/bff/admin/*` | Staff | Same-origin với portal |
| Gate BFF | `/api/bff/gate/*` | Gate | Same-origin với Gate host |
| Platform BFF | `/api/bff/platform/*` | Platform | Same-origin với platform host |

### 3.2 Admin jobs (UI) — `ADMIN_JOBS`

Từ `admin-form.tsx` L100–105:

| Job id | Label | Sections chính (UI) |
| --- | --- | --- |
| `setup` | Chuẩn bị | Tạo/list event, metadata & vòng đời, loại vé & nguồn, config/brand panel |
| `guests` | Khách & mã | Import CSV / invitations, quota |
| `gate` | Cổng | Báo cáo sự kiện (O12 counts), approve/deny redemption |
| `support` | Hỗ trợ | CS search/timeline/resend, export CSV, readiness |

Panels tách file (tái sử dụng logic cao):

- `ConfigBrandPanel`, `ImportPanel`, `NotificationsPanel`, `TenantStaffPanel`
- Interpreters thuần: `apps/web/src/admin/*` (~12k LOC subtree admin+BFF) — **nên giữ** khi đổi shell UI

### 3.3 Reusable vs rewrite khi AntD

| Lớp | Khuyến nghị |
| --- | --- |
| BFF routes + CSRF/`assertSameOrigin` | **Reuse** nguyên — authz không xuống client |
| Interpreters (`decide`, `export-job`, `import-job`, `cs`, `notifications`, `readiness`…) | **Reuse** — đổi presentation only |
| `AdminForm` 2390 dòng + native `<section>`/`<button>` | **Rewrite UI dần** theo job tab → AntD `Tabs`/`Table`/`Form`/`Upload` |
| D6 tokens / Syne / Be Vietnam (marketing + attendee) | **Giữ** trên `app.` + apex — **không** ép AntD theme toàn brand |
| Platform console (`platform-console.tsx` ~659 dòng) | Cùng wave AntD hoặc ngay sau admin |

**Không** wholesale rewrite toàn `apps/web`. **Không** Umi / Ant Design Pro scaffold mặc định.

---

## 4. API capabilities vs gap (server-side table)

### 4.1 Đã có cursor / filter (web BFF đã mirror)

| Capability | Evidence | Đủ cho AntD `Table` SSR? |
| --- | --- | --- |
| CS tickets `q` + `limit` + `cursor` | `apps/web/app/api/bff/admin/tickets/route.ts` L8–23; `src/admin/cs.ts` `ticketsListPath` | **Có** (cursor) |
| Notifications `cursor` | `.../notifications/route.ts` L10–18; `notificationsListUpstreamPath` | **Có** |
| Invitations `cursor`/`limit` | `src/admin/invitation.ts` | **Có** |
| Export job create/status/download + unknown | `export-job.ts` (`kind: 'unknown'`); UI `reuseUnclearKey` L109–121 | Pattern recovery **đã có** |
| Import preview/commit idempotent | `import-job.ts` L1–4 comment; tests `admin-import.test.ts` | **Giữ** khi đổi UI |

### 4.2 Gap / rủi ro cho “admin table chuẩn”

| Gap | Evidence | Impact AntD |
| --- | --- | --- |
| Events list **không** truyền cursor/limit ở BFF GET | `events/route.ts` GET L147–156 chỉ `tenantId` → `eventsListUpstreamPath` (`create-event.ts` L14–16: `/v1/tenants/{id}/events`) | Table lớn theo tenant → cần BE/contract **paginated list** trước UX ProTable-like |
| Filter đa cột (status/date range) chưa thống nhất mọi list | CS có `q`; events/report khác shape | Tránh fake client-filter trên full dump |
| Platform tenants list | `platform-console` + BFF platform | Audit riêng khi đưa vào portal |
| Search full-text tickets ngoài `q` | Chỉ `q` hiện có | PD + BE nếu cần facet |

**Preserve authz:** mọi mutate admin qua BFF + Origin/CSRF; Nest vẫn enforce permission/RLS. UI AntD **không** được coi capability từ chrome client là quyền thật (đã fail-closed ở `staff-route-guard` + upstream).

### 4.3 Async export / import — unknown recovery

Pattern hiện có (giữ khi migrate UI):

1. Timeout / 5xx / network → `unknown` — **không** tuyên bố success (`EXPORT_UNKNOWN` / `IMPORT_UNKNOWN`).
2. Retry mutate: tái dùng idempotency key khi fingerprint giống + lần trước `unclear` (`reuseUnclearKey`).
3. Poll status job; download chỉ khi `READY`.
4. Import: preview không ghi business state; commit idempotent theo revision/hash.

AntD `Upload`/`Progress` chỉ là shell — logic interpreter **bắt buộc** giữ + regression test (`admin-import`, `admin-cs-export`, `admin-decide`).

---

## 5. Gate & platform boundary (đề xuất — chưa chuyển quyền)

### 5.1 Gate web

| Option | Mô tả | Pros | Cons |
| --- | --- | --- | --- |
| **G1 (khuyến nghị tạm)** | Gate **ở lại `app.vemoki.com/gate`** (hoặc iOS staff primary per O02) | Tách portal = CRUD/config; Gate latency/offline khác admin; giảm blast AntD CSS vào scan UX | Staff dùng 2 host |
| **G2** | Gate chuyển `portal.vemoki.com/gate` | Một chỗ staff | Trộn day-of ops với back-office; cookie/portal session; AntD có thể nặng cho scan |
| **G3** | Gate **chỉ iOS** — web Gate deprecate dần | Khớp “app chung staff” O02 | Cần PD + evidence; không tự mở trong Task này |

**Đề xuất ghi nhận:** **G1** cho wave portal AntD đầu. Chốt chính thức = architect + PD + user.

### 5.2 Platform console

| Option | Đề xuất |
| --- | --- |
| **P1** | Cùng `portal.vemoki.com/platform` + client OIDC platform riêng (đã có `/api/auth/platform/*`) |
| **P2** | Host/ops riêng sau (không mở trong MVP portal) |

Khuyến nghị **P1** sau admin tenant ổn định — cùng AntD shell, khác session cookie name/host path nếu architect yêu cầu tách.

### 5.3 Attendee vs staff navigation

TECHNICAL-DESIGN đã yêu cầu tách nav trees (attendee vs staff). Portal host là cách mạnh nhất để **enforce boundary** (không lộ admin chrome trên attendee origin) — bổ sung soft-guard hiện tại.

---

## 6. Ant Design — compatibility & pin strategy

### 6.1 Ma trận tương thích (research, chưa install)

| Package | Latest nghiên cứu | Peer | Khớp repo? |
| --- | --- | --- | --- |
| `antd` | **6.6.6** | React >=18 | **Có** (React 19.3.1) |
| `@ant-design/nextjs-registry` | **1.3.0** | antd>=5, next>=14 | **Có** (Next 16.4.2) |
| `@ant-design/icons` | **6.3.4** | (theo registry) | Dùng tree-shake / import named |
| `@ant-design/cssinjs` | **2.1.2** | React >=16 | Kéo theo registry |
| `dayjs` | dep của antd `^1.11.11` | — | Locale VI: `dayjs/locale/vi` + `antd/locale/vi_VN` |
| `@ant-design/pro-components` | **2.8.10** | **antd ^4 \|\| ^5 only** | **Không** dùng mặc định với antd 6 |

### 6.2 Pin strategy (khớp repo)

1. Root `.npmrc`: `save-exact=true` — pin **exact** `antd@6.6.6`, `@ant-design/nextjs-registry@1.3.0`, `@ant-design/icons@…` khi được ủy quyền install (coordinator lockfile).
2. **Không** `^`/`~` trên deps runtime web.
3. Spike CI: `pnpm --filter @ticket/web …` typecheck + một page App Router có `AntdRegistry` trước merge rộng.
4. Upgrade: theo minor antd 6.x có changelog; major 7 = Task riêng.
5. **AntD thuần** (`Table`/`Form`/`Layout`/`Menu`/`Tabs`/`Upload`/`App`) thay ProComponents cho đến khi Pro peer hỗ trợ antd 6 **hoặc** pin antd 5 có chủ đích (không khuyến nghị xuống 5 nếu đã nhắm 6).

### 6.3 ConfigProvider / App / locale

```text
AntdRegistry
  └─ ConfigProvider locale={vi_VN} theme={portalToken} componentSize="middle"
       └─ App
            └─ PortalShell (Layout + Menu)
```

- Official: static `message`/`modal` có thể lệch theme → dùng `App` + hooks.
- `vi_VN` từ `antd/es/locale/vi_VN` (docs i18n + file unpkg 6.6.6).
- dayjs: set locale `vi` khi dùng DatePicker.

### 6.4 CSS scope / SSR / CSP

| Rủi ro | Mitigation đề xuất |
| --- | --- |
| FOUC / missing SSR styles | `AntdRegistry` trong layout **portal only** (không bọc marketing) |
| Xung đột D6 global CSS | Portal layout riêng; optional `StyleProvider hashPriority="high"` (docs compatible-style) |
| CSS-in-JS runtime + CSP | Hiện `next.config.ts` **trống** — trước prod portal: CSP `style-src` cần cho phép CSS-in-JS (nonce/hash hoặc policy có chủ đích). **Security reviewer** khi bật CSP |
| Bundle icons | Import named `@ant-design/icons`; cấm `import *` |
| Attendee bundle | AntD **không** vào root layout attendee — split route group / app riêng |

### 6.5 AntD thuần vs ProComponents vs Umi

| Hướng | Verdict |
| --- | --- |
| AntD thuần | **Chọn** cho wave 1 |
| ProComponents | **Trì hoãn** — peer antd 5; tránh lock lệch major |
| Umi / Ant Design Pro scaffold | **Không** — xung đột Next App Router + BFF đã có; wholesale rewrite |

---

## 7. Ownership: `apps/web` vs `apps/portal`

### 7.1 Options (coordinator/architect chốt)

| | **W1 — Host-aware trong `apps/web`** | **W2 — Package mới `apps/portal`** |
| --- | --- | --- |
| Ý tưởng | Thêm host `portal.`; route group `(portal)` + AntD; share `src/admin/*` + BFF | Next app riêng; copy/move admin routes; BFF portal-owned hoặc shared package |
| Pros | Ít lockfile churn; reuse BFF ngay; giống O13 A1 | Isolate AntD deps/CSS; CI/bundle tách attendee; ranh giới rõ |
| Cons | Rủi ro import AntD nhầm vào attendee; build monolith nặng | Coordinator: workspace + turbo + image/nginx; duplicate auth helpers nếu tách ẩu |
| Lockfile | Coordinator vẫn owner | Coordinator **bắt buộc** thêm workspace |

**Đề xuất wave đầu:** **W1** (spike + 1–2 màn AntD trên host portal hoặc path prefix) → nếu bundle/CSP/attendee regression xấu → **W2**.

**Root lockfile / `pnpm-workspace`:** luôn **coordinator**. Web worker không tự thêm package ngoài Task ủy quyền.

### 7.2 Session / OIDC sketch (architect điền ADR)

| Mục | Đề xuất thảo luận |
| --- | --- |
| Cookie | Host-only trên `portal.vemoki.com` — **không** share với `app.` |
| Client Keycloak | Tái dùng `ticket-web` **hoặc** client `ticket-admin-web` (O13 đã nhắc URI `/api/admin/auth/callback` chưa mirror trong app) — architect chọn 1 |
| Redirect | `https://portal.vemoki.com/api/auth/callback` (path thật sau spike) |
| CSRF allowlist | `WEB_PUBLIC_ORIGIN` / product origins **thêm** portal |
| Deep link email | Admin links → portal origin; attendee → app |

---

## 8. Work plan (roadmap) — chỉ docs/planning

### Wave 0 — Quyết định (architect ∥ coordinator, BA/PD nếu IA)

1. ADR/handoff: host `portal.vemoki.com` + Gate G1/G2 + Platform P1/P2 + W1/W2.
2. Cập nhật DECISION-LOG (user chốt nếu đổi O13 map).
3. Inventory contract: events list pagination — Task `backend` nếu thiếu.

### Wave 1 — Spike AntD (web, **sau** ủy quyền code; không nằm trong Task này)

1. Pin exact packages (coordinator lockfile).
2. Layout portal-only: `AntdRegistry` + `ConfigProvider` + `App` + `vi_VN`.
3. 1 màn đọc: CS tickets `Table` cursor (reuse BFF).
4. Đo bundle + headless a11y trước/sau (§9).
5. Không đụng marketing/attendee layouts.

### Wave 2 — Migrate admin jobs dần

Thứ tự đề xuất (risk thấp → cao):

1. Support (CS + export) — API cursor sẵn  
2. Guests (import/invitations) — giữ unknown/idempotency tests  
3. Setup (events/types/sources/config) — có thể cần BE pagination  
4. Notifications / reminders panels  
5. Platform console  

Mỗi slice: PR riêng ownership web; DoD + exact SHA; **không** gộp BE+web+iOS.

### Wave 3 — Host cutover portal

1. DNS/TLS/nginx `portal.` (coordinator, ủy quyền deploy).  
2. Keycloak redirect expand → switch → contract (như O13).  
3. Redirect `/admin` trên `app.` → `portal.` (302).  
4. UAT headless admin trên portal origin; security CSRF/origin.

### Wave 4 — Hardening

CSP portal, bundle budget, icon audit, remove dead native admin CSS, docs RUNBOOK.

---

## 9. Benchmarks / test budgets / regression (đề xuất đo — chưa chạy)

### 9.1 Trước / sau (bắt buộc khi có coding wave)

| Metric | Cách đo đề xuất | Budget đề xuất (chốt sau baseline) |
| --- | --- | --- |
| JS bundle route `/admin` | `next build` + client graph / `@next/bundle-analyzer` | Baseline monolith hiện tại → AntD không tăng > **X%** (đo rồi ghi) |
| LCP / TTI admin | Playwright headless + trace | Không xấu hơn baseline > ngưỡng PD |
| Unit | `pnpm --filter @ticket/web test` — giữ `admin-*.test.ts` | 0 regress unknown/idempotency |
| Routes | `test:routes` / UAT `admin-uat.mjs`, `d11-admin-workspace-uat.mjs` | Green trên SHA |
| A11y | `a11y-redeem-admin-gate-uat.mjs` + axe | Staff forms: label/focus/live region |
| Security | Origin/CSRF tests (`origin.test.ts`, gate/invite CSRF); portal origin allowlist | Fail-closed cross-origin |
| Authz | Soft-guard + upstream 403 | Chrome AntD không bypass |

### 9.2 Headless UAT / security regression

- Web: `scripts/web-uat.sh` / admin UAT scripts hiện có — mở rộng base URL portal khi cutover.
- **Không** headed Computer Use.
- Security-sensitive (cookie/OIDC/CSP): reviewer `reviewer-security` ≠ implementer.

### 9.3 Test inventory hiện có (giữ regression)

`admin-decide`, `admin-import`, `admin-cs-export`, `admin-notifications`, `admin-readiness`, `admin-report`, `admin-uat.mjs`, `admin-tenant2-e2e.mjs`, `d11-admin-workspace-uat.mjs`, `platform-shape`, `nav-capabilities`, `form-validate`, …

---

## 10. Rủi ro & non-goals nhắc lại

| Rủi ro | Mức | Mitigation |
| --- | --- | --- |
| Cookie `Domain=.vemoki.com` “cho tiện” | Cao | **Cấm** — O13 B2 |
| AntD vào root layout → phá marketing brand-test | Cao | Layout/route group / app tách |
| ProComponents + antd 6 | Trung | Không dùng đến khi peer hỗ trợ |
| Events list không paginate | Trung | BE Task trước table lớn |
| Coi UI migration = đổi authz/RLS | Cao | Không — Nest SoT |
| Tự mở payment/Android/Wallet/seat/SSO/billing/custom-domain | — | Ngoài scope |

---

## 11. Đề xuất sẵn sàng cho team (call-to-action)

| Role | Việc tiếp |
| --- | --- |
| **architect** | ADR portal host + session/OIDC/nginx; Gate G1 vs G2; W1 vs W2 |
| **coordinator** | User chốt host map nếu đổi O13; lockfile; DNS chỉ khi ủy quyền; spawn waves |
| **product-ba / product-design** | IA portal nav (jobs → AntD IA); Gate boundary UX; không redesign attendee |
| **backend** | Paginated/filter events (và gap list khác) nếu Wave 2 cần |
| **web** | Sau ADR + ủy quyền: spike AntD → migrate jobs; **không** sửa attendee brand |
| **reviewer-dod / security** | Exact SHA; CSRF/CSP/cookie; bundle/a11y budgets |
| **ios** | Ngoài scope portal web; Gate iOS giữ O02 — chỉ sync deep link nếu admin URL đổi |

---

## 12. Definition of Ready (để mở coding Epic)

- [ ] User/coordinator chốt: có dùng `portal.vemoki.com` hay chỉ AntD trên `app./admin`
- [ ] Architect ADR: cookie/OIDC/nginx/env + Gate/Platform boundary
- [ ] Ownership W1 vs W2 đã ghi DECISION-LOG
- [ ] BE gap pagination (nếu cần table events) đã có Issue hoặc accepted defer
- [ ] Baseline bundle + UAT admin đã ghi số (trước AntD)
- [ ] Task Spec web: pin versions exact; non-goals attendee/marketing; tests regression list

---

## 13. Appendix — lệnh research đã chạy (reproducible)

```bash
# Stack
python3 -c 'import json;print(json.load(open("apps/web/package.json"))["dependencies"])'
# npm registry (2026-10-18)
curl -sL https://registry.npmjs.org/antd | python3 -c 'import sys,json;m=json.load(sys.stdin);v=m["dist-tags"]["latest"];print(v,m["time"][v],m["versions"][v]["peerDependencies"])'
curl -sL https://registry.npmjs.org/@ant-design/nextjs-registry | python3 -c 'import sys,json;m=json.load(sys.stdin);v=m["dist-tags"]["latest"];print(v,m["time"][v],m["versions"][v]["peerDependencies"])'
curl -sL https://registry.npmjs.org/@ant-design/pro-components | python3 -c 'import sys,json;m=json.load(sys.stdin);v=m["dist-tags"]["latest"];print(v,m["versions"][v]["peerDependencies"])'
# Locale
curl -sI https://unpkg.com/antd@6.6.6/es/locale/vi_VN.js | head -1
```

Docs HTTP 200: `https://ant.design/docs/react/use-with-next`, `…/i18n`, `…/compatible-style`, `https://ant.design/components/app`.

---

*Hết báo cáo discovery. Không có thay đổi `apps/web`. Chờ coordinator/architect chốt host & ownership trước sóng coding.*
