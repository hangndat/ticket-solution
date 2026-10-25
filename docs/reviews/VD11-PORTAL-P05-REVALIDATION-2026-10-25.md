# VD11 Portal P-F05 — Revalidation (follow-up SHA)

**Ngày:** 2026-10-25 · **Reviewer:** James (`dod+ux` · `reviewer-merged`) · **Employee:** james  
**Independence:** reviewer session ≠ implementer `hangndat <hangndat@gmail.com>` (commit `76a015c5`)  
**Exact SHA:** `76a015c58202bcc7faa885ab1f15106f54751dcd` (`git rev-parse HEAD` @ `hangndat/vd11-portal-theme-release`)  
**Prior artifact:** [VD11-PORTAL-P05-INDEPENDENT-REVIEW-2026-10-25.md](./VD11-PORTAL-P05-INDEPENDENT-REVIEW-2026-10-25.md) @ `569243ed803bfe18f6bb56ef4f50731ea244c5b0` — **PASS** DoD + UX  
**Revalidation scope:** `365bf9d8..76a015c5` — **chỉ** `apps/portal/src/components/portal-content-theme.tsx` (nested `inherit: false` + reduced-motion tokens). Không review lại Epic/cache (user đã hủy cache).  
**Architecture impact:** Không · **Fix round:** revalidation follow-up `1/2` (không mở rộng scope)

## Verdict (tách gate)

| Gate | Verdict | Ghi chú |
| --- | --- | --- |
| **DoD** | **PASS** | Diff hẹp đúng AC follow-up; `typecheck` + `169/169` test + `build` xanh trên SHA; không push/PR/deploy. |
| **UI/UX** | **PASS** | Popup/sider regression: token màu không đổi trong diff; runtime :3334 mở tenant listbox + sider menu; coordinator đã spot-check popup sáng / sider navy trên build `76a015c5`. |
| **Security** | **n/a** | Không đụng auth/BFF. |

## Diff (follow-up)

Commit `76a015c5` — `fix(portal): preserve reduced motion in light theme boundary`:

- Thêm `matchMedia('(prefers-reduced-motion: reduce)')` + state sync (cùng pattern `providers.tsx` `AntdLocaleBridge`).
- Trong `PortalContentTheme`, sau `inherit: false` + spread `vemokiTheme`, ghi đè `token` với `motionDurationFast|Mid|Slow: '0s'` khi `reducedMotion === true`.

**Lý do token:** Ant nested `ConfigProvider` với `inherit: false` không kế thừa motion zero từ root `ConfigProvider`; chrome popup (Select/Dropdown trong boundary) có thể giữ duration mặc định dù OS reduce — đây là gap sau review `569243ed` (finding **P05-R-F02** phần code).

**Popup/sider màu:** Không thay `algorithm`, `cssVar`, `vemokiTheme` ink/elevated/sider — regression P-F05 light popup + dark sider **không kỳ vọng đổi** so với SHA trước.

## Checks (exact SHA `76a015c5`)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter portal typecheck` | **PASS** |
| `pnpm --filter portal test` | **169/169 PASS** |
| `pnpm --filter portal build` | **PASS** (reviewer re-run) |
| `docs/agents/tools/ui-evidence-check.sh` `docs/reviews/p05-uat-2026-10-25/` | **OK** (6 ảnh, không trùng) |

## Runtime (Orca, hẹp)

- **Served:** `http://127.0.0.1:3334` (coordinator: candidate local + remote build `qmzwZS2Wnkb9rgM6lqZmk` từ `76a015c5`; prod live **chưa** đổi).
- **Tab reviewer:** page `50208552-5c83-4f4d-abd2-f6d74a76aea3` · route `/t/d9d9f001-0001-4000-8000-000000000001`.
- **Đo được:** click combobox **Tổ chức** → `listbox` + option `MFest (mfest-demo)`; sider `complementary` + menu điều hướng tổ chức vẫn hiện (không vỡ layout).
- **Coordinator spot-check (status message):** tenant popup trắng, chữ tối, sider navy sau restart :3334 — **khớp** kỳ vọng P-F05; reviewer không tái lập bảng `getComputedStyle` trong phiên này.

### Limitation — `prefers-reduced-motion` emulate

- Orca `exec eval` với `getComputedStyle` / `matchMedia(...)` trả **SyntaxError** (property access / object literal) trên build Orca hiện tại — **không emulate** `reduce` trong tab.
- Đánh giá reduced motion: **code parity** với `providers.tsx` + propagation vào nested `inherit: false` boundary; **runtime flag** trong tab vẫn coi là **chưa emulate** (giữ hạn chế như initial review).
- **P05-R-F02:** **đóng phần code** trên `PortalContentTheme`; **mở phần runtime UAT** nếu product yêu cầu bằng chứng emulate/OS setting.

## Findings (revalidation)

| ID | Sev | Block | Vấn đề | Proof | Verdict |
| --- | --- | --- | --- | --- | --- |
| *(none new blocking)* | — | — | — | — | — |

Carry-forward non-blocking: **P05-R-F01** (header `backgroundColor` transparent trong DOM API) — không liên quan diff `76a015c5`.

## Tái hiện

```bash
cd /Users/admin/SideProject/ticket-solution/vd11-portal-theme-release
git checkout 76a015c58202bcc7faa885ab1f15106f54751dcd
pnpm --filter portal test && pnpm --filter portal build
# Portal :3334 + vd08 OIDC (xem VD11-PORTAL-OIDC-UAT-2026-10-25.md)
```

**Kết luận:** **PASS** DoD và **PASS** UI/UX cho revalidation P-F05 trên SHA `76a015c5` trong scope follow-up reduced-motion; sẵn sàng coordinator tiếp tục release gate (không merge/deploy từ task review-only).
