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

## Cô lập và bằng chứng

Mỗi run tạo Compose project, network, port loopback, realm/users, database, object bucket, mailbox và dữ liệu từng case riêng. Web/Portal dùng hostname khác nhau dưới `e2e-<run>.test`, TLS proxy local; cookie `Secure` vẫn được bật trong production. Node dùng CA/resolver riêng trong process; Chromium chỉ tin SPKI của chứng thư run. Không sửa `/etc/hosts`, trust store hệ thống hay `.env` dùng chung. Platform login dùng password + TOTP thật. HTTP dùng confidential client test và JWT ký bởi Keycloak.

AUTH-05 dùng Web/client riêng với access token 20 giây; Web thường giữ TTL 300 giây. PLAT-05 dùng Portal riêng cố ý thiếu Platform OIDC. WEB-10 bật/tắt lỗi transport ở proxy cho đúng public-detail endpoint của case, rồi kiểm phục hồi; không thay thành công API hoặc dùng Playwright route mock.

Runner dọn process và Compose resources do mình tạo trong `finally`, kể cả khi test fail hoặc nhận SIGINT/SIGTERM. Không dùng tài nguyên dev/prod. Tránh build hai run browser đồng thời trong cùng checkout vì `.next` dùng chung; dùng worktree riêng nếu cần chạy song song.

`tests/e2e/.artifacts/<run>/summary.json` ghi kết quả chạy; `results.json` chứa kết quả browser, các lớp khác có log riêng. Artifact bị gitignore, directory private; manifest chứa credential synthetic nên không commit hoặc chia sẻ nguyên thư mục. Trace/video/screenshot mặc định tắt. `PASS` ở summary chỉ áp dụng selector đã chạy; coverage toàn nhóm vẫn phải đối chiếu plan. Setup thiếu prerequisite trả `BLOCKED`/exit 2; assertion sai trả `FAIL`/exit 1.

Các [báo cáo backend](backend/REPORT.md), [Web](web/REPORT.md), [Portal](portal/REPORT.md), [HTTP](http/REPORT.md), [seed](harness/SEED-REPORT.md) ghi phạm vi bàn giao của từng worker. Kết quả tích hợp cuối nằm trong [IMPLEMENTATION.md](IMPLEMENTATION.md).
