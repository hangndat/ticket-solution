# Test local Web/Portal và backend

Phạm vi theo [PLAN.md](PLAN.md): 86 nhóm acceptance. Thư mục này cung cấp runner local, 42 test Playwright (Web/Portal, cookie/CSRF, lỗi upstream và phục hồi), 5 ca HTTP với Keycloak thật và catalog selector integration PostgreSQL. Có test mới chạy được không đồng nghĩa toàn bộ 86 nhóm đã hoàn tất. Coverage từng slice ghi rõ assertion còn thiếu, gap sản phẩm và JOB-08 ngoài scope khi chưa có callback handler.

## Chạy

Cần Node/pnpm theo repo, Docker daemon và dung lượng cho PostgreSQL, Redis, Keycloak, Mailpit, MinIO. Không cần model hoặc token AI khi thực thi test, kể cả browser UI.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm test:e2e:guards
pnpm test:e2e:list
pnpm test:e2e:http
pnpm test:e2e:smoke
```

Chạy một nhóm hoặc toàn bộ selector đã viết:

```sh
pnpm test:e2e:smoke --case=WEB-02,SEC-02
pnpm test:e2e
pnpm test:integration:local --case DB-03 --suite D
pnpm test:regression:local
node tests/e2e/coverage.mjs
```

Các runner stack build API/worker/shared packages, rồi Web/Portal production khi cần browser. `--skip-build` phục vụ debug sau khi đã build đúng checkout và frontend bật `NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1`; trang prerender có thể giữ origin lúc build nên dùng build mặc định khi lấy bằng chứng toàn suite. `test:e2e:http --case=DB-03` chọn ca HTTP; backend dùng cú pháp riêng `--case DB-03`. Integration runner mặc định dừng ở selector lỗi đầu tiên.

## Lane — chạy song song và dùng lại stack

Mặc định mỗi run dựng stack Docker riêng và build lại Web/Portal, vì origin của run (`e2e-<runId>.test` cộng cổng TLS ngẫu nhiên) bị nướng vào trang prerender. Lane cố định origin theo lane nên build còn hiệu lực giữa các run, và nhiều lane chạy song song.

```sh
pnpm test:e2e:smoke --lane            # lấy lane rảnh trong pool
pnpm test:e2e --lane=2 --case=WEB-01,WEB-02
pnpm test:e2e:lane status             # trạng thái pool
pnpm test:e2e:lane down 2             # hạ stack của lane 2
E2E_LANES=3 pnpm test:e2e:smoke --lane
```

Lane `N` dùng hostname `*.e2e-lane<N>.test`, cổng TLS `44300+N`, Compose project `e2e-lane<N>` và realm `e2e-lane<N>`. Container của lane sống qua nhiều run; mỗi run vẫn có database riêng tạo từ template đã migrate, realm import lại qua admin API, bucket/user/policy MinIO riêng và hộp thư Mailpit được xoá đầu run. Cleanup cuối run xoá đúng các tài nguyên đó và giữ container.

Một lane chỉ phục vụ một run tại một thời điểm. State và lock của lane nằm ở `~/.cache/vemoki-e2e-lanes/lane<N>/` (đổi bằng `E2E_LANES_DIR`) vì container, cổng và realm là tài nguyên của cả máy; nhờ vậy nhiều worktree cùng tranh một pool lane đúng cách. Lock của process đã chết mới bị thu hồi. Hai run song song luôn nằm ở hai lane, tức hai hostname khác nhau, nên cách ly cookie giữ nguyên.

`.next` chỉ có một bản trong mỗi checkout, nên **hai run cần frontend trong cùng một checkout bị `tests/e2e/.artifacts/frontend.lock` ép tuần tự**; chạy song song thật cần mỗi run một worktree. Build được dùng lại khi git commit, fingerprint working tree và origin của lane đều khớp marker `tests/e2e/.artifacts/frontend-build.json`; marker bị xoá trước mọi lần build frontend (kể cả run không lane). `--rebuild` buộc build lại, `--skip-build` giữ nguyên ý nghĩa cũ. Số đo thực tế: [PLAN.md §16.8](PLAN.md).

Mỗi lane là năm container và Keycloak chiếm nhiều RAM nhất: bắt đầu với 2–3 lane rồi đo trước khi tăng. `pnpm test:e2e:lane down all` trả lại toàn bộ tài nguyên. Kế hoạch và phần còn lại: [PLAN.md §16](PLAN.md).

## Cô lập và bằng chứng

Mỗi run tạo Compose project, network, port loopback, realm/users, database, object bucket, mailbox và dữ liệu từng case riêng. Web/Portal dùng hostname khác nhau dưới `e2e-<run>.test`, TLS proxy local; cookie `Secure` vẫn được bật trong production. Node dùng CA/resolver riêng trong process; Chromium chỉ tin SPKI của chứng thư run. Không sửa `/etc/hosts`, trust store hệ thống hay `.env` dùng chung. Platform login dùng password + TOTP thật. HTTP dùng confidential client test và JWT ký bởi Keycloak.

AUTH-05 dùng Web/client riêng với access token 20 giây; Web thường giữ TTL 300 giây. PLAT-05 dùng Portal riêng cố ý thiếu Platform OIDC. WEB-10 bật/tắt lỗi transport ở proxy cho đúng public-detail endpoint của case, rồi kiểm phục hồi; không thay thành công API hoặc dùng Playwright route mock.

Runner dọn process và Compose resources do mình tạo trong `finally`, kể cả khi test fail hoặc nhận SIGINT/SIGTERM. Không dùng tài nguyên dev/prod. Tránh build hai run browser đồng thời trong cùng checkout vì `.next` dùng chung; dùng worktree riêng nếu cần chạy song song — pool worktree, lane cố định và kế hoạch tái sử dụng infra ở [PLAN.md §16](PLAN.md).

`tests/e2e/.artifacts/<run>/summary.json` ghi kết quả chạy; `results.json` chứa kết quả browser, các lớp khác có log riêng. Artifact bị gitignore, directory private; manifest chứa credential synthetic nên không commit hoặc chia sẻ nguyên thư mục. Trace/video/screenshot mặc định tắt. `PASS` ở summary chỉ áp dụng selector đã chạy; coverage toàn nhóm vẫn phải đối chiếu plan. Setup thiếu prerequisite trả `BLOCKED`/exit 2; assertion sai trả `FAIL`/exit 1.

Các [báo cáo backend](backend/REPORT.md), [Web](web/REPORT.md), [Portal](portal/REPORT.md), [HTTP](http/REPORT.md), [seed](harness/SEED-REPORT.md) ghi phạm vi bàn giao của từng worker. Kết quả tích hợp cuối nằm trong [IMPLEMENTATION.md](IMPLEMENTATION.md).
