# #869 — web function checkpoint (Linh)

- Base/HEAD lúc làm: `109e0c59066498071f95fdf6e4851f2d4f6af6d9`; thay đổi chưa commit, coordinator tích hợp và review trên exact SHA sau.
- Phạm vi sửa của batch này: `apps/web/**`; báo cáo này là handoff được Task chỉ định. Không sửa root/F01, backend, shared, marketing hoặc catalog. Bộ đếm review/fix 2/2 + ngoại lệ giữ nguyên.
- Trạng thái: code complete cho các lỗi đã tái hiện; acceptance complete **chưa đạt** vì single-code confirm→wallet và account mutation QA riêng chưa xác nhận qua browser. Không kết luận pilot ready.

## Hành vi trước / sau và evidence

| Luồng | Trước | Sau / mức xác nhận |
| --- | --- | --- |
| Email invitation, `form:null` | Orca page `3c946763-8ac6-44cf-b48d-0d39f91a45a5` mở link fixture thật, OIDC attendee đã đăng nhập, schema public trả `form:null`, `termsVersion:terms-v1`. Đồng ý terms rồi POST `/api/bff/claim` trả 422 `FORM_VERSION_REQUIRED`; UI hiện “Không đổi được mã”. BFF bắt buộc cả hai version, trái contract `InvitationClaimBody.formVersion?` và backend consent cho phép bỏ formVersion khi không có form. | BFF chỉ đòi `termsVersion`, bỏ `formVersion` nếu form null. Cùng fixture, UI gửi lại sau sửa: trạng thái “Đổi mã thành công”, vé ACTIVE; intent trong `sessionStorage` đã xóa nhưng kết quả và link wallet vẫn hiện (`main=1`, không hiện empty). Click wallet: 4 vé, MFest tăng thành 2, có card mới tiền tố vé `CF3411E3`. Đây là claim thật với attendee OIDC đã có cookie; batch này chưa tái kiểm trọn fresh-login return. Không lưu/in token hoặc raw link trong report. |
| Claim pending, unknown, context | Source cũ xóa intent cả pending và khóa submit bằng `claimedKey`; nút “Kiểm tra lại” gọi lại `submitClaim` nên pending không thể kiểm tra. Context đổi trong request không reset busy; response cũ có thể giữ trạng thái cũ. | Pending giữ kết quả sau khi xóa token; nút gọi owner-status GET bằng requestId, không POST lại claim. Unknown giữ cùng idempotency key khi gửi lại. Context mới reset busy/form/terms/result; callback schema/claim/owner-status kiểm tra context hiện hành trước khi áp dụng. Đây là kiểm chứng logic + tests nền hiện có; chưa có fixture pending/timeout thật để chứng minh UI runtime. |
| Claim BFF malformed body | Test mới `claim-route.test.ts`: JSON `null` gây TypeError khi đọc tenant scope. | Trả 400 `INVALID_JSON` cho null/array/scope sai type trước khi đọc scope; test đỏ trước sửa, xanh sau sửa. |
| Single-code `/redeem` | Orca page `8ce1af2b-51ed-4917-be4e-d781ec9aa815`: mã không hợp lệ cho đúng error nhưng copy nói “sự kiện đã chọn”, dù màn một mã không chọn event. “Thử mã khác” được kiểm tra: mã và lỗi xóa. | Copy lỗi trung tính. Submit bị chặn khi outcome đang pending/unknown/issued; pending có nút GET owner-status trong product UI, unknown chỉ poll cùng key. Reset mã khác xóa scope/attempt cũ; code input disabled khi request đang chạy. Nhánh mã sai đã kiểm thật; confirm/issue bằng mã QA `DEMO-MFEST-003` **chưa gửi** vì runtime gap dưới đây. |
| Account deletion | Decoder web chỉ chấp nhận ACK `AWAITING_POLICY/UNRESOLVED`, trong khi backend hiện trả 201 `REQUESTED/RESOLVED/anonymizeWithinDays:30`. Test thêm response thật đỏ trước sửa. Unknown retry tạo UUID mới; current malformed 200 có thể thành “chưa có yêu cầu”. | Decoder/type bám response backend, test xanh; không gọi accepted là completed. Unknown giữ idempotency key khi gửi lại; khóa double click đồng bộ; current sai shape báo error; `REJECTED` cho phép gửi yêu cầu mới, `COMPLETED` hiện đúng nhãn. Orca page `9e8cb9d2-d45e-41cb-b456-bce74282f78d` trên attendee: GET current empty, nút disabled trước checkbox. **Không POST xóa trên attendee/user account**; coordinator có QA OIDC account/profile cô lập để xác nhận mutation. |

## Runtime / giới hạn UAT

- Đầu batch, tab `/redeem` mới có `main=1`, form hydrate, console trống; tab claim fixture có `main=1`, hash đã xóa và intent parked, submit thật thành công.
- Sau `pnpm --filter @ticket/web build` và reload `/redeem`, một probe thấy `document.readyState=complete`, `main=2`, loading fallback và form SSR cùng tồn tại; console chỉ thấy Fast Refresh/HMR, không có lỗi ứng dụng rõ. Đây là cùng loại gap handoff trước, không riêng claim. Không restart hay thử lặp để vượt gap. Mã QA `003` chưa consume; không dùng `002` dành user.
- Thử profile Orca isolated mới qua `tab profile clone` của link đã scrub hash chỉ mở `/claim` trống (`parked=false`, `main=1`), nên không dùng phép này làm bằng chứng fresh OIDC return.
- Đã đóng 5 tab do mình mở: `8ce1af2b-51ed-4917-be4e-d781ec9aa815`, `3c946763-8ac6-44cf-b48d-0d39f91a45a5`, `9e8cb9d2-d45e-41cb-b456-bce74282f78d`, `05024351-fee8-40df-b07c-28f2c224a550`, `4073218e-a52c-47a0-98c5-810cca0737e4`; đã xóa profile isolated `ff5ee372-c3f6-4a41-845f-ac09e0f3e22c`. Giữ local stack và tab QA của coordinator.

## Kiểm tra

- `pnpm --filter @ticket/web test`: PASS (0 fail, 0 skip).
- `pnpm --filter @ticket/web lint`: PASS.
- `pnpm --filter @ticket/web typecheck`: PASS.
- `pnpm --filter @ticket/web build`: PASS; warning Turbopack cũ tại `src/marketing/lead/idempotency.ts` về filesystem tracing, ngoài scope.
- `git diff --check -- apps/web`: PASS.

## Review / việc còn lại

1. Coordinator tích hợp exact SHA; reviewer độc lập kiểm diff F07–F10, nhất là context switch/unknown và deletion ACK. Không cộng thêm lượt review/fix tự động ngoài giới hạn đã chốt.
2. Single-code real confirm→wallet cần chạy lại bằng mã QA `003` khi local runtime hydrate ổn định; ghi rõ kết quả thực thay vì suy từ unit tests.
3. Account mutation chỉ thử trên QA account cô lập của coordinator; xác minh ACK `REQUESTED` và session revocation, không thử trên attendee/user fixture.
