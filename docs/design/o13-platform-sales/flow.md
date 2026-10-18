# O13 — User flows (trang bán platform)

Personas buyer: **Tenant Owner**, **Agency**. Attendee / Scanner không phải buyer — chỉ xuất hiện như ngữ cảnh sản phẩm.

Touch: **web marketing** (`vemoki.com`). Product shells trên `app.vemoki.com` (không redesign flow product trong O13).

---

## F1 — Prospect hiểu + chọn CTA (happy path)

```text
[Landing / hoặc /en]
    → đọc first viewport (brand + format in-person/Gate)
    → (optional) scroll Ai dùng / Luồng / White-label / An toàn / Demo giả lập
    ├─ CTA "Xem demo" ──► app.vemoki.com  (nhãn Demo giả lập giữ trên marketing;
    │                                      product demo cũng phải nhãn fixture — ownership app)
    ├─ CTA "Đăng ký quan tâm" ──► #interest form
    │       → điền → submit → success (email cảm ơn tùy web)
    └─ Secondary "Đăng nhập" ──► app.vemoki.com/auth
```

**Outcome ≤30s:** biết Vemoki = ops in-person + Gate; multi-tenant/white-label; bước tiếp = demo hoặc quan tâm.

---

## F2 — Đăng ký quan tâm (form)

```text
[#interest]
  empty → user điền
    ├─ validation client fail → error inline + focus field đầu lỗi
    ├─ network/API fail → error banner + Retry
    └─ success → ẩn form fields (hoặc disable) + message success
                 (không redirect bắt buộc; không claim onboard xong)
```

Fields tối thiểu (PD):

| Field | Bắt buộc | Ghi chú |
| ----- | -------- | ------- |
| Họ tên / Name | có | |
| Email | có | format email |
| Tổ chức / Org | có | Owner hoặc Agency |
| Vai trò | có | select: Owner · Agency · Khác |
| Ghi chú | không | textarea ngắn |
| Đồng ý liên hệ | có | checkbox + link Privacy |

**Không** thu thẻ thanh toán / VAT / seat count pricing.

---

## F3 — Locale switch

```text
Header: VI | EN
  VI active trên /… → click EN → /en… (cùng path suffix: /, /privacy, /support)
  EN active trên /en… → click VI → /…
Giữ hash (#interest) nếu đang ở form.
```

---

## F4 — Privacy / Support

```text
Footer / nav phụ
  → /privacy (VI) hoặc /en/privacy
  → /support (VI) hoặc /en/support
Từ form: link Privacy trong checkbox legal.
Support: email/contact tối thiểu + link lại sales.
```

---

## F5 — Nhầm lẫn Attendee (phòng ngừa)

```text
Prospect attendee vào vemoki.com (sales)
  → không thấy CTA "Đổi mã" primary trên hero
  → footer hoặc micro-link: "Bạn có mã mời?" → app.vemoki.com (redeem/home product)
Không đưa redeem form lên marketing hero.
```

---

## Nhánh lỗi / hủy

| Nhánh | Hành vi |
| ----- | ------- |
| Form validation | Inline; không toast-only; announce lỗi (a11y) |
| Form API 4xx/5xx | Banner + Retry; giữ dữ liệu đã nhập |
| Demo link chết / app down | Marketing vẫn show nhãn giả lập; lỗi thuộc product host (không fake success) |
| User hủy form | Clear không bắt buộc; Escape không trap focus |
| JS off | Form vẫn POST progressive enhancement nếu web implement; prototype JS-only OK |

---

## Touch map web vs iOS

| Việc | Marketing web | iOS app |
| ---- | ------------- | ------- |
| Sales / GTM | **Có** (O13) | Không — ASC Marketing URL trỏ web |
| Demo fixture | Link out → app web (và iOS nếu user cài) | Product demo nhãn riêng (ngoài PD sales) |
| Form quan tâm | **Có** trên marketing | Không |
| Privacy / Support | **Có** trên marketing (ASC) | Deep link URL web |

---

## Out of scope flows

- Self-serve billing / pricing calculator
- Agency tạo tenant từ marketing (vẫn qua demo / sales follow-up)
- Attendee redeem end-to-end trên `vemoki.com`
