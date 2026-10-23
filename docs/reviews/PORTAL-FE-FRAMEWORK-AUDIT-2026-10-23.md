# Portal FE framework audit — Assessment B (kỹ thuật / mechanical)

> **Đối chiếu coordinator:** Đây là assessment đầu vào. [Bản tổng hợp sau kiểm chứng](./PORTAL-AUDIT-2026-10-23.md) §4 phân loại lại các nhận xét chưa đủ bằng chứng, gồm dead-state, hashed/nonce, dropdown semantics và giới hạn detector. Không xem mọi PFE là bug đã xác nhận hoặc acceptance bắt buộc.

| Trường | Giá trị |
| --- | --- |
| **SHA (exact)** | `b34187919ade8ab5e07efcab59ac0284097c663d` |
| **Worktree** | `/Users/admin/orca/workspaces/main/portal-audit-832-fe` |
| **Phạm vi** | `apps/portal/**` (+ đọc `@ticket/contracts` / `@ticket/web-session` khi truy import) |
| **Độc lập** | Assessment B (Higo · web) — **không** đọc report Assessment A (Mira · UX); coordinator hợp nhất sau |
| **Neo quyết định** | O16 (`ANTD-CORE-FIRST`, portal tách host), ADR-20, [ADR-PORTAL-PRO-COMPONENTS](../architecture/ADR-PORTAL-PRO-COMPONENTS.md), handoff [PORTAL-PRO-REVAMP](../design/PORTAL-PRO-REVAMP.md) (Pro* trên App Router, không Umi) |
| **Không claim** | Security audit toàn repo, production/pilot PASS, runtime UX sign-off |
| **Artifacts lệnh** | [`docs/reviews/assets/portal-audit-2026-10-23/fe/`](./assets/portal-audit-2026-10-23/fe/) |

