# HTTP integration — trạng thái 28/10/2026

## DB-15 / DB-16 — Issue #1030

Diagnostic `mvxkyku6-2a175b` PASS 2/2 qua HTTPS API và Keycloak thật trên stack cô lập, nhưng worktree đang sửa nên không dùng làm evidence exact SHA. DB-15 đối soát report sau confirm/reject/undo/cancel và kiểm check-in/audit PG; notification UNKNOWN/DEAD là fixture PG, còn retry provider tới DEAD được chạy ở D. DB-16 kiểm Owner/Manager assignment, cursor/limit/watermark và cross-tenant deny; snapshot digest PG dưới tenant RLS không đổi qua các request deny. Chờ chạy lại trên commit sạch và review độc lập; câu chữ O12 về APPLIED và cách loại undo cần làm rõ riêng như trong báo cáo backend.

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
## DB-19 — inventory assertion theo PLAN §6.1 (snapshot lịch sử trước nghiệm thu keyring)

| AC | Assertion hiện có | Còn thiếu |
| --- | --- | --- |
| Pepper v1 còn hỗ trợ, v2 là current | D `db19-code-pepper-rotation.test.cjs`: lookup code v1 sau rotate; H `[DB-19]`: bearer Keycloak redeem v1 và v2 qua API thật, ticket/outbox/quota tăng đúng hai | Không |
| Version bỏ khỏi ring fail-closed | D bỏ v1 khỏi ring → `CODE_INVALID`; H code v3 ngoài ring → `422 CODE_INVALID`, snapshot code/ticket/outbox/quota không đổi | Không |
| Trùng raw code qua hai pepper fail-closed; code đã dùng không sống lại | D selector duplicate rows và consumed; H v1/v2 digest trùng → `CODE_INVALID`, consumed → `CODE_CONSUMED`, snapshot không đổi | Không |
| Không lộ material | D kiểm DB chỉ giữ HMAC/version; H kiểm digest khác raw code và không có pepper/credential key trong API response/log của run | Không chứng minh mọi kênh telemetry ngoài run local |
| QR credential key cũ, revoked | Chưa có versioned credential keyring: `kid` cố định `local-v1`; trạng thái `REVOKED` của credential được kiểm riêng trong DB-09 | Owner cần chốt giữ DB-19 AC và thiết kế keyring, hoặc điều chỉnh AC QR có ghi rủi ro theo PLAN §15.2 |

Chạy H riêng bằng `E2E_LANES=1 pnpm test:e2e:http --lane --case=DB-19`; fixture v2 current/v1 legacy được cô lập, nên không ghép ID này với các HTTP case dùng cấu hình pepper mặc định. Kết quả exact SHA và verdict ghi ở báo cáo bàn giao, không đổi `ACCEPTANCE.md` trong Task này.
## GATE-03 signed credential — 02/11/2026

Run `mvyisdk6-156618` trả `PASS` 1/1 cho selector HTTP trên source SHA `989e68394ac6a301f26c47a519264c05e5e105da`. Harness dựng stack cô lập thật với Keycloak, PostgreSQL và API; summary và log ở `tests/e2e/.artifacts/mvyisdk6-156618/`.

Ca lấy JWS ES256 và mã manual qua `/me/tickets/:ticketId`, sau đó kiểm reserve/confirm hợp lệ, chữ ký bị sửa, context sai event và signed context sai tenant, version cũ, vé revoke, vé đã dùng, manual lookup và proof token dùng từ staff session khác. Các request từ chối kiểm tra reservation/check-in bất biến; các nhánh credential deny có `gate.reject` trong tenant tương ứng dưới RLS. Signing key ephemeral được tạo cho run; private key chỉ được seal bằng helper backend hiện có.

Không nâng GATE-03 thành PASS toàn phần. Summary ghi `evidenceExactShaEligible: false` / `NON_EVIDENCE_DIRTY` vì worktree vẫn có `company/work-events.jsonl` cùng sáu báo cáo James đã tồn tại trước task; các file được giữ nguyên. Ma trận còn thiếu audience/kid/alg/hash, ticket cancelled, manual code/proof invalid, proof expiry/version stale và rate-limit. `coverage.json` vẫn giữ trạng thái `blocked`.

CRG scope: repo `/Users/admin/SideProject/ticket-solution/f04-port09-unknown-contract`; stats và `file_summary(tests/e2e/http/live.test.mjs)` đã chạy tại source SHA `989e68394ac6a301f26c47a519264c05e5e105da`. Tip `d066abbd` chỉ thêm báo cáo/coverage, không đổi source; MCP graph giữ `head_matches_build=false` cho phần docs-only.

## SEC-03 — tích hợp 03/11/2026

Các snapshot FAIL phía trên được giữ nguyên làm lịch sử. PR #1118 hiện có thay đổi runtime ở Web/Portal: dùng Host đã tin cậy cho routing/robots/sitemap/analytics và ngăn shared caching cho các response phụ thuộc Host.

Theo [quyết định scope của coordinator](https://github.com/hangndat/ticket-solution/pull/1118#issuecomment-6597982870), gate F04 giữ đầy đủ assertion Host/forwarded/origin/redirect và cache-header qua proxy/upstream local. Phép chứng minh shared edge/cache production chuyển sang D5, vẫn GAP/chưa chạy; không kết luận production/pilot ready. Lý do và rủi ro cache/origin poisoning ngoài local stack được ghi trong quyết định đó.

Lần tích hợp này giữ các probe SEC-03 cùng các assertion SEC-04/06 và JOB-04 đã có trên main; chưa tự chuyển verdict sang PASS. H trên SHA sạch, CI và revalidation độc lập phải hoàn tất trước merge. Lịch sử sửa 2/2 + ngoại lệ của PR #1118 không được reset; không mở thêm business fix từ việc giải conflict.
