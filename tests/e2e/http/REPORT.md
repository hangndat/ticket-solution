# HTTP integration — trạng thái 28/10/2026

Đã viết runner Node `--list`/`--case` và năm ca H vào HTTPS API với JWT từ Keycloak thật. Source assertion lấy từ `apps/api/src/{tickets,gate,reporting}.ts`, `packages/backend/src/{issue,gate,reporting}.ts`; không giả auth, không gọi Playwright.

**Runtime:** Chưa chạy; coordinator cần manifest và isolated stack. `node --check` hai file PASS; `--list` liệt kê đủ năm ID, `--case DB-03 --list` chọn đúng một ID; `coverage.json` parse PASS. Không có `E2E_MANIFEST`, runner thoát mã 2 với `BLOCKED`, không skip. Những kiểm tra này không là HTTP PASS. `coverage.json` giữ `blocked` cho full AC, kể cả khi các nhánh H này PASS.

Giới hạn cụ thể: SEC-01 thiếu matrix mọi resource; AUTH-03 thiếu browser UX và lookup/confirm; GATE-01 thiếu reopen same gate và actor assigned cả hai event; GATE-03 không có HTTP QR parser và chưa test revoked/cancelled; DB-03 thiếu concurrency nhiều actor, source counter, audit/outbox đối soát.

Chạy: `node tests/e2e/http/entry.mjs --list`; với manifest: `E2E_MANIFEST=<private-path> NODE_EXTRA_CA_CERTS=<cert-path> NODE_OPTIONS='--require <dns-preload>' node tests/e2e/http/entry.mjs [--case DB-03]`.

## SEC-03 — Host/forwarded và redirect, 01/11/2026

Probe H mới trong `live.test.mjs` kiểm `Forwarded`/`X-Forwarded-Host`, `return`/`next`/`redirect` trên web/portal, marketing → product hai hop, direct upstream, cache header, legacy GET/HEAD không set session cookie và legacy write/API không chuyển thành navigation redirect. `pnpm test:e2e:guards` PASS 19/19; `node --check` và Prettier PASS. Không thay runtime, host/auth policy hoặc UI.

| Run               | Exact source SHA                           | Kết quả | Giới hạn                                                                                                                                                                                            |
| ----------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mvxxz2f1-593e7c` | `686bf08e3988cc12c71568f70831c8964dbcc1c8` | H PASS  | Chưa có marketing hai hop và spoof canonical `www`.                                                                                                                                                 |
| `mvxy28yc-c1c51d` | `381ea2b3490aa30333e567724e598c2164708f59` | H PASS  | Chưa có spoof canonical `www`.                                                                                                                                                                      |
| `mvxy4ps3-1bcb72` | `9262850d2e0195bd03755e8f0a2b8e53154d66bc` | H FAIL  | `Host=app.<run>.e2e.test`, `X-Forwarded-Host=www.vemoki.com`, direct-upstream `GET /` trả `Location=https://<run>.e2e.test:64181/`, trong khi product origin là `https://app.<run>.e2e.test:64181`. |

Các run trên có `sourceProvenance.commitStable=true`, `evidenceExactShaEligible=true`, working tree sạch. H FAIL ở direct Next upstream; proxy TLS local ghi đè `X-Forwarded-Host`, nên chưa chứng minh request ngoài proxy có thể khai thác. Full SEC-03 giữ BLOCKED để coordinator/web quyết định trust boundary và reviewer độc lập kiểm lại exact SHA; không tự đổi expected hoặc runtime cho test xanh.
