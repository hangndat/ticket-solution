# VD11 — Portal initial review (menu persistence + design-system chrome)

**Ngày:** 2026-10-25 · **Reviewer:** James (`reviewer-merged` · DoD+UX) · **Independence:** session reviewer ≠ implementer Linh (`ctx_01e8ae6fb5a0`)  
**SHA reviewed:** `da30da437d9706f4fa713634b7bd1430338d6044` (`git rev-parse HEAD` @ `vd11-portal-recovery`)  
**Diff base:** `262d23a675a47b42db3a3c0f4e36c5d29760276d` → `da30da437d9706f4fa713634b7bd1430338d6044`  
**Scope:** `apps/portal/**` (UI only; Architecture impact: Không)  
**Design SoT:** `docs/design/vemoki-unified-v1/design-system/product/portal.html`, `portal-mobile.html`, `implementation/portal-antd-theme.ts` · token map `apps/portal/tests/evidence-vd11/TOKEN-MAP.md`

## Verdict (tách gate)

| Gate | Verdict | Ghi chú |
| --- | --- | --- |
| **DoD** | **FAIL** | Thiếu **authentic OIDC** staff-shell UAT trên SHA này (gate explicit, không waive). |
| **UI/UX** | **PASS with known gap** | Theme/sider/header + mocked route captures khớp prototype; gap = cùng F01 (reload/collapse sau login thật). |
| **Security** | **n/a** | Diff không đụng auth/BFF/secrets. |

**Fix round:** `0/2` (initial review).

## AC mapping

| AC | Đánh giá | Proof |
| --- | --- | --- |
| Sidebar groups ổn định qua deep event routes | **Code + unit PASS**; **runtime OIDC chưa chứng minh** | `portal-sider-open-keys.ts`, `portal-pro-layout.tsx`, `portal-sider-open-keys.test.ts`, `portal-menu-keys.test.ts`; mocked shell `actual-ops-audit-1024.png` (group `nav-event-run` mở, leaf chọn đúng ngữ cảnh). |
| Selection / collapse / reload | **Partial** | `sessionStorage` + `mergePortalSiderOpenKeys` + `motion: undefined` + `routeSyncRef` chặn ghi đè khi sync route; chưa reload browser sau staff login thật. |
| Primary `#7C4DED`, dark sider/header | **PASS** (supplemental) | `vemoki.ts` + `vemoki-theme.test.ts`; `actual-dashboard-readiness-1440.png`, `actual-auth-390.png`. |
| Authorization + real data | **Không đánh giá acceptance** | Mocked BFF trong `capture-screenshots.mjs` — supplemental only. |
| Small buttons / 390 overflow / input wrappers | **PASS** (mocked + CSS intent) | `globals.css` min-height 44; `actual-ticket-types-390.png`, `actual-auth-390.png` không thấy overflow ngang. |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal test` | **169/169 PASS** (~1.3s) |
| `pnpm --filter @ticket/portal build` | **PASS** (reviewer re-run sau HEAD pin) |
| Recorded build | `.next/BUILD_ID` present (build trước review); reviewer build xác nhận compile trên `da30da43` |
| vd08 API `http://127.0.0.1:3498/v1/health` | **200** (state `../vd08-local-oidc/.local-dev/vd08oidc`) |
| Keycloak `http://127.0.0.1:8080` | **302** (stack up) |
| CRG `detect_changes` (4 source files) | risk **0.60**; gaps `PortalProLayout`, persistence helpers (covered bởi unit tests mới) |
| Orca browser (embedded) | Tab `472ae741-b103-49ae-a468-ed8e1c4c25e3` → `http://127.0.0.1:3334/auth` · `snapshot` → heading **Vemoki Portal**, link **Đăng nhập nhân sự**, alert cookie copy (tab đã đóng) |
| Playwright evidence (committed) | `apps/portal/tests/evidence-vd11/*.png` + `checks.txt` — **mocked BFF**, không OIDC |

### Runtime reviewer (Orca UAT)

- **Port 3333:** `EADDRINUSE` (lean-ctx proxy); không kill process ngoài scope.
- **Port 3334:** `next start` trên build `da30da43`, `API_BASE_URL=http://127.0.0.1:3498`, env OIDC redirect vẫn **3013** (realm fixture không có `3333`/`3334` — không sửa provider).
- **Không** chạy staff login Keycloak → shell trên cổng reviewer (callback mismatch).

