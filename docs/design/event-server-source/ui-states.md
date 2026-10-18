# Epic #254 — UI states & copy VI (public event từ server)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Liên quan | [`flows.md`](./flows.md) · [`implementation-notes.md`](./implementation-notes.md) |
| Ngày | 2026-10-18 |

Copy dưới đây là **guest-facing** (Tiếng Việt). Không đưa UUID, schemaVersion, Keycloak, idempotency lên chrome khách — giữ trong handoff / devtools.

Baseline iOS đã có một phần trong `eventsCopy` (`apps/mobile/src/components/screen-state-copy.ts`) — bảng này **chuẩn hóa** cho web + iOS sau khi bỏ fixture làm nguồn chính; implementer cập nhật copy module cho khớp.

---

## 1. List — sự kiện đã xuất bản (theo tenant)

| State | Khi nào | Title (UI) | Detail / body | Actions |
| --- | --- | --- | --- | --- |
| **loading** | Đang `GET …/events` | Đang tải sự kiện | Đang lấy danh sách đã xuất bản. Chưa xác nhận danh sách trống. | — (không show empty) |
| **ready** | `items.length ≥ 1` | (không banner) | Mỗi row: org · name · ngày (hoặc «Chưa có giờ bắt đầu») · media brand | Tap → detail; «Đổi mã» global |
| **empty** | 200 + `items=[]` | Chưa có sự kiện đã xuất bản | Tổ chức này chưa công bố sự kiện nào. Bạn vẫn có thể đổi mã nếu đã có mã. | «Đổi mã lấy vé» · «Thử lại» (optional) |
| **empty-tenant** | Thiếu / sai tenantSlug; hoặc tenant không resolve | Không tìm thấy tổ chức | Đường dẫn tổ chức không hợp lệ hoặc chưa sẵn sàng. | Về trang chủ · nhập lại link |
| **unreachable** | Network / 5xx | Không tải được danh sách | Máy chủ chưa phản hồi. Không hiển thị sự kiện mẫu thay thế. | «Thử lại» |
| **invalid** | 200 nhưng body sai shape | Dữ liệu sự kiện không hợp lệ | Phản hồi không đúng định dạng. Không dùng nội dung dự phòng. | «Thử lại» |
| **misconfigured** | Dev: thiếu API base (iOS) / BFF upstream | Chưa cấu hình kết nối | Ứng dụng chưa trỏ tới API công khai. | (dev) cấu hình URL — không silent demo |

**Không dùng:** emptyDemo / catalog fixture làm primary list. Nếu giữ block «Demo» cho UAT: tách section, eyebrow «Demo · chưa xuất bản», không trộn vào list published.

---

## 2. Detail — một event published

| State | Khi nào | Title (UI) | Detail / body | Actions |
| --- | --- | --- | --- | --- |
| **loading** | Đang `GET …/events/{slug}` | Đang tải sự kiện | Đang tải nội dung đã xuất bản… | — |
| **ready** | Projection OK | `{name}` (H1) | Brand org · time · location · sections · FAQ · terms · media | Primary: «Đổi mã lấy vé»; Secondary: back list |
| **not-found** | 404 (slug sai **hoặc** unpublished / draft) | Sự kiện không khả dụng | Không có nội dung đã xuất bản cho đường dẫn này. Bản nháp không hiện với khách. | «Về danh sách» · «Đổi mã» (nếu đã có mã) |
| **unpublished** | Cùng 404 trừ khi Architect thêm code riêng | *(alias not-found)* | Dùng cùng copy not-found trên public — **không** nói «đang soạn thảo» (tránh dò thông tin) | như not-found |
| **archived** | Event archived / closed — nếu API phân biệt (gap) | Sự kiện đã lưu trữ | Sự kiện này không còn mở trên trang công khai. | «Về danh sách» · không CTA redeem active |
| **unreachable** | Network / 5xx | Không tải được sự kiện | Không kết nối được máy chủ nội dung. Không thay bằng bản demo. | «Thử lại» |
| **invalid** | Body không parse | Nội dung không hợp lệ | Phản hồi sự kiện không đúng định dạng. | «Thử lại» · «Về danh sách» |
| **misconfigured** | Thiếu API base | Chưa cấu hình kết nối | Không tải được nội dung đã xuất bản. | (dev) |

### 2.1 Ready — khối nội dung (second-level)

| Khối | Hiện khi | Empty-in-ready |
| --- | --- | --- |
| Time | `startsAt != null` | Copy: «Chưa có giờ bắt đầu» (secondary) |
| Location | `location != null` | Ẩn hàng địa điểm (không «TBA» giả) |
| Media | `brand.logoUrl` / `bannerUrl` | Placeholder brand color bar — không asset fixture |
| Sections | `visible && order` | Ẩn section `visible=false`; không invent body |
| FAQ | `faq.length > 0` hoặc section faq | Ẩn khối nếu trống |
| Terms | `terms != null` | Ẩn; redeem vẫn enforce termsVersion khi có form |
| Redeem CTA | luôn trên ready **trừ** archived | Section `kind=redeem` bổ sung copy; CTA sticky vẫn có |

---

## 3. CTA surfaces (từ detail / list)

### 3.1 Đổi mã (redeem) — entry từ event

| State | Title | Detail |
| --- | --- | --- |
| ready-cta | Đổi mã lấy vé | Mang mã của bạn — cần đăng nhập và email đã xác minh. |
| denied-auth | Cần đăng nhập | Đăng nhập để đổi mã cho sự kiện này. |
| denied-email | Cần xác minh email | Xác minh email trước khi nhận vé. |

(Chi tiết form redeem states: D11 §2.1 — không lặp lại toàn bộ ở đây.)

### 3.2 Nhận lời mời (claim)

| State | Title | Detail |
| --- | --- | --- |
| entry | Nhận lời mời sự kiện | Khác đổi mã thành viên/tenant. Token không đưa lên thanh địa chỉ sau khi nhận. |
| mismatch | Không khớp lời mời | Email đã xác minh phải khớp lời mời — không tự tạo tài khoản. |

Claim **không** thay world list/detail published; chỉ deep link / `/claim`.

---

## 4. Live region / announce (a11y)

| Sự kiện | Announce (VI) |
| --- | --- |
| List → loading | «Đang tải danh sách sự kiện» |
| List → empty | «Chưa có sự kiện đã xuất bản» |
| List → error | «Không tải được danh sách sự kiện. Có nút thử lại.» |
| Detail → loading | «Đang tải nội dung sự kiện» |
| Detail → not-found | «Sự kiện không khả dụng» |
| Detail → ready | (focus H1 tên sự kiện; không spam toàn body) |
| Retry thành công | «Đã tải xong» (ngắn) |

---

## 5. Mapping state kỹ thuật → UI

| Client / HTTP | UI state |
| --- | --- |
| Abort / network / ≥500 | unreachable |
| 404 detail | not-found (covers unpublished) |
| 200 list `items=[]` | empty |
| 200 parse fail | invalid |
| Missing base URL | misconfigured |
| `content_status=ARCHIVED` (nếu public trả riêng) | archived |
| Draft never on public API | — (operator-only preview) |

**Fail-closed:** mọi error/empty **cấm** fallback `findDemoEvent` / `demo-events`.
