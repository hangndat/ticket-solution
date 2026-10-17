# O13 — Trạng thái giao diện

Copy gợi ý rút gọn; chuỗi đầy đủ VI/EN trong [copy-vi-en.md](./copy-vi-en.md).

---

## 1. Sales page shell (`/` · `/en`)

| State | Khi nào | Nội dung UI |
| ----- | ------- | ----------- |
| loading | Hydration / locale detect (nếu có) | Skeleton tối thiểu hero wordmark + CTA slots; không flash content sai locale |
| ready | Content + locale đúng | Full sections; demo badge visible gần CTA demo |
| error | CMS/static chunk fail (hiếm) | Message + Reload; giữ nav Privacy/Support |
| denied | N/A marketing public | — |

Không có empty-data state cho sales (static).

---

## 2. Hero CTA — Xem demo

| State | Khi nào | UI / copy |
| ----- | ------- | --------- |
| ready | Default | Button primary + badge `Demo giả lập` / `Simulated demo` |
| focus / hover | Keyboard/pointer | Focus ring `focus` token; không đổi claim |
| disabled | Không dùng (luôn outbound) | — |

---

## 3. Form Đăng ký quan tâm (`#interest`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| ----- | ------- | ------------------------ |
| empty | Chưa nhập / mới load | Fields trống; CTA submit enabled; helper Privacy |
| loading | Đang submit | Submit `disabled` + `aria-busy`; spinner/text “Đang gửi…” / “Sending…” |
| ready | Có thể chỉnh sửa lại sau success? | Sau success: ưu tiên **success** (không ready edit trừ “Gửi thêm”) |
| error / retry | Validation hoặc mạng | Inline field errors **hoặc** banner API; nút Thử lại; focus first error |
| success | 2xx | Heading cảm ơn + 1 câu next step (team sẽ liên hệ); không logo khách; optional “Gửi thêm phản hồi” reset empty |
| denied | Spam / rate limit | Message lịch sự “Thử lại sau”; không lộ internals |

### Validation map

| Field | empty | invalid |
| ----- | ----- | ------- |
| Name | “Nhập họ tên” / “Enter your name” | — |
| Email | “Nhập email” / “Enter your email” | “Email không hợp lệ” / “Enter a valid email” |
| Org | “Nhập tổ chức” / “Enter your organization” | — |
| Role | “Chọn vai trò” / “Select a role” | — |
| Consent | “Cần đồng ý để liên hệ” / “Consent required to contact you” | — |

---

## 4. Locale switcher

| State | Khi nào | UI |
| ----- | ------- | -- |
| ready | Luôn | `VI` \| `EN`; current = `aria-current="true"` |
| loading | Navigating locale | Optional subtle busy trên switcher; không mất focus trap |

---

## 5. Privacy page

| State | Khi nào | UI |
| ----- | ------- | -- |
| ready | 200 + markdown/static | Title + last-updated + sections tối thiểu (data collected, contact) |
| error | Fetch fail | Retry; link Support |
| empty | Không dùng — luôn có stub copy PD | — |

---

## 6. Support page

| State | Khi nào | UI |
| ----- | ------- | -- |
| ready | 200 | Email/contact + giờ phản hồi ước lượng + link sales + link app login |
| error | Fail | Retry + email plaintext fallback |

---

## 7. Demo section (below fold)

| State | Khi nào | UI |
| ----- | ------- | -- |
| ready | Luôn | Banner status role=`status`: rõ fixture; CTA lại Xem demo; **không** logo wall |
| empty / social proof | **Cấm** | Không state “khách hàng tiêu biểu” từ seed |

---

## 8. Micro-link Attendee

| State | UI |
| ----- | -- |
| ready | Text link footer: “Bạn có mã mời?” → app — không primary style |

---

## Component notes

- Primary buttons: tối đa **hai** cùng visual weight trong hero (Demo + Quan tâm). Login = text/ghost.
- Demo badge: luôn adjacent CTA hoặc trong demo section; contrast AA trên paper/ink.
- Motion: nhẹ trên hero visual (parallax/fade ≤200–400ms); tắt khi `prefers-reduced-motion`.
