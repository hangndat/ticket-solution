# States — VCX-S0-T02

Quy ước: dùng `SurfaceState` cho full-page; `ProTable` `empty`/`loading` cho bảng; `Alert`/`Result` cho inline. **Stale:** banner «Dữ liệu có thể đã cũ» + nút làm mới khi `asOf` hoặc tab visible > N phút (implementer chọn N; PD gợi ý 5 phút).

## M1 — Workspace tab Lời mời / Yêu cầu / Vé

| State | Khi nào | UI / hành động |
| --- | --- | --- |
| loading | Fetch list đầu / đổi filter | `SurfaceState` loading hoặc ProTable `loading` |
| ready | 200 + items | ProTable + pagination cursor |
| empty | 200 + `items: []` | `empty` — copy: «Chưa có {loại} trong phạm vi lọc» · CTA Import nếu `inventory.import` |
| error | 4xx không phải 403 | `error` + retry |
| forbidden | 403 | `permission-denied` |
| unknown | 0, 5xx, timeout | `unknown` + retry — **không** hiện bảng rỗng giả |
| stale | User quay lại tab cũ | `Alert` info + «Làm mới» |

**Drawer timeline:**

| State | UI |
| --- | --- |
| loading | `Spin` trong drawer |
| ready | `Timeline` + `Descriptions` |
| error | `Result` nhỏ + đóng drawer |
| empty timeline | «Chưa có hoạt động ghi nhận» |

## M2 — Import wizard (tab Import)

| Bước | loading | error | empty |
| --- | --- | --- | --- |
| 1 Chọn file | Upload parsing | CSV invalid → `rejected` alert | Chưa chọn file → disable «Tiếp» |
| 2 Ghép cột | — | Cột không khớp → giữ ở bước 2 | Preview 0 dòng → cảnh báo |
| 3 Preview | API preview | Lỗi theo dòng trong Table | — |
| 4 Commit | Polling job | `unknown` ≠ success | — |

**Recovery:**

| State | UI |
| --- | --- |
| session có job | Banner warning + «Tiếp tục bước {n}» |
| list API có job IN_PROGRESS | Row trong «Việc nhập gần đây» |
| không có job | Ẩn block recovery |

## M3 — Wizard tạo event — bước review

| State | UI |
| --- | --- |
| loading access | `SurfaceState` loading |
| permission-denied | `SurfaceState` |
| step 3 review | Descriptions đọc form — **không** placeholder text |
| submit busy | Disable Steps + primary loading |
| submit unknown | `Alert` warning — form giữ nguyên |
| TENANT_LIMIT_REACHED | `Alert` error blocking + link events list |

## M4 — Revision conflict (modal)

| State | UI |
| --- | --- |
| conflict detected | `Modal` — không auto-close |
| reloading | `loading` trên modal primary |
| reload done | Đóng modal + form hydrate server |

## M5 — Limit touchpoints

| Code | State UI | Capability action |
| --- | --- | --- |
| `TENANT_LIMIT_REACHED` | `Result` status error | Chỉ điều hướng — không retry blind |
| `RATE_LIMITED` | `Alert` warning | Retry sau |
| `RESEND_LIMIT` | Nút disabled + tooltip | Chờ cooldown |

Actions theo capability: tab ẩn nếu không có perm; nút Import/Approve/Resend disabled + tooltip «Thiếu quyền» thay vì gọi API.
