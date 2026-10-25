# Copy VI — workspace, conflict, limit

Dữ liệu demo trong prototype có hậu tố «(mẫu)». EN: giữ key i18n hiện có khi implement; bảng này là chuẩn VI cho string mới.

## Workspace — cột & tag (tách trường)

| Trường UI | Không gộp với |
| --- | --- |
| Trạng thái lời mời | trạng thái vé |
| Trạng thái yêu cầu đổi mã | trạng thái lời mời |
| Trạng thái vé | yêu cầu đổi mã |
| Thông báo (đã tiếp nhận gửi) | khách đã nhận email |
| Check-in | trạng thái vé revoked/used |

**Tab labels:** `Lời mời` · `Yêu cầu đổi mã` · `Vé`

**Drawer title:** `Chi tiết vé (mẫu)` / `Chi tiết yêu cầu (mẫu)` / `Chi tiết lời mời (mẫu)`

**PII mask hint:** `Thông tin liên hệ được ẩn một phần theo quyền tài khoản.`

## Import wizard

| Key / vùng | VI |
| --- | --- |
| Step 1 | Chọn file |
| Step 2 | Ghép cột |
| Step 3 | Xem trước |
| Step 4 | Ghi nhận |
| Recovery banner | `Còn một lần nhập chưa hoàn tất (mẫu).` · CTA `Tiếp tục` |
| Recent jobs title | `Việc nhập gần đây` |
| Job row | `Nhập khách · đang xử lý · bắt đầu 14:32 (mẫu)` |

## Wizard review

| Vùng | VI |
| --- | --- |
| Step title | `Xem lại trước khi tạo` |
| Slug hint | `Đường dẫn sự kiện — có thể sửa ở bước trước` |
| Submit | `Tạo sự kiện` |

## Conflict revision

| Tình huống | Title | Body | Primary | Secondary |
| --- | --- | --- | --- | --- |
| REVISION_CONFLICT | `Phiên bản đã thay đổi` | `Người khác vừa lưu. Tải lại để xem bản mới nhất — thay đổi của bạn chưa gửi sẽ mất nếu không sao chép.` | `Tải lại bản mới` | `Đóng` |
| Unsaved guard | `Bỏ thay đổi chưa lưu?` | `Nội dung trên màn hình chưa được lưu lên máy chủ.` | `Ở lại` | `Rời trang` |

**Không hiển thị** `expectedRevision`, `importId`, UUID trong copy user-facing.

## Limit errors

| Code | Title | Description | CTA |
| --- | --- | --- | --- |
| `TENANT_LIMIT_REACHED` | `Đã đạt giới hạn gói` | `Tổ chức đã dùng hết hạn mức cho thao tác này (mẫu). Liên hệ quản trị nền tảng nếu cần mở rộng.` | `Về danh sách sự kiện` |
| `RATE_LIMITED` | `Thao tác quá nhanh` | `Hệ thống tạm giới hạn. Thử lại sau ít phút.` | `Thử lại` |
| `RESEND_LIMIT` | `Đã gửi lại nhiều lần` | `Chờ trước khi gửi lại thông báo cho mục này.` | _(disable nút Gửi lại)_ |

Tooltip resend: `Còn có thể gửi lại sau {{minutes}} phút (mẫu).` — chỉ khi API cung cấp.
