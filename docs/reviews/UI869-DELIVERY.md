# #869 / PR #870 — bàn giao web, local starter và hồ sơ nhân sự

Baseline `30ce1daa60572f6309305436ff9aa29a17ccebe1`. User authorize thực hiện và review local; **chưa merge/deploy**. Phần UX vẫn là batch sửa **2/2**, không reset counter khi phục hồi Linh hoặc hoàn thiện AC còn thiếu. Phạm vi local starter/company do user yêu cầu bổ sung trực tiếp.

## Kết quả triển khai

| Feedback | Thay đổi / kiểm chứng |
| --- | --- |
| Lang marketing nhảy layout | Root tái hiện bằng ảnh VI/EN1024: locale group bị menu dịch đẩy ngang. Đưa group ra khỏi flex nav, neo sau wordmark không co, width cố định5.5rem. Ảnh đối chiếu VI/EN390/1024/1440 trong `assets/UI869-ROOT/locale-after-*`; không overflow ngang. Probe DOM trả0/empty vì streamed/hidden nodes nên không dùng số đo đó để claim PASS computed matrix. |
| Media mockup | Hero dùng ảnh runtime sản phẩm thật từ production local, không fake browser/device/QR. Capture có content hash trong filename + provenance manifest trong `apps/web/public/marketing/product/`; tránh optimizer cache giữ ảnh cũ. Bỏ media mockup ở7 bento feature; giữ copy gọn thay vì ảnh không đúng capability. |
| Toàn bộ banner/hero | Mẫu canonical `docs/design/UI869-FEEDBACK/README.md`, prototype đã render marketing1440/390 và catalog1440. Hero giảm copy/CTA/chiều cao thừa; catalog chuyển nền giấy, title/intro và link đổi mã. Ảnh bìa sự kiện giữ nguyên (user chưa yêu cầu đổi nội dung ảnh). |
| Card Khám phá | Shared `CatalogEventCard` giãn theo hàng, body flex và CTA ở đáy. Root đo2 card1440 đều343.375px, CTA cùng y717.281px ở bản trước thay banner; production capture mới xác nhận card/owned strip thẳng hàng. |
| Input / empty state / section nav | Control chrome dùng chung trong web cho search/select/textarea và form fields; empty có khoảng thở + xóa bộ lọc; anchor smooth-scroll + sticky offset, reduced motion. Giữ validation/business contract. |
| Trang đệm tải | Bỏ status card toàn trang; skeleton riêng catalog/wallet/redeem/event/marketing. Root bổ sung ConsumerPageShell vào loading vì layout chỉ có footer, không có nav như worker report ban đầu suy luận. Skeleton không vượt chiều ngang mobile. |
| Header đổi mã mờ | Root đo visible header opacity0 do fade-in. Entry motion giữ nội dung visible theo mặc định; bỏ fade-to-zero. Không thêm hiệu ứng che nội dung trong lúc đợi. |

## Local sống lâu dài

- Product **http://localhost:3417**, marketing **http://marketing.localhost:3417**, API3498, Keycloak8080. Listener/service infra chỉ loopback, compose project`ui869dev` riêng, DB`ticket_ui869_dev` riêng, runtime role không bypassRLS.
- `scripts/dev-local-stack.sh up/status/logs/down/fixtures/seed --reset/install-autostart/uninstall-autostart`. LaunchAgent`com.vemoki.dev.ui869` đã được cài theo yêu cầu user; supervisor tự khởi động lại tiến trình chết. `down` pause, `up` resume; giữ volumes/data. Không cần khởi động lại từng dịch vụ mỗi phiên.
- Python helper dùng session/process group riêng và PID+start-time identity; không kill group của terminal khác hoặc PID tái sử dụng. Start/stop serialize theo service. Unit tests kiểm cả descendant/foreign PID/pause.
- Keycloak thật với ignored realm copy cho redirect local; không sửa realm production/shared, không mock auth. Chỉ bỏ required action TOTP của2 tài khoản fixture để seed local; không áp vào user khác.
- Fixture mở rộng:3 sự kiện,2 tenant,25 mã, vé cho sự kiện tương lai/quá khứ. Routing backfill qua hàm backend hiện có; ticket seed qua real OIDC/API. Rerun giữ consumed tickets, normal restart không reseed.
- Structured scenarios/accounts local: `docs/demo/UI869-LOCAL-FIXTURES.json`. Runbook: `docs/ops/UI869-LOCAL-RUNBOOK.md`.

## Runtime evidence của root

- Orca browser: đăng nhập attendee qua Keycloak → resolve`DEMO-MFEST-001` → đồng ý điều khoản → **Đổi mã thành công** → ví có3 vé; PNG`redeem-success-1440.png` / `wallet-ready-1440.png`. Toàn bộ là fixture local, không dữ liệu khách thật.
- Trong lần đầu root restart API đúng lúc submit, BFF trả502; UI giữ unknown outcome, không hiện vé giả. Sau API ổn định, root thực hiện lại journey và có success nêu trên. Không quy lỗi môi trường này thành bug nghiệp vụ.
- `stop-proof.json`:3417/3498 không listener, pause=true, không containerui869dev chạy sau hơn1 tick supervisor. `up` sau đó giữ dữ liệu. Noah đã có proof API crash được restart; root kiểm thêm private process ownership/pause bằng4 tests.
- DOM/a11y snapshot của Orca có lúc giữ streamed loading nodes dù screenshot/visible DOM đã ready; evidence không giả kết luận computed matrix/a11y đầy đủ. Screenshot được đo viewport thật; reviewer tiếp tục kiểm interaction trong phạm vi diff.
- Browser pages và production/prototype server dùng cho capture đã đóng; persistent dev stack được giữ để user live check.

## Công ty agent — dữ liệu có cấu trúc, chưa dashboard

`company/employees.json`:16 nhân viên, ID/tên/role/tính cách/văn phong/model mặc định riêng. Giữ các tên roster cũ, bổ sung Minh/Linh/Noah theo đợt hiện tại. `company/work-events.jsonl` + JSON Schema ghi giao việc, model requested/effective, interruption/recovery, kết quả và release. Khôi phục Linh giữ cùng employee/task/branch.

Workflow wrapper bắt buộc `--employee` và task title đúng tên/role trước start; ghi receipt sau launch và settlement thật. Tests kiểm mismatch không launch, dedupe, timestamp UTC, identity conflict và settlement không gắn nhầm nhân viên. Quota/model vẫn theo cost-catalog; không đổi billing. Nhật ký live tiếp tục append trong working tree, snapshot commit theo mốc; `settled` không tự đồng nghĩa nghiệm thu PASS.

## Checks trước review độc lập

Web lint PASS, web tests286/286 PASS, web production build + TypeScript PASS; UI shared17/17 PASS; workflow78/78 PASS; process ownership4/4 PASS; shell syntax và ui-budget PASS. Build còn cảnh báo tracing filesystem ở marketing lead idempotency (đã có trước, không đổi trong diff).

**Trạng thái:** code complete và local journey chính đã kiểm. CI trên `7df8f64` xanh; James review độc lập phát hiện F01–F06, chưa acceptance complete. Chẩn đoán và một lượt ngoại lệ duy nhất được ghi tại `UI869-DIAGNOSIS.md` / `UI869-EXCEPTION-HANDOFF.md`; chờ revalidation exact SHA mới + CI. Không gọi pilot ready; các flow ngoài web scope như native Gate/offline và portal không được nhận là đã UAT trong đợt này.
