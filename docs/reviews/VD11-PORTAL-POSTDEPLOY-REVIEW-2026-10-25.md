# VD11 Portal — post-deploy review (P-F05 revalidate + context cache)

**Ngày:** 2026-10-25 · **Reviewer:** James (`reviewer-merged` · DoD+UX) · **Persona:** `james`  
**Independence:** reviewer session ≠ implementer Linh (`ctx_2201d5d53bfb` / `ctx_84e1b75fbcbe`)  
**SHA reviewed:** `7109fc5ae23c4cb4bbf3f7d85805ec8a73cc449a` (`git rev-parse HEAD` @ `hangndat/vd11-integration`)  
**Diff base:** `40894715ebe3a1c27f8bb3f7f7b1dc3b36e2e335` → `7109fc5ae23c4cb4bbf3f7d85805ec8a73cc449a`  
**Scope:** `apps/portal/**` only (Architecture impact: Không)  
**AC:** [VD11-PORTAL-POSTDEPLOY-AC-2026-10-25.md](./VD11-PORTAL-POSTDEPLOY-AC-2026-10-25.md) · P-F05 checkpoint [VD11-PORTAL-P05-2026-10-25.md](./VD11-PORTAL-P05-2026-10-25.md)

## Verdict (tách gate)

| Gate | Verdict | Ghi chú |
| --- | --- | --- |
| **DoD** | **FAIL** | Context-cache AC: **clear event** qua UI không đạt (C-F01). Unit/integration logic khác vẫn pass. |
| **UI/UX** | **PASS** (P-F05) · **FAIL** (cache clear) | P-F05 revalidate **PASS** sau lượt ngoại lệ 1/1. Event Select clear = route/storage lỗi (C-F01). |
| **Security** | **n/a** | Không đổi auth/BFF; cache chỉ UUID prefs theo subject. |

**P-F05 fix round:** 2/2 + ngoại lệ 1/1 đã dùng — **revalidate PASS**, không mở lượt mới.  
**Context cache fix round:** **0/2** (implementation đầu) — **C-F01**, **C-F02** mở.

## Tóm tắt (≤3 câu)

P-F05 đã đúng: `PortalContentTheme` bọc context strip + account menu; OIDC local UAT cho thấy dropdown tổ chức/sự kiện và menu tài khoản nền sáng, chữ đọc được. Module `context-cache` + tests pass trên SHA này, home redirect nhớ tenant khi event đã clear qua route org. **Chặn DoD:** bấm clear trên event Select đẩy `/t/{tenant}/e/undefined`, storage không clear theo AC; cần fix `portal-context-strip` (guard `onChange`) và rà `portal-shell` fallback `selectedEventId`.

## AC mapping

| AC | Đánh giá | Proof |
| --- | --- | --- |
| P-F05 tenant/event popup + account menu light; sidebar tối | **PASS** | Code `portal-pro-layout.tsx` + `portal-content-theme.tsx`; Orca UAT ảnh tenant/event dropdown + account menu (profile `b520d43d-9c3a-4fd6-8251-84726661a16c`, `:3334`). |
| P-F05 390/1024/1440, keyboard | **GAP** | Embedded browser không resize xuống 390 (eval `clientWidth` ~731); chưa probe keyboard-only trên popup — không fail P-F05 vì đã chứng minh root cause đã sửa tại desktop. |
| Cache keyed by verified userId; validate discovery | **PASS** | `storage.ts`, `validate.ts`, `use-portal-user-id.ts`; tests `context-cache.test.ts`. |
| Home restore hợp lệ; URL thắng cache | **PASS** | `app/page.tsx` + `resolve.ts`; UAT `goto /` → `/t/d9d9f001-…0001` (không `/e/` khi `eventByTenant` null). |
| Clear event → UI + storage + reload | **FAIL** | C-F01: clear Select → `/e/undefined`, `localStorage` vẫn giữ event UUID. |
| Đổi tenant không mang event tenant cũ | **PASS** (code + tests) | `validatePortalContextCache` test «does not apply another tenant event». |
| Org subroute giữ event hợp lệ | **PASS** | `persist.ts` + test «keeps event on org subroutes». |

## Checks (exact SHA `7109fc5a`)

