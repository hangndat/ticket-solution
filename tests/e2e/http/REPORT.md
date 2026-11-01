# HTTP integration — trạng thái 28/10/2026

Đã viết runner Node `--list`/`--case` và năm ca H vào HTTPS API với JWT từ Keycloak thật. Source assertion lấy từ `apps/api/src/{tickets,gate,reporting}.ts`, `packages/backend/src/{issue,gate,reporting}.ts`; không giả auth, không gọi Playwright.

**Runtime:** Chưa chạy; coordinator cần manifest và isolated stack. `node --check` hai file PASS; `--list` liệt kê đủ năm ID, `--case DB-03 --list` chọn đúng một ID; `coverage.json` parse PASS. Không có `E2E_MANIFEST`, runner thoát mã 2 với `BLOCKED`, không skip. Những kiểm tra này không là HTTP PASS. `coverage.json` giữ `blocked` cho full AC, kể cả khi các nhánh H này PASS.

Giới hạn cụ thể: SEC-01 thiếu matrix mọi resource; AUTH-03 thiếu browser UX và lookup/confirm; GATE-01 thiếu reopen same gate và actor assigned cả hai event; GATE-03 không có HTTP QR parser và chưa test revoked/cancelled; DB-03 thiếu concurrency nhiều actor, source counter, audit/outbox đối soát.

Chạy: `node tests/e2e/http/entry.mjs --list`; với manifest: `E2E_MANIFEST=<private-path> NODE_EXTRA_CA_CERTS=<cert-path> NODE_OPTIONS='--require <dns-preload>' node tests/e2e/http/entry.mjs [--case DB-03]`.

## SEC-03 — Host/forwarded và redirect, 01/11/2026

Probe H ban đầu trong `live.test.mjs` kiểm `Forwarded`/`X-Forwarded-Host`, `return`/`next`/`redirect` trên web/portal, marketing → product hai hop, direct upstream, cache header, legacy GET/HEAD không set session cookie và legacy write/API không chuyển thành navigation redirect. Batch kiểm thử này không đổi runtime, host/auth policy hoặc UI.

| Run               | Exact source SHA                           | Kết quả | Giới hạn                                                                                                                                                                                            |
| ----------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mvxxz2f1-593e7c` | `686bf08e3988cc12c71568f70831c8964dbcc1c8` | H PASS  | Chưa có marketing hai hop và spoof canonical `www`.                                                                                                                                                 |
| `mvxy28yc-c1c51d` | `381ea2b3490aa30333e567724e598c2164708f59` | H PASS  | Chưa có spoof canonical `www`.                                                                                                                                                                      |
| `mvxy4ps3-1bcb72` | `9262850d2e0195bd03755e8f0a2b8e53154d66bc` | H FAIL  | `Host=app.<run>.e2e.test`, `X-Forwarded-Host=www.vemoki.com`, direct-upstream `GET /` trả `Location=https://<run>.e2e.test:64181/`, trong khi product origin là `https://app.<run>.e2e.test:64181`. |

Các run trên có `sourceProvenance.commitStable=true`, `evidenceExactShaEligible=true`, working tree sạch. H FAIL ở direct Next upstream; proxy TLS local ghi đè `X-Forwarded-Host`, nên chưa chứng minh request ngoài proxy có thể khai thác. Full SEC-03 giữ BLOCKED để coordinator/web quyết định trust boundary và reviewer độc lập kiểm lại exact SHA; không tự đổi expected hoặc runtime cho test xanh.

### First post-review fix batch — F01/F02

Sau Web commit `289e5200` (F01), H thêm so sánh direct-upstream với `Host` thật và `X-Forwarded-Host` giả ở `/robots.txt`, `/sitemap.xml`, `/api/marketing/events`. Mỗi route đo product trước/giả/sau và marketing trước/giả/sau; log ghi status, response body, `Cache-Control`, `Vary`, `Age`, `ETag`, `Expires`, `Pragma`, `Via` và cache-status headers. Analytics dùng POST body `{}` không hợp lệ để không ghi event. Assertion cache nay yêu cầu `private` hoặc `no-store` rõ ràng; thiếu `Cache-Control` không còn PASS.

| Run               | Source SHA sạch                            | Kết quả                                                                                                                                    |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mvxz38es-d890b4` | `52bf4fbcd10b131e0865733d0c580cfc037f366a` | H FAIL sớm: legacy admin GET thiếu `Cache-Control`; assertion cũ trước đây chấp nhận.                                                      |
| `mvxz652h-b3984a` | `233b9673bc4ec9b19da8aafd30c1105aad8ef8ad` | H FAIL sau khi thu đủ ba consumer; 17 cache assertions không đạt. `summary.json` ghi `commitStable=true`, `evidenceExactShaEligible=true`. |

Run thứ hai ghi product robots `Disallow: /`, không sitemap; marketing robots `Allow: /` và sitemap. Product sitemap không có `<loc>`, marketing có URL marketing. Cả hai policy và sitemap giữ nguyên trước/giả/sau. Analytics trên product luôn `403 FORBIDDEN_HOST`; trên marketing luôn `400 INVALID_EVENT`, kể cả forwarded host giả. Đây là bằng chứng hành vi F01 trên local direct upstream, chờ reviewer độc lập xác minh.

Cache headers direct upstream: robots và sitemap trên cả hai Host trả `Cache-Control: public, max-age=0, must-revalidate`, `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`; analytics thiếu `Cache-Control`. Các redirect SEC-03 cũng thiếu `Cache-Control`. `Age`, `ETag`, `Via` và cache-status headers không xuất hiện trong các response được ghi. Trình tự trước/giả/sau không thấy lẫn response trong Next upstream local, nhưng H bypass shared edge, không chứng minh edge triển khai không lưu response hoặc dùng cache key theo Host. **F02 và full SEC-03 vẫn BLOCKED/FAIL**; cần bằng chứng edge/cache thực tế hoặc một sửa runtime/header được owner ủy quyền rồi H trên SHA mới. Chi tiết response: `tests/e2e/.artifacts/mvxz652h-b3984a/http-SEC-03.log`; provenance: `summary.json` cùng thư mục.
