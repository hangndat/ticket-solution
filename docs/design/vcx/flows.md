# Flows — VCX-S0-T02

Persona chính: **Event ops / Manager** trên portal (`inventory.*`, `redemption.approve`, `notify.*`, `export.*`).

## F1 — Workspace danh sách Khách & vé

```text
Menu sự kiện → Khách & vé
  → [Danh sách] tab mặc định «Vé» (hoặc tab cuối user chọn — hash #tickets | #requests | #invitations)
  → ProTable load server (cursor)
  → [optional] ô tìm kiếm q (tickets/requests) — debounce
  → Click hàng → Drawer mở
       ├── Header: loại đối tượng (Vé / Yêu cầu / Lời mời) — badge riêng
       ├── Descriptions: trạng thái nghiệp vụ tách cột
       └── Timeline: sự kiện notification, check-in, duyệt — mỗi mục type + thời gian UTC hiển thị locale
  → Đóng drawer → giữ filter/tab
```

**Nhánh:**

- Không quyền ops → `permission-denied` (giữ hiện tại).
- Tab không có quyền đọc → ẩn tab (deny-by-default).
- List 403 → `forbidden` + quay về event overview.
- List 5xx / mạng → `unknown` + «Thử lại».
- Cursor hết trang → «Tải thêm»; empty → `empty` + gợi ý Import (nếu `inventory.import`).

## F2 — Vận hành (giữ, tinh chỉnh Import)

```text
Khách & vé → tab Import
  → Chọn nguồn + loại vé (catalog)
  → Steps 1→4 (xem README §3)
  → Job chạy → user reload trang
       → Banner «Có job nhập chưa hoàn tất» + [Tiếp tục]
       → Hoặc chọn từ «Việc nhập gần đây» (sau list API)
  → Không paste importId
```

Pending / Notifications / Export: flow giữ [PORTAL-IMPLEMENTATION-HANDOFF.md](../PORTAL-IMPLEMENTATION-HANDOFF.md); bulk resend chạm `RESEND_LIMIT` → F4.

## F3 — Tạo sự kiện + review

```text
Events → Tạo sự kiện
  → Bước 1: name, slug (gợi ý), timezone, visibility
  → Bước 2: venue, contact (optional)
  → Bước 3: Review Descriptions (dữ liệu thật từ form)
  → Tạo sự kiện
       → 201 → redirect event overview
       → TENANT_LIMIT_REACHED → F4 (không redirect)
       → unknown network → warning + retry cùng form (idempotency S1-T04)
```

## F4 — Chạm hạn mức / conflict (cross-cutting)

```text
Mutation bất kỳ (tạo event, commit import, lưu config, resend…)
  → Success path như hiện tại
  → REVISION_CONFLICT → Modal: tải lại / hủy
  → TENANT_LIMIT_REACHED → blocking message + navigation
  → RATE_LIMITED / RESEND_LIMIT → inline trên control + copy cooldown
```

## F5 — PII

```text
User không có pii.read
  → Cột email/phone mask trong ProTable + Drawer
  → Tooltip «Cần quyền xem thông tin liên hệ đầy đủ»
User có pii.read
  → Hiển thị đầy đủ + nhãn dữ liệu giả «(mẫu)» trong fixture PD
```
