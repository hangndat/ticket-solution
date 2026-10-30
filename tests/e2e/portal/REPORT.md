# Portal/Platform E2E — bàn giao worker

- Baseline đối chiếu: `022cb80fd159dad2a7ebd0eeeea07fd64391f90a` trên `hangndat/local-e2e-regression`.
- Phạm vi sửa: chỉ `tests/e2e/portal/**`. Không sửa product, harness, root package/lockfile/CI hoặc `PLAN.md`.
- Architecture impact: Không. Spec dùng Playwright browser thật, BFF same-origin và Keycloak login/TOTP; không mock token/cookie/auth.

## Kiểm tra đã chạy (worker task_ac6fd382f590 — PORT-07 / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-07` | **PASS** run `mvuqtkqt-c9572d`, browser 1/1; artifact `tests/e2e/.artifacts/mvuqtkqt-c9572d/summary.json`. |
| SHA | `865d4bef793900291a90ca4139d34fed004aa443` (re-run sau commit sạch — xem worker_done). |

PORT-07: zero-gate hướng dẫn VI, create/list đúng event, tên 1–80 và order 0/9999 (UI+ BFF), `GATE_NAME_CONFLICT` UI tiếng Việt + HTTP 409, scanner POST 403 (thiếu `event.update`), không scan/confirm/undo/rename/delete/link Web `/gate`. Gap: chưa có actor Portal read-only trên panel (CS thiếu `report.read`; manager có `event.update`).

## Kiểm tra đã chạy (worker task_bc250bdc551b — PORT-04/08/09)

| Lệnh                                                                                                                                                                              | Kết quả                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/portal --list`                                                                                                                               | PASS discovery: 20 test trong 5 file (thêm PORT-04 mutation guard).                                                         |
| `pnpm exec tsc --noEmit … tests/e2e/portal/*.ts`                                                                                                                                    | PASS sau bổ sung PORT-04/08/09.                                                                                           |
| Runtime browser HTTPS                                                                                                                                                             | **Không chạy** — chờ coordinator cấp slot; chỉ source review + typecheck/list.                                            |

### PORT-04/08/09 — đối chiếu AC (28/10 PLAN)

| ID      | Đã viết thêm trong spec                                                                                         | Blocker còn lại                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-04 | Quota/report FINITE đồng bộ; UI quota + `event-report-as-of`; BFF quota từ chối POST/PATCH/PUT, snapshot không đổi | Không có UI/BFF sửa capacity; nhánh giảm dưới allocated+hold, validate type/source, actor thiếu quyền cần product + seed `allocatedPlusHold`/editor deny |
| PORT-08 | KPI BFF đủ quotaRemaining/state; gate asOf, check-in count, refresh GET, deep link, không nút resend trên dashboard | `confirm APPLIED/undo/reject` thuộc Gate app (O12), không Portal; seed không có check-in/emailNeedsCs>0 → CTA nhánh; lỗi upstream không render 0 cần fault profile |
| PORT-09 | Timeline masking; tra cứu UUID lạ rỗng; resend + cooldown 429 giữ ticket/state                               | Seed thiếu ma trận provider PENDING/FAILED/DEAD/UNKNOWN; chưa assert deny cross-event; giới hạn resend ngoài cooldown cần fixture riêng            |

Không sửa `tests/e2e/harness/**` — cần coordinator nếu bổ sung PORT-09 notification states hoặc PORT-08 counters >0.

## Kiểm tra đã chạy

| Lệnh                                                                                                                                                                              | Kết quả                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/portal --list`                                                                                                                               | PASS discovery: 19 test trong 5 file (sau lượt bổ sung, chạy lại ở cuối).                                                 |
| `pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --typeRoots apps/portal/node_modules/@types --types node --skipLibCheck tests/e2e/portal/*.ts` | PASS, không lỗi type/syntax trong folder.                                                                                 |
| `pnpm exec playwright test tests/e2e/portal/portal-core.spec.ts -g 'PORT-07' --reporter=line`                                                                                     | BLOCKED trước assertion: Playwright Chromium headless shell `chromium_headless_shell-1194` chưa có trong cache.           |
| Runtime do coordinator chạy, `mvs7d4db-259457`                                                                                                                                    | PORT-01 PASS qua browser/BFF thật.                                                                                        |
| Runtime do coordinator chạy, `mvs7lq8o-b4964d`                                                                                                                                    | PLAT-01 và PLAT-05 PASS; Operator MFA/TOTP, Owner bị từ chối Platform, và Portal lỗi cấu hình chạy ở process HTTPS riêng. |
| Runtime do coordinator chạy, `mvs7goky-950046`                                                                                                                                    | PORT-05 FAIL tại AntD option ẩn; selector đã đổi sang dropdown hiện, cần retry.                                           |

Các PASS trên chỉ xác nhận nhánh đã chạy, chưa chứng minh toàn bộ AC tương ứng. `coverage.json` giữ `blocked` khi còn nhánh thiếu; discovery/typecheck không được tính là browser/API PASS.

## Đã viết và giới hạn

- 19 spec thao tác/read thực, mỗi ID một spec, cho wizard/config/event/clone/quota, import, approve, cổng vào, KPI, notification, portfolio, member invite, onboarding, locale, audit/codes, Operator MFA, tenant activation, support grant và platform health/audit.
- Đối chiếu selector với source Portal/Platform: import chọn option trong dropdown AntD hiện; pending mở `#pending` để chuyển đúng Vận hành; KPI kiểm `href` ở Link bao Button; portfolio kiểm link event được gán thay vì tìm UUID trong text bảng. PORT-07 kiểm thêm BFF từ chối tên cổng rỗng bằng `422 NAME_INVALID`; PLAT-03 kiểm mã lỗi scope/TTL và grant response thực (`grantId`, `expiresAt`, không có `scopes`).
- Spec `PORT-11` tạo staff invite qua Portal và đợi email Mailpit từ worker thật. Source hiện có `POST /v1/platform/me/membership-invites/accept` ở API và **Web legacy** `apps/web/app/(consumer)/invite/invite-accept.tsx` + `/api/bff/me/membership-invites/accept`, nhưng không thấy Portal accept BFF/UI. Đây là divergence O16 so với câu chữ "portal login/accept"; phần login/accept, TTL/reuse/wrong actor còn BLOCKED trong scope này, không đánh đồng với guest claim `WEB-13`.
- `PORT-04` mới kiểm quota read: UI quota và BFF quota hiện chỉ GET, chưa thấy thao tác sửa quota. `PORT-02` mới kiểm draft/public projection và stale version qua BFF; `PLAT-05` mới kiểm OIDC setup fail-closed. Các nhánh còn thiếu ghi riêng trong `coverage.json`.
- Fixture keys và event assignment/permission tối thiểu trong `FIXTURES.md`; Owner cần assignment cho report/audit, Operator cần TOTP ACR2. Không cấp rộng quyền chỉ để test qua.

## Việc cần để chạy tiếp

1. Coordinator retry PORT-05 sau selector fix và chạy full suite trên runtime HTTPS cô lập; ghi PASS/FAIL theo actual response/DB/mail.
2. Hoàn thiện nhánh còn thiếu trong `coverage.json`, đặc biệt B/H/R của PORT-11, 15 phút step-up của PLAT-01 và H/D audit của PLAT-03.
