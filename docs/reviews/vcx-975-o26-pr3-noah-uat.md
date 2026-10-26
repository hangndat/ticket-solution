# VCX-975 O26-PR3 — UAT spot-check (Noah)

**PR:** [#982](https://github.com/hangndat/ticket-solution/pull/982) · **Epic:** [#914](https://github.com/hangndat/ticket-solution/issues/914)
**Code SHA (runtime + build):** `ecda980af0231466c62164d9c77f308e779d0291`

## Verdict: PASS with GAP

| Hạng mục | Kết quả |
| --- | --- |
| Auth Owner + shell/events @ 390 / 1024 / 1440 | **PASS** — `#portal-main`, context strip, nav, không wrapper `SurfaceState` cũ, không React crash |
| Event overview | **PASS** |
| Analytics (Owner) | **PASS** — portfolio + `portfolio-asof` |
| Onboarding `/onboarding/{tenantId}` | **PASS** — first-run/pending copy, không crash |
| Permission (report-only @ guests) | **PASS** — `Result` 403, title «Không có quyền», CTA «Về trang được phép» |
| Loading sau điều hướng events | **PASS** — không kẹt Spin |
| BFF error + nút «Thử lại» | **GAP** — không gây fault trên API read-only |
| Analytics deny title runtime | **GAP** — persona `report.fixture` có `report.read`, nên analytics được phép; không có fixture deny phù hợp |

## Runtime và evidence

| Thành phần | Endpoint |
| --- | --- |
| Portal | `http://uat975pr3.localhost:3021` · OIDC client `ticket-admin-web-vcx975-uat975pr3` |
| API read-only | `http://127.0.0.1:3542` |
| Keycloak | `http://127.0.0.1:8180/realms/ticket` |

Orca `tab create` + `exec` (goto, viewport, screenshot, eval). Tab đóng sau run. Kết quả máy: [`uat-results-ecda980a.json`](evidence/vcx-975/o26-pr3-noah/uat-results-ecda980a.json); [ports snapshot](evidence/vcx-975/o26-pr3-noah/ports-orca.json); [provenance](evidence/vcx-975/o26-pr3-noah/evidence-provenance.md). Screenshot và runner giữ gitignored trong `apps/portal/.uat-artifacts/vcx975-pr3/` và `.local-dev/.uat-artifacts/vcx975-noah-pr3/`.

Không bootstrap/drop DB `ticket_d9_demo`, không sửa client hoặc dữ liệu #928, không sửa product code trong phiên UAT. Hai GAP giới hạn kết luận runtime của PR3; #975 vẫn mở.
