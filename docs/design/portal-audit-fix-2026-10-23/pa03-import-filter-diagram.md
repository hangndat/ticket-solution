# PA-03 — Phạm vi bộ lọc tab Guests (Import only)

Mục tiêu: **Nguồn mã** và **Loại vé** chỉ hiển thị và áp dụng trong tab **Import**; tab Pending / Notifications / Export không render filter catalog phía trên `ProCard` tabs.

## Sơ đồ (IA)

```text
Guests & codes (PageContainer)
└── ProCard (tabs)
    ├── [Import]     ← ops.import.chooseSource + chooseTicketTypeCatalog (Form/Select)
    │   └── Import panel (CSV upload, preview, commit)
    ├── [Pending]    ← KHÔNG có catalog source/type ở cấp page
    │   └── Pending table + filters riêng pending (nếu có)
    ├── [Notifications]
    │   └── List + copy accepted ≠ delivered
    └── [Export]
        └── Export job form + history (filter exportId = accessible name PA-05)
```

## Quy tắc quan sát (AC PA-03)

| Hành động | Kỳ vọng |
| --- | --- |
| Mở tab Import | Thấy «Chọn nguồn mã» + «Chọn loại vé» trong panel Import |
| Chuyển sang Pending | Hai selector catalog **biến mất**; không hint «đang lọc theo nguồn» ở header tab |
| Chuyển sang Export | Không còn catalog; chỉ control xuất + lịch sử |
| Deep link `?tab=export` | Tương tự — không mount catalog ngoài Import |
| Refresh | Tab active giữ; filter catalog chỉ hydrate khi tab Import |

## HTML snippet (minh họa — specimen)

Trong [portal-full-specimen.html](./prototype/portal-full-specimen.html), `data-testid="import-catalog-filters"` chỉ render khi `tab=import`. Các tab khác dùng `data-testid="import-catalog-filters"` **absent** (probe `catalogVisible: false`).

## Liên kết copy

Bảng VI/EN: [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md).
