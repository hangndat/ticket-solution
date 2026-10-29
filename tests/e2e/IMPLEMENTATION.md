# Kết quả triển khai local — 2026-10-29

Đã dựng runner và chạy browser/API/PG thật. **Browser suite hiện có đã xanh 52/52 test trên 42 nhóm fixture; chưa nghiệm thu đủ 86 nhóm acceptance.** Inventory đủ 86 ID (70 P0, 16 P1); `coverage.json` từng slice tiếp tục đánh `blocked` khi còn nhánh chưa triển khai/chưa được chứng minh. Mapping selector không phải full coverage hoặc runtime PASS.

Baseline product: `022cb80fd159dad2a7ebd0eeeea07fd64391f90a`. Sau baseline đã sửa Web/Portal/backend cho các finding F01–F08 trong [FIXES.md](FIXES.md), gồm OIDC/session, CSRF, clone/preview, public projection và metric RLS. Nhánh tích hợp `origin/main=cb875691` theo yêu cầu user; hai conflict redeem được ghép giữ context login và nhãn i18n. Main đưa vào một lỗi server/client boundary ở wallet filter; đã tách helper dữ liệu khỏi client component. Chưa push/PR/deploy.

## Xác minh mới sau sửa product

- Full production build + HTTP SEC-01 + **42/42 browser PASS**: `mvsdgi6z-fde3cd/summary.json`, `browser-tests.log` (không retry/skip). AUTH-07 cùng context và WEB-13 AUTO/MANUAL đều PASS.
- Sau tích hợp main và sửa wallet filter boundary: full production build + HTTP SEC-01 + **42/42 browser PASS** ở `mvse0ao9-872b62/summary.json` (không retry/skip). Sau mở rộng WEB-02/03/07 và cleanup fixture WEB-03, full browser regression **52/52 PASS** ở `mvsxpkhf-02af2b/summary.json` (42 nhóm fixture, HTTP SEC-01 PASS). Run `mvsxd8g1-ac75d5` FAIL 10/52 vì collision WEB-03 còn tồn tại làm global resolve của WEB-04–08 bị disable; targeted WEB-03+04 `mvsxo9u5-555265` PASS 8/8 và full run sau cleanup PASS. Trước đó `mvswqz0e-554726` FAIL PLAT-03 với 403 thay vì 422; targeted PLAT-03 `mvswswvq-313ee7` PASS và full run kế tiếp PASS, nên giữ lỗi không ổn định này trong evidence. Run đầu sau merge `mvsdvvh9-9e1b6d` FAIL 4 ca do `/wallet` render error và đã sửa trước các run PASS.
- Targeted WEB-13 AUTO/MANUAL PASS ở `mvscx4y6-06bb4f` sau khi test đợi phản hồi approve; AUTH-07 còn FAIL ở run đó và được sửa tiếp có chẩn đoán.
- Targeted AUTH-01/02/04/05/07 PASS ở `mvsda8m1-d78411`; AUTH-07 lặp lại PASS ở `mvsdbupp-7aa1f6` và `mvsdd4l0-51ad3c`, gồm probe refresh cũ về sau logout.
- Backend D **38/38 selector PASS** ở baseline (`pnpm test:integration:local --suite D`, PostgreSQL thật); DB-08 fault/rollback D riêng PASS (`.artifacts/db08-local.md`), DB-09 D subset PASS nhưng reissue/QR rotation còn thiếu (`.artifacts/db09-local.md`). HTTP hiện **10/10 selector PASS** sau mở rộng SEC-02 (`mvswv301-a66295/summary.json`, build production + Keycloak/API/Web/Portal thật); SEC-02 Platform authenticated còn bị chặn bởi OTP fixture. James đã review độc lập DoD + security PASS trên SHA trước merge `cffc5d693bccad75f6c7c6812b186ed110aa2335` và revalidate **PASS/PASS** trên SHA tích hợp `eb2ebc6f08521c72f09518a078ce012cdbfa73d9` (`.artifacts/review-eb2ebc6f.md`); F11/F12 của wave trước đã được revalidate PASS trên `1e908a17` (`.artifacts/review-1e908a17.md`). Không suy rộng verdict này thành đủ 86 nhóm AC hoặc coi review cũ bao phủ diff test mới.

## Những gì đã bàn giao

- 52 browser test trên 42 nhóm fixture: attendee auth, redeem/form/manual/QR/email, isolation, marketing, Portal preparation/operations, Platform MFA và fault profile.
- 10 HTTP case gồm SEC-01–06, AUTH-03, GATE-01/03, DB-03 với Keycloak/API thật. Có positive control để phân biệt authz deny với service không hoạt động.
- Catalog backend map 46 ID tới 51 selector duy nhất hiện có/mới (38 D, 13 U; một selector U chọn 2 test). U dùng local verifier/app.inject được ghi riêng, không đổi nhãn thành H.
- Docker project/network/ports/realm/users/PG/object/mailbox riêng từng run; fixture mutable riêng từng case; HTTPS proxy và CA/resolver riêng. Platform OTP thật; Web access TTL ngắn chỉ ở profile AUTH-05 riêng.
- Guard manifest, source coverage inventory, private artifact/report và cleanup process group/Compose do harness sở hữu.
- 9 dispatch dựng test ban đầu qua Orca, tối đa 3 worker đồng thời; các dispatch sửa/chẩn đoán sau đó được theo dõi trong cùng Run. Giao file theo slice để tránh worker ghi đè nhau; leader giữ integration/runtime.

## Kết quả baseline trước sửa product (lịch sử)

