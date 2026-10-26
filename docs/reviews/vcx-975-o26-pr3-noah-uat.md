# VCX-975 O26-PR3 — UAT spot-check (Noah)

**PR:** [#982](https://github.com/hangndat/ticket-solution/pull/982) · **Epic:** [#914](https://github.com/hangndat/ticket-solution/issues/914)
**Code SHA (runtime + build):** `ecda980af0231466c62164d9c77f308e779d0291`

## Verdict: PASS cho PR3 UI; giới hạn backend deny thật

| Hạng mục | Kết quả |
| --- | --- |
| Auth Owner + shell/events @ 390 / 1024 / 1440 | **PASS** — `#portal-main`, context strip, nav, không wrapper `SurfaceState` cũ, không React crash |
| Event overview | **PASS** |
| Analytics (Owner) | **PASS** — portfolio + `portfolio-asof` |
| Onboarding `/onboarding/{tenantId}` | **PASS** — first-run/pending copy, không crash |
| Permission (report-only @ guests) | **PASS** — `Result` 403, title «Không có quyền», CTA «Về trang được phép» |
| Loading sau điều hướng events | **PASS** — không kẹt Spin |
| BFF error + nút «Thử lại» | **PASS, fault cô lập** — intercept GET portfolio trong tab Orca trả 400 có mã lỗi; `Alert` và nút retry hiển thị, retry sau khi bỏ fault trở lại trạng thái ready |
| 403 trên route Analytics | **PASS, fault cô lập** — intercept GET portfolio trong tab Orca trả 403; `PortalShell` hiển thị `Result` 403 với title «Không có quyền» và CTA «Về trang được phép» |

## Runtime và evidence

| Thành phần | Endpoint |
| --- | --- |
| Portal | `http://uat975pr3.localhost:3021` · OIDC client `ticket-admin-web-vcx975-uat975pr3` |
| API read-only | `http://127.0.0.1:3542` |
| Keycloak | `http://127.0.0.1:8180/realms/ticket` |

Orca `tab create` + `exec` (goto, viewport, screenshot, eval). Tab đóng sau run. Kết quả máy: [matrix ban đầu](evidence/vcx-975/o26-pr3-noah/uat-results-ecda980a.json), [bổ sung error/retry/403](evidence/vcx-975/o26-pr3-noah/uat-gaps-ecda980a.json), [ports snapshot](evidence/vcx-975/o26-pr3-noah/ports-orca.json), [provenance](evidence/vcx-975/o26-pr3-noah/evidence-provenance.md). Screenshot `analytics-error-retry-ecda980a.png` và `analytics-403-title-ecda980a.png` cùng runner giữ gitignored trong `apps/portal/.uat-artifacts/vcx975-pr3/` và `.local-dev/.uat-artifacts/vcx975-noah-pr3/`.

Fault injection chỉ thay `window.fetch` trong một tab đã auth, phục hồi trước khi đóng; không mutate API hoặc DB. Probe 403 đi qua `PortalShell` trên route Analytics; nó không chứng minh nhánh 403 nội bộ của trang Analytics hoặc một persona thực bị backend từ chối. Không bootstrap/drop DB `ticket_d9_demo`, không sửa client hoặc dữ liệu #928, không sửa product code trong phiên UAT. #975 vẫn mở.