## Diff summary (logic)

- **`portal-sider-open-keys.ts`:** sanitize keys theo `PORTAL_NAV_GROUP_KEYS`, `sessionStorage`, merge ổn định thứ tự group.
- **`portal-pro-layout.tsx`:** hydrate persisted keys; sync route qua `mergePortalSiderOpenKeys`; `onOpenChange` persist; header trắng 64px; tắt menu motion; dark sider tokens giữ.
- **`vemoki.ts` / `globals.css`:** typography + control 44px; page header/form chrome; sider border; **không** đổi `colorPrimary`.

## Findings (`VD11-P-Fxx`)

| ID | Sev | Blocking | Vấn đề | Proof | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| **VD11-P-F01** | High | **Yes** | Thiếu **authentic OIDC** UAT: staff login → deep event routes → collapse/expand groups → **full page reload** với session thật (vd08 stack). Realm local chỉ đăng ký redirect `3013`; reviewer không đổi IdP; cổng `3333` bận; chỉ xác minh `/auth` trên `3334`. | `realm-ticket.local.json` redirect URIs `3013`; Orca snapshot `/auth` only; task gate «Missing authentic UAT… not waived». | Orca journey trên portal build SHA với OIDC thật + evidence reload/collapse (ảnh hoặc probe) trên cùng SHA. |
| **VD11-P-F02** | Low | No | Evidence script không stub một số BFF (vd. ticket types) → capture **«Chưa rõ kết quả»**; không chứng minh loaded table chrome. | `actual-ticket-types-390.png`; `capture-screenshots.mjs` routes list. | Bổ sung stub hoặc OIDC UAT trên data thật; re-capture route có rows. |
| **VD11-P-F03** | Low | No | `.portal-main-surface .ant-btn { min-height: 44px }` áp cả `size="small"` trong main — dense ops tables có thể cao hơn prototype table actions. | `globals.css` L236–241; `TOKEN-MAP.md` controlHeight 44. | Product chấp nhận touch target 44px **hoặc** scope rule `.ant-btn:not(.ant-btn-sm)`. |

### Closure / non-findings

- **Primary / sider:** Khớp `portal-antd-theme.ts` (`#7C4DED`, sider `#0B1027`) — tests + `actual-dashboard-readiness-1440.png`.
- **Menu key resolution:** `resolvePortalMenuKeys` + tests cho nested paths (`guests/pending` → parent `nav-event-setup`).
- **Authz paths:** Không regression trong diff; deny state hiển thị đúng copy server (`actual-ops-audit-390.png`).

## Evidence limits (bắt buộc)

1. `apps/portal/tests/evidence-vd11/**` = Playwright + **mocked** `api/bff/*` — supplemental visual, **not** Orca acceptance, **not** real OIDC.
2. So sánh prototype: đã đối chiếu `prototype-portal-mobile-390.png` (marketing-style mock dashboard) với **actual** shell routes — mobile collapsed chrome khác layout prototype (ProLayout responsive); không fail chỉ vì prototype là static demo.
3. **PASS UI** dựa trên token map + route/state trong PNG committed + code/tests; **FAIL DoD** vì F01.

## Tái hiện

```bash
cd /Users/admin/SideProject/ticket-solution/vd11-portal-recovery
git checkout da30da437d9706f4fa713634b7bd1430338d6044
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build
pnpm --filter @ticket/portal test && pnpm --filter @ticket/portal build
# vd08 stack (sibling checkout): UI869_DEV_STATE_DIR=.../vd08-local-oidc/.local-dev/vd08oidc
# Portal OIDC UAT: use registered :3013 redirect URIs or extend realm (out of this review scope)
orca tab create --url http://127.0.0.1:3334/auth   # if next start on 3334 with vd08 API
```

## Coordinator

- Chặn **acceptance complete** / pilot cho VD11 portal initial cho đến khi đóng **VD11-P-F01** với Orca + OIDC thật trên exact SHA.
- UI merge có thể tiếp tục nếu policy chấp nhận known gap; DoD gate vẫn **FAIL** tại artifact này.