| Lớp/check                                                      | Kết quả                                | Bằng chứng local                                                                     |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Build mặc định API/worker/shared/Web/Portal production         | PASS                                   | Run `mvs8dgyy-e56379`, các `*-build.log`                                             |
| Toàn bộ browser selector hiện có                               | **34 PASS / 8 FAIL**, không retry/skip | Run `mvs8dgyy-e56379/results.json`, 42 test, khoảng 71 giây                          |
| HTTP thực với Keycloak/API                                     | **5 PASS**                             | Run `mvs88qx2-92e6d4/summary.json`, log `http-<ID>.log`                              |
| Backend PostgreSQL D                                           | **37 PASS / 1 FAIL**                   | Worker run đầy đủ 38 selector, `backend/REPORT.md`; `domain-run.log` private/ignored |
| Backend U                                                      | **14 PASS**                            | Worker run 13 selector, một selector có 2 test; `backend/REPORT.md`                  |
| Manifest guards                                                | **8 PASS**                             | `pnpm test:e2e:guards`                                                               |
| TypeScript, syntax, Prettier, diff whitespace, company journal | PASS                                   | 17 file JS/CJS kiểm syntax; toàn folder TS; inventory 86 ID, không unmapped          |

Artifact run nằm dưới `.artifacts/<run>/`, bị gitignore và có credential synthetic/private key. Không gửi nguyên thư mục hoặc manifest vào issue/PR. Các số ở bảng là các lượt kiểm có phạm vi riêng, không cộng selector trùng qua nhiều run thành tổng test unique.

## Failure ở baseline (đã xử lý; trạng thái mới ở FIXES.md)

| Nhóm                  | Quan sát có bằng chứng                                                                                                                           | Phân loại                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01               | Web authorize có PKCE/state nhưng `nonce` null; test dừng đúng assertion                                                                         | Gap product/acceptance, `apps/web/app/api/auth/login/route.ts` và `src/oidc/authorize.ts`                                                       |
| AUTH-07               | Đổi attendee trong cùng browser sau logout, callback về `/` nhưng BFF `/me` 401; lặp lại ở run riêng `mvs8agqr-aec0b6` và full run               | Cần triage session/login switch; chưa khẳng định nguyên nhân hoặc có rò dữ liệu                                                                 |
| PORT-03               | Clone HTTP thành công trả `{event, operationId, replayed}`; Portal confirmation lại đọc `eventId` ở root nên báo unknown, không chuyển tới clone | Mismatch product giữa `packages/backend/src/event-lifecycle.ts` và `apps/portal/app/t/[tenantId]/e/[eventId]/setup/page.tsx`                    |
| WEB-01                | Published UNLISTED không ở catalog đúng, nhưng public detail trả 404 cho direct link; PRD M03 yêu cầu truy cập được bằng link                    | Gap product tại `packages/backend/src/published-events.ts`; không đổi private fixture thành PUBLIC để lấy PASS                                  |
| WEB-03                | Event redeem giữ query trước login, nhưng callback về `/redeem` mất tenant/event context                                                         | Gap product; `apps/web/app/(consumer)/redeem/page.tsx` dùng `loginHref('/redeem')`                                                              |
| WEB-13 AUTO và MANUAL | Import GUESTS + commit/list thật đã chạy; dispatch-preview trả 201, trong khi `interpretDispatchPreview` chỉ nhận 200, nút gửi bị khóa           | Mismatch product API/Portal; cả hai hành trình dừng trước email/claim, không tính các bước sau là PASS                                          |
| WEB-07                | Full run cuối nhận UI «Phiên trang hết hạn» tại resolve; run riêng `mvs8hj42-606728` PASS                                                        | Chưa ổn định; cần triage CSRF/bootstrap. Không dùng retry tự động hoặc gắn nhãn PASS chung                                                      |
| POL-01                | Dữ liệu PG được scrub, IdP retry/tombstone đúng nhưng `slaOverdue` 0 trong khi admin count 1 với fixture quá hạn                                 | Gap observability do count ngoài actor context/RLS; không phải bằng chứng vi phạm deadline thực tế. Repro trong `backend/retention-db.test.cjs` |

Next streaming `notFound()` có thể trả page HTTP 200: WEB-01 kiểm draft bằng **API 404 + không render published UI**, không dùng page status để thay contract API. Các lỗi test đã sửa trong lượt tích hợp gồm AntD virtual options, thiếu tab, chờ mutation commit, so email không phân biệt hoa/thường và fixture visibility/tenant limits. Lỗi TLS self-rewrite của cách khởi chạy Next đã được xử lý trong harness custom server, không sửa product.

## Phần chưa đủ acceptance

`web/coverage.json`, `portal/coverage.json`, `http/coverage.json`, `backend/coverage.json` ghi cụ thể từng ID và assertion thiếu. Đặc biệt còn fault/revoke/concurrency matrices, đối soát DB đầy đủ cho browser mutation, worker crash/reclaim/provider failure/retry và security/a11y matrices. Những nhánh này **không được tuyên bố hoàn thành** bởi happy path hoặc selector D/U hiện có.

Các gap feature đã thấy: Portal chưa có quota edit và staff invitation accept UI; retention sweepers theo POL-02/POL-03 chưa có đầy đủ trong worker. JOB-08 tiếp tục OUT khi chưa có callback handler. Full 86 nhóm cần tiếp tục bổ sung các assertion còn thiếu và xử lý các blocker product, không đổi expected outcome để suite xanh.

Lệnh chạy và điều kiện local: [README.md](README.md). Không cần model/token AI trong lúc chạy test. Các báo cáo worker là evidence tại thời điểm bàn giao; báo cáo này ghi kết quả integration mới hơn.