| Check | Kết quả | Ghi chú |
| --- | --- | --- |
| `pnpm --filter @ticket/portal test` | **181/181 PASS** | Reviewer re-run; gồm `context-cache.test.ts` (12 cases). |
| `pnpm --filter @ticket/portal exec tsc --noEmit` | **PASS** | Reviewer re-run. |
| `pnpm --filter @ticket/portal build` | **PASS** | Reviewer re-run. |
| `pnpm --filter @ticket/portal lint` | **FAIL** | 2× `react-hooks/set-state-in-effect` `portal-pro-layout.tsx` L63/L68; 1× `@next/next/no-img-element` — **đã có trước diff cache** (P05 fix doc). |
| Coordinator build claim @7109 | **Khớp** | test/typecheck/build reviewer xác nhận trên cùng SHA. |

## Authentic browser UAT (Orca)

- **Rule:** `.cursor/rules/uat-headless.mdc` — embedded tab only, không mock auth.
- **Server:** `http://127.0.0.1:3334` (coordinator build 7109).
- **Profile:** `b520d43d-9c3a-4fd6-8251-84726661a16c` (VD11 P05 local OIDC, synthetic Owner).
- **Tab:** `f0df5cd9-dc3d-4397-8625-a14eff7dad47` (reviewer-created sau tab coordinator đóng).

| Journey | Lệnh / kết quả |
| --- | --- |
| Tenant dropdown readable | `click` combobox Tổ chức → screenshot `p05-tenant-dropdown.png` (light popup). |
| Event dropdown readable | `click` combobox Sự kiện → screenshot `p05-event-dropdown.png`. |
| Account menu readable | `click` «Tài khoản ▾» → screenshot (menu sáng, copy đọc được). |
| Deep link event + clear | `goto` …`/e/d9d9f001-…0002` → `eval` click `.ant-select-clear` → URL **`…/e/undefined`**, storage vẫn `eventByTenant[tenant]=…0002`. |
| Org home persist clear | `goto` …`/t/…0001` → storage `eventByTenant[tenant]=null`; `goto /` → redirect tenant home (không event). |

Artifacts (gitignored): `apps/portal/.uat-artifacts/vd11-postdeploy-2026-10-25/p05-*.png` — copy từ Orca screenshot paths trong session.

## Findings

| ID | Sev | Blocking | Vấn đề | Proof | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| **P-F05** | — | — | Dropdown shell tối | **Đóng — PASS** | Revalidate SHA `7109fc5a`; boundary `PortalContentTheme`; UAT ảnh trên. |
| **C-F01** | **High** | **Yes** | Event `Select` `allowClear`: Ant gọi `onChange(undefined)` → `router.push(\`/t/${tenant}/e/${value}\`)` → **`/e/undefined`**; `onClear` không chạy đủ; storage không null theo AC clear. | `portal-context-strip.tsx` L78–88; UAT eval + `localStorage` JSON trên tab trên. | Guard `onChange` (`if (!value) return` hoặc chỉ push khi UUID hợp lệ); UAT: clear → `/t/{tenant}` only, combobox placeholder, storage `null`, reload `/` không restore event. |
| **C-F02** | Medium | No (đi kèm C-F01) | `portal-shell.tsx` `selectedEventId`/`selectedTenantId` khởi tạo `useState(path*)` **không sync** pathname — fallback `effectiveEventId` có thể giữ event sau clear khi user deep-link `/e/…` lần đầu. | L71–72, L133–134; không có test React integration. | Derive từ `pathname` hoặc bỏ fallback stale; thêm test/e2e clear sau deep link. |

## Diff summary (reviewer)

- **P-F05:** `portal-pro-layout.tsx` — gộp strip + main trong `PortalContentTheme`; account `Dropdown` bọc theme riêng.
- **Cache:** `context-cache/*` (storage, validate, resolve, persist), `app/page.tsx` home redirect, `portal-shell.tsx` read/persist cache.
- **Tests:** `tests/context-cache.test.ts` (+264 lines) — không cover Ant Select clear interaction.

## Evidence limits

- Không mở lại auth review VD11 cũ ngoài diff.
- Viewport 390/1440 chưa có screenshot Orca (resize không áp dụng trong tab embedded).
- Lint fail không gán mới cho cache module; vẫn ghi DoD gap nếu gate release bắt lint xanh toàn package.

## Tái hiện (reviewer)

```bash
cd /Users/admin/SideProject/ticket-solution/vd11-integration
git checkout 7109fc5ae23c4cb4bbf3f7d85805ec8a73cc449a
pnpm --filter @ticket/portal test
pnpm --filter @ticket/portal build
# Portal :3334 + OIDC profile VD11 — orca tab create --profile b520d43d-…
```
