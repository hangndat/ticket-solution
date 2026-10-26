# VCX-939 runtime chẩn đoán — vcx939-20261026T0305Z

Nguồn đo: `b37382f09381401903267785a888b131a2a2b0ea` + dirty diff web SHA-256 `243d7d2a43f62ca837dac18d678c7da9f3afe27ab77747efefdf3c77e7b76218`; web/API/worker, cwd, ports, OIDC và fixture trong `runtime-provenance.json`. Thay đổi root tooling do coordinator sở hữu phát sinh song song sau các probe, nằm ngoài hash web này. Đây là lượt đo **mới**, không đổi nhãn packet `vcx939-20261026T0158Z`; reviewer độc lập chưa xác nhận. PR #954 tiếp tục **Partial Acceptance**.

## Kết quả theo AC

| Luồng | Kết quả | Bằng chứng |
| --- | --- | --- |
| Browser form → BFF → API → UI | PASS cục bộ. Orca nhập mã fixture, `requestSubmit()` trên form thật; `POST /api/bff/redeem` trả `PENDING_REVIEW`, key `c0c815af-1c39-43ed-ae1f-b185197c60fc`, request `55d589a1-7d82-4bbe-8c9f-13b4204e3758`. BFF forward cùng operation key tới API; DB request/ticket/outbox khớp request này. `DEMO-NOT-FOUND` riêng trả 422 `CODE_INVALID`, request `e616f374-70ae-4ee7-9db9-23c5921659fd`, UI «Mã không hợp lệ». | `browser-request-chain.sanitized.json`, `pending.snapshot.txt`, `screenshots/pending.png` |
| Pending → issued và rejected | PASS cục bộ. Staff approve request `55d589a1-…` thành ticket `f1848460-b8de-4c9f-9268-ff481da5a560`; browser GET status cùng request + tenant trả `ISSUED`, UI «Đổi mã thành công». Request `954ee209-3220-4f96-a10d-b6f3e9644f9c` sau deny trả `REJECTED`, UI «Yêu cầu bị từ chối». | `browser-request-chain.sanitized.json`, `issued.snapshot.txt`, `rejected.snapshot.txt`, screenshots |
| API outage sau resolve, trước issue | PASS cục bộ cho 502. Control: API `/v1/health` unreachable, web `/redeem` HTTP 200. Browser POST issue trả 502 `UPSTREAM_UNAVAILABLE`, key `892cb81d-ea07-404d-a39b-ca4bea2857e1`; GET operation cùng key trả 502. UI «Chưa xác định kết quả — chưa phải vé» và nút «Kiểm tra lại», không chuyển sang «Mã không hợp lệ». Chưa đo timeout treo kết nối riêng. | `browser-request-chain.sanitized.json`, `unknown.snapshot.txt`, `screenshots/unknown.png` |
| SMTP fault, retry, persistence | PASS cục bộ. Worker thật PID 86162 dùng SMTP `:19999` tạo attempt 1 `FAILED`/`ECONNREFUSED`; worker PID 86496 dùng Mailpit SMTP `:1039` tạo attempt 2 `ACCEPTED`, outbox `COMPLETE`. Request vẫn `ISSUED`, ticket count 1, cùng ID `f1848460-…` trước/sau; wallet có link đúng ticket. Mailpit UI/API `:8039`, 4 fixture messages tại lúc kiểm; không gửi email thật. `ACCEPTED` chỉ là provider nhận, không chứng minh delivered. | `issued-before-worker.json`, `issued-worker-fault.json`, `issued-worker-retry.json`, `wallet.snapshot.txt`, `screenshots/wallet.png` |
| `refresh_after_logout_all` | FAIL cũ giữ nguyên trong packet trước; probe đúng isolated realm **PASS**: admin user trùng token subject, session 1→0, logout HTTP 204, refresh HTTP 400 `invalid_grant`. Root cause của FAIL cũ: `scripts/uat-d1-p4-keycloak.py` dùng admin endpoint cố định `:8080` dù issuer test là `:8180`; chẩn đoán harness cross-stack, chưa sửa root tooling trong slice web. | `logout-isolated-result.json`; patch hẹp giao coordinator |

## Thay đổi và kiểm tra

- Web status BFF trước đây gọi API không có `tenantId`; API trả 422 `TENANT_REQUIRED`, nên nút poll không thể cập nhật issued/rejected. Thay đổi hẹp ở web: client redeem/claim truyền tenant, BFF xác thực UUID rồi forward query. Không đổi contract backend.
- `pnpm --filter @ticket/web test:redeem-poll`: 9/9 pass. `pnpm --filter @ticket/web typecheck`: pass. Browser Orca tại 3417, API 3539, OIDC 8180, PG 55439; không chạy full matrix.
- Dirty runtime source được pin bằng diff hash ở trên. Commit của packet/code cần reviewer xác nhận diff và revalidation exact SHA; chưa tự nhận acceptance complete hoặc pilot ready.

## Giới hạn

- Orca `click` trên button submit/status có lần trả success nhưng không dispatch React event; dùng Orca `eval` gọi `form.requestSubmit()`/`button.click()` trên DOM thật và ghi request chain, không mock HTTP. Tab cũ sau điều hướng chỉ hiện loading skeleton; tab mới cùng session vào redeem/wallet bình thường. Đây là giới hạn automation của lượt đo, không đổi kết quả request đã ghi.
- Probe outage đo API connection refusal tạo BFF 502; chưa đo timeout treo kết nối riêng. F-939-05 chỉ đóng khi reviewer độc lập xác nhận AC và exact SHA; giữ trạng thái Partial Acceptance.