Mọi số đo có thể chạy lại bằng lệnh ở [Phụ lục A](#phụ-lục-a--lệnh-đo-lại).

---

## 0. TL;DR

1. **Stack khớp ADR Pro:** Next **16.4.2**, React **19.3.1**, `antd` **6.6.6** (exact), `@ant-design/nextjs-registry` **1.3.0**, `@ant-design/pro-components` **3.1.15-7** (exact, pre-release). SSR qua `AntdRegistry` + `ConfigProvider` / `ProConfigProvider` (`hashed={false}`).
2. **Pro* đã dùng thật:** `ProLayout` bọc shell; `PageContainer` qua `PortalPage` trên **17/22** route `page.tsx` ops; `ProTable` **7** file; `ProForm` / `ModalForm` trên config/types/sources; `StatisticCard` trên dashboard/event/gate/quota. **7** panel ops vẫn dùng `Table` antd thuần — lệch pattern ADR «ưu tiên ProTable».
3. **Client boundary nặng:** **22/22** `app/**/page.tsx` là `'use client'`; **39/40** file `.tsx` client. Chỉ `app/layout.tsx` giữ RSC (font + `AntdRegistry`). Đây là trade-off Ant Design 6 + App Router, không bug tự thân nhưng ảnh hưở bundle/TTFB.
4. **Chất lượng kỹ thuật đo được:** Sau `pnpm --filter @ticket/contracts build` + `@ticket/web-session build` trên checkout gốc: **130/130** test portal, **eslint --max-warnings 0** pass, **tsc --noEmit** pass. Lần chạy đầu (chưa build workspace packages) fail MODULE_NOT_FOUND — hạn chế môi trường, không phải lỗi source trên SHA.
5. **Impeccable `detect` (source):** 186 file quét regex-only, JSON `[]`; tool khuyến nghị URL runtime — **không** chạy (port **3413** thuộc Assessment A; không mở server). Finding visual/a11y runtime = **undercount**.
6. **Không đề xuất** migrate Tailwind/`apps/web` consumer sang portal; giữ AntD.

---

## 1. Hiện trạng stack (installed vs used)

| Layer | Đã cài (exact / lockfile) | Dùng thực tế (đếm reproducible) |
| --- | --- | --- |
| Framework | `next@16.4.2`, `react@19.3.1` | App Router; `next.config.ts` CSP portal riêng |
| Ant Design core | `antd@6.6.6` | **36** file import `antd`; top: `Button`(22), `Alert`(18), `Space`(12), `Table`(6) |
| Pro Components | `@ant-design/pro-components@3.1.15-7` | **22** file import; `ProTable`(7), `ProFormText`(5), `ProCard`(5), `StatisticCard`(4), `ProLayout`(1), `PageContainer`(1 wrapper) |
| Icons | **Không** khai báo `@ant-design/icons` | **0** import — menu/logo text, không phụ thuộc icon pack |
| CSS-in-JS / SSR | `@ant-design/nextjs-registry@1.3.0` (lock kéo `@ant-design/cssinjs@2.1.2`) | `app/layout.tsx` → `AntdRegistry`; `providers.tsx` → `ProConfigProvider hashed={false}` |
| Theme | `src/theme/vemoki.ts` + `app/globals.css` `:root` | `ConfigProvider theme={vemokiTheme}`; CSS global **72** dòng (skip-link, loading spinner, focus-visible) |
| Locale / time | `antd/locale` vi_VN + en_US; **không** `dayjs` dep | Locale cookie SSR `readPortalLocaleFromServerCookies`; antd locale bridge client |
| HTML thô | — | **0** `<button>`, **0** `<table>`, **0** `<form>` trong `.tsx` |
| Inline style | — | **102** `style={{` (chủ yếu layout ProLayout/ops) |
| `!important` | — | **0** trong `apps/portal` |
| Custom CSS tay | `globals.css` only | Không `*.module.css`; token hex chủ yếu trong `vemoki.ts` + mirror CSS vars |

**Nguyên nhân gốc (framework):** ADR chọn Pro **lẻ** trên App Router (không Umi); antd 6 + registry buộc phần lớn route thành client components; ops panels sinh trước wave ProTable vẫn giữ `Table` antd.

---

## 2. Findings (`PFE-xxx`)

Quy ước impact: **P0** ship-blocker kỹ thuật đã verify · **P1** rủi ro cao / lệch ADR · **P2** consistency / a11y / perf · **P3** hygiene / cải thiện.  
Loại: **Bug** (verify) · **Risk** (source-only) · **Improvement**.

### PFE-001 · P2 · Risk · Impeccable source scan không thay runtime audit

- **Evidence:** `impeccable detect apps/portal` → stdout `[]`; stderr: *186 files scanned with regex matching only*; rules cần parsed page (contrast, tiny-text…) **không chạy**. Log: `assets/.../impeccable-detect-text.txt`.
- **Root cause:** Task cấm mở dev server port 3413; không URL/CDP ngoài Orca browser.
- **Recommendation:** Coordinator/Mira: một pass `impeccable detect http://127.0.0.1:3413/...` (hoặc prod smoke read-only) sau Assessment A; gắn JSON vào evidence wave.
- **Owner:** Coordinator + Assessment A
- **Closure:** Artifact JSON runtime + 0 violation trên route đại diện (tenant home, members, platform).

### PFE-002 · P2 · Improvement · Hai stack bảng: ProTable vs antd `Table`

- **Evidence:** `ProTable` / `PortalCursorProTable`: 7 file (`events`, `members`, `platform`, `analytics`, `config`, `types`, `sources`). `Table` antd: 7 file `src/ops/panels/*-panel.tsx` (audit, codes, cs, export, import, notifications, pending).
- **Root cause:** Panels ops scaffold sớm; wave Pro chưa migrate hết.
- **Recommendation:** Wave WP-PT1: wrapper `PortalOpsTable` (ProTable + column preset) thay `Table` từng panel; giữ cursor/search contract BFF.
- **Owner:** Web portal
- **Closure:** `rg "<Table" apps/portal/src/ops/panels` → 0; parity UAT filter toolbar.

### PFE-003 · P2 · Risk · Toàn bộ `page.tsx` là Client Component

- **Evidence:** 22/22 `app/**/page.tsx` bắt đầu `'use client'` (`inventory3.log`). Chỉ `app/layout.tsx` server (metadata, font, registry).
- **Root cause:** Pattern hiện tại: data fetch + antd/Pro trên cùng file route.
- **Recommendation:** Không refactor hàng loạt trước pilot; khi tối ưu: tách Server Component page + client child islands cho static chrome; đo bundle `@next/bundle-analyzer` trên route nặng (`members`, `platform`).
- **Owner:** Web portal + architect (nếu đổi pattern)
- **Closure:** Document bundle budget; optional RSC split 1 pilot route.

### PFE-004 · P3 · Improvement · Token brand lặp (`vemoki.ts` vs `globals.css` vs fallback hex)

- **Evidence:** `VEMOKI_COLORS` trong `src/theme/vemoki.ts:4-8`; mirror `--vemoki-*` trong `app/globals.css:1-6`; fallback `primaryColor: '#9b3a18'` trong `config/page.tsx`, `onboarding/[tenantId]/page.tsx`, placeholder settings — không import `VEMOKI_COLORS`.
- **Root cause:** CSS global cho skip-link/spinner; form default tách khỏi theme module.
- **Recommendation:** Export `VEMOKI_COLORS.signal` cho placeholder/default; hoặc generate CSS vars từ một module (không bắt buộc đồng bộ `brand/vemoki/tokens.json` trong audit này).
- **Owner:** Web portal
- **Closure:** `rg "#9b3a18" apps/portal` chỉ còn `vemoki.ts` + test fixtures (hoặc documented exceptions).

### PFE-005 · P3 · Improvement · State chết `selectedTenantId` / `selectedEventId` trong shell

- **Evidence:** `portal-shell.tsx:56-57` — `useState` khởi tạo từ path, **không** có `setSelectedTenantId`; `effectiveTenantId = pathTenantId ?? selectedTenantId` luôn ưu tiên URL.
- **Root cause:** Refactor «align with URL without effect»; state thừa.
- **Recommendation:** Xóa state thừa hoặc dùng cho optimistic UI nếu product cần.
- **Owner:** Web portal
- **Closure:** Lint/rule hoặc xóa biến; không behavior change.

### PFE-006 · P2 · Risk · `ProConfigProvider hashed={false}`

- **Evidence:** `providers.tsx:44` — `hashed={false}`.
- **Root cause:** Thường dùng để tránh mismatch hash SSR/client với Pro + antd 6; trade-off tăng style injection / specificity.
- **Recommendation:** Giữ cho đến khi có nonce pipeline (ghi trong `next.config.ts` comment CSP đã nhắc StyleProvider nonce). Theo dõi release Pro 3.1.x.
- **Owner:** Web portal
- **Closure:** ADR note hoặc comment «accepted» + không regression flash trên UAT shell.

### PFE-007 · P2 · Improvement · A11y: menu account thiếu semantics dropdown

- **Evidence:** `portal-pro-layout.tsx:176-178` — `Dropdown` + `Button type="text"` không `aria-haspopup` / `aria-expanded` (antd có thể bổ sung nội bộ — **chưa verify runtime**).
- **Recommendation:** Dùng `Dropdown` `trigger={['click']}` với `Button` `aria-label={t('shell.account.menu')}`; verify bằng axe trên shell (Assessment A).
- **Owner:** Web portal
- **Closure:** axe 0 trên header chrome.

### PFE-008 · P3 · Improvement · `aria-label` hardcoded EN trên export panel

- **Evidence:** `export-panel.tsx:241` — `aria-label="exportId"` (không qua `t()`).
- **Recommendation:** Thêm key i18n VI/EN.
- **Owner:** Web portal
- **Closure:** `rg 'aria-label="' apps/portal` không còn string EN thô (trừ test).

### PFE-009 · P3 · Improvement · `axe-core` devDep, coverage hẹp

- **Evidence:** `package.json` `axe-core@4.14.0`; test thực tế: `ops-filters.test.ts` assert HTML fixture có `portal-skip-link` (regex), không chạy axe engine trên DOM app.
- **Recommendation:** 1 test integration nhẹ axe trên fixture hoặc Playwright portal (ngoài scope audit — coordinator).
- **Owner:** Web portal / QA
- **Closure:** CI step optional `axe` trên 1 route.

### PFE-010 · P3 · Improvement · Inline `style={{` density (102)

- **Evidence:** count trong `inventory2.log`; ProLayout `contentStyle`, `Select minWidth`, ops panels.
- **Recommendation:** Chuyển spacing lặp sang `theme.useToken()` / Pro `token` props khi touch panel; không drive-by refactor.
- **Owner:** Web portal
- **Closure:** Optional metric cap khi sửa panel.

### Đã xem xét — không nâng finding

| Chủ đề | Lý do |
| --- | --- |
| `dayjs` missing | antd 6 locale không bắt buộc dayjs trong portal; không thấy `DatePicker` usage |
| `@ant-design/icons` missing | Không import; không evidence broken UI trên source |
| `suppressHydrationWarning` body/html | Pattern phổ biến font + antd SSR |
| `portal-fetch` không abort on unmount | Panels dùng `cancelled` flag; shell discovery one-shot — **risk thấp** (race nếu navigate cực nhanh) |

---

## 3. Điểm mạnh (framework)

- **SSR/CSS:** `AntdRegistry` ở root; CSP portal tách `apps/web` (`next.config.ts`).
- **Fetch layer:** `portal-fetch.ts` — timeout, `AbortController`, `cache: 'no-store'`, CSRF trên mutate/multipart.
- **Shell discovery:** `loadShellContext` dedupe inflight (`load-shell-context.ts:64-142`); deny-by-default capabilities (test `capabilities.test.ts`).
- **Chuẩn page ops:** `PortalPage` → `PageContainer` thống nhất padding/title/loading.
- **Surface UX kỹ thuật:** `SurfaceState` + `role="status"` loading; skip link `#portal-main` + contract `a11y-contracts.ts`.
- **i18n:** Catalog parity test VI/EN; SSR `lang` từ cookie.
- **Tests:** Interpreter ops (audit/codes/export), OIDC verify, saved-views isolation — **regex/behavior**, không chỉ snapshot CSS.

---

## 4. Quyết định PD / coordinator còn thiếu (không block audit B)

| ID | Câu hỏi | Gợi ý kỹ thuật |
| --- | --- | --- |
| D-PORTAL-TABLE | ProTable bắt buộc cho **tất cả** ops panels hay cho phép `Table` antd cho cursor đơn giản? | ADR nói «ưu tiên» — khuyến nghị ProTable wrapper để filter/toolbar đồng nhất |
| D-PORTAL-RSC | Có target % RSC route portal post-pilot? | Document «client-first» hiện tại |
| D-PORTAL-AXE | Ngưỡng axe CI (route list) | Sau runtime detect Assessment A |

---

## 5. Đề xuất wave sửa (chưa triển khai)

| Wave | Phạm vi | Deps thật | Effort |
| --- | --- | --- | --- |
| **WP-PT1** | Migrate 7 ops panels `Table` → `PortalCursorProTable` / ProTable | Không thêm dep | M |
| **WP-A11Y-1** | i18n aria export; account dropdown labels; axe fixture | `axe-core` đã có | S |
| **WP-TOKEN-1** | Gom fallback `#9b3a18` → `VEMOKI_COLORS` | Không | S |
| **WP-DETECT-1** | Runtime impeccable + screenshot shell | Cần URL Assessment A | S (coord) |
| **WP-SHELL-1** | Xóa dead state tenant/event | Không | S |

---

## 6. Trạng thái checks (SHA `b34187919ade…`)

| Check | Kết quả | Ghi chú |
| --- | --- | --- |
| `pnpm --filter @ticket/portal test` | **PASS** 130/130 | Sau build `@ticket/contracts` + `@ticket/web-session` tại `/Users/admin/orca/workspaces/main/portal-audit` |
| `pnpm --filter @ticket/portal typecheck` | **PASS** | Cùng điều kiện |
| `pnpm --filter @ticket/portal lint` | **PASS** | `eslint . --max-warnings 0` |
| `pnpm --filter @ticket/portal build` | **Không chạy** | Tránh tốn CI local; typecheck + test đủ mechanical signal |
| Browser / Orca UAT | **Không chạy** | Port 3413 Assessment A; không auth runtime trong worker B |
| Impeccable detect (source) | **0 JSON findings** | Undercount — xem PFE-001 |

---

## Phụ lục A — Lệnh đo lại

```bash
SHA=b34187919ade8ab5e07efcab59ac0284097c663d
ROOT=/Users/admin/orca/workspaces/main/portal-audit-832-fe
PORTAL=$ROOT/apps/portal

# Deps exact
node -e "const p=require('$PORTAL/package.json'); const d={...p.dependencies,...p.devDependencies}; ['next','react','antd','@ant-design/pro-components','@ant-design/nextjs-registry'].forEach(k=>console.log(k, d[k]))"

# Import counts
rg -l "from ['\"]antd" --glob '*.{ts,tsx}' $PORTAL | wc -l
rg -l "@ant-design/pro-components" --glob '*.{ts,tsx}' $PORTAL | wc -l

# Pro symbols (files)
for sym in ProLayout PageContainer ProTable ProForm StatisticCard; do
  echo -n "$sym "; rg -l "$sym" --glob '*.{ts,tsx}' $PORTAL | wc -l
done

# Client boundary
find $PORTAL/app -name 'page.tsx' | wc -l
rg -l "^['\"]use client" --glob '*.tsx' $PORTAL | wc -l

# Hygiene
rg -c 'style=\{\{' --glob '*.tsx' $PORTAL | awk -F: '{s+=$2} END{print s+0}'
rg '!important' $PORTAL | wc -l

# Tests (cần workspace packages built)
cd /Users/admin/orca/workspaces/main/portal-audit
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web-session build
pnpm --filter @ticket/portal test
pnpm --filter @ticket/portal typecheck
pnpm --filter @ticket/portal lint

# Impeccable (source)
~/.cursor/skills/impeccable/scripts/impeccable detect --json $PORTAL
# Runtime (khi server sẵn):
# impeccable detect http://127.0.0.1:3413/
```

---

## Phụ lục B — Giới hạn audit

- Không commit/push; không đụng `apps/web` Tailwind consumer.
- Runtime visual/a11y phụ thuộc Assessment A + impeccable URL.
- Typecheck/test trên checkout gốc `portal-audit` sau build workspace packages — worktree child có thể thiếu `dist` tương tự.
- Code-review-graph FE stale (2026-10-20) — audit dùng `rg`/source trực tiếp trên SHA.

---

*Báo cáo Assessment B — framework/mechanical. UX/visual verdict thuộc Assessment A.*
