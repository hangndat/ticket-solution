# PA-02 / PA-03 — Copy vận hành Guests (VI / EN)

Bảng dưới dành cho Web A (`messages.ts` + panels). **Giữ** phân biệt nghiệp vụ: accepted ≠ delivered, unknown ≠ success, publish ≠ open redeem ≠ gate, PII masked, role deny; **không** đổi UUID lookup CS thành tìm tên/email. **PA-03:** `Nguồn mã` / `Loại vé` chỉ hiển thị trong tab **Import** (không render phía trên `ProCard` tabs).

| Key / vùng | VI (đề xuất) | EN (đề xuất) | Ghi chú |
| --- | --- | --- | --- |
| Tab Import | Nhập từ CSV | Import from CSV | Tiêu đề tab ngắn; panel title giữ `ops.import.panelTitle` |
| `ops.import.panelTitle` | Nhập khách và mã từ CSV | Import guests and codes from CSV | OK giữ |
| `ops.import.panelDescription` | Tải file CSV → xem trước (không giữ suất) → ghi nhận. Báo cáo lỗi tải riêng khi đăng nhập, không dùng link tạm. | Upload CSV → preview (does not hold quota) → commit. Error report downloads separately when signed in; no temporary public link. | Bỏ *idempotent*, *stream authenticated*, *poll* |
| `ops.import.catalogHint` | Chọn nguồn và loại vé từ danh mục sự kiện (không gõ mã tay). | Pick source and ticket type from the event catalog (do not type IDs manually). | Bỏ mapping revision / ID kỹ thuật trên luồng chính |
| `ops.import.dispatchPreviewNotice` | Xem trước gửi thử không giữ suất và không gửi email. | Dispatch preview does not hold quota and does not send email. | |
| Tab Pending | `guests.pendingTitle` Chờ duyệt | Pending approval | |
| `guests.h_1tkjxlx` (alert Guests) | Xem trước không giữ suất. Nhà cung cấp đã tiếp nhận chưa chứng minh khách đã nhận email. Chọn nguồn và loại vé từ danh mục. | Preview does not hold quota. Accepted by the provider does not prove the guest received email. Pick source and ticket type from the catalog. | Không dùng «đã gửi» thay *delivered* |
| Tab Notifications | Thông báo | Notifications | `guests.h_1avy3de` |
| `ops.notifications.listSummary` | Thông báo: {{count}} mục{{pageSuffix}}. Đã tiếp nhận gửi ≠ khách đã nhận email. | Notifications: {{count}} item{{pageSuffix}}. Accepted ≠ delivered. | VI: nhà cung cấp tiếp nhận ≠ delivered tới khách |
| Tab Export — `ops.export.panelInfo` | Xuất danh sách CSV | Export guest list (CSV) | Bỏ G-E1 / recovery jargon |
| `ops.export.panelDescription` | Tạo yêu cầu xuất → kiểm tra trạng thái → tải khi sẵn sàng. Danh sách không hiện link file trực tiếp. Kết quả chưa rõ ≠ đã thành công. | Create export → check status → download when ready. List never shows direct file links. Unknown outcome ≠ success. | |
| `ops.export.filterHistory` | Lọc lịch sử xuất | Filter export history | |
| `ops.export.historyEmpty` | Chưa có lịch sử xuất (hoặc không tải được danh sách). | No export history yet (or could not load the list). | |
| `ops.export.jobLabel` | Xuất {{exportId}}: {{status}}{{rowsSuffix}}{{expiresSuffix}}. Chỉ tải khi trạng thái sẵn sàng; link có thời hạn. | Export {{exportId}}: {{status}}{{rowsSuffix}}{{expiresSuffix}}. Download only when ready; link expires. | Bỏ READY literal nếu status đã dịch |
| `ops.export.unknown` | Chưa xác định kết quả xuất. Không coi là đã tạo hoặc đã tải. | Export outcome unknown. Do not treat as created or downloaded. | |
| Export field a11y (PA-05) | Nhãn: «Mã yêu cầu xuất» · placeholder «Nhập mã yêu cầu» | Label: «Export request ID» · placeholder «Enter export request ID» | Thay `exportId` aria/placeholder |
| `ops.import.chooseSource` | Chọn nguồn mã | Select code source | PA-03: chỉ trong Import |
| `ops.import.chooseTicketTypeCatalog` | Chọn loại vé | Select ticket type | PA-03: chỉ trong Import |
| `ops.guests.needPermissions` | Thiếu quyền thao tác trên máy chủ (nhập / duyệt / gửi thông báo / xuất). | Missing server permission for import, approval, notifications, or export. | Bỏ liệt kê permission string |
| CS lookup (không đổi hành vi) | Giữ tra cứu theo mã vé / yêu cầu (UUID). Nhãn: «Mã vé hoặc mã yêu cầu» | Keep lookup by ticket or request ID (UUID). Label: «Ticket or request ID» | Không mở search tên/email |

**UTC / locale (PA-04):** Giữ hiển thị múi giờ UTC trong báo cáo; formatter dùng locale người dùng chỉ cho **định dạng** (ngày/giờ), không đổi instant nghiệp vụ.
