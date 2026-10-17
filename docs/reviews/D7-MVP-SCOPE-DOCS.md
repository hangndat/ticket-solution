# Báo cáo docs — MVP mở rộng (O10)

Ngày: 2026-10-17  
Branch: `hangndat/d7-coord-mvp-docs`  
Đối chiếu Project #3 + `origin/main` `7c1abae72ab0d847e2a909d2da3ed2323edacf94`  
Worker: Orca docs-only (không sửa apps)

## Việc đã làm

Cập nhật phạm vi MVP theo quyết định user 2026-10-17:

| File | Thay đổi chính |
| --- | --- |
| `docs/ROADMAP.md` | §1 bảng D7–D10; §4.1 gate bắt buộc mỗi milestone; §6 D7–D10 + «Ngoài phạm vi có chủ đích»; bỏ Android/payment/seat/Wallet khỏi backlog MVP |
| `docs/PRD.md` | v0.4 — release/MVP mở rộng; tách ngoài phạm vi vs sau MVP |
| `docs/DECISION-LOG.md` | **O10**; cập nhật O01 + ADR-07 |
| `docs/TECHNICAL-DESIGN.md` | Phạm vi + ADR-07 / bảng §18 khớp O10 |

## Trạng thái board đã sync vào §1 (không đổi Issue)

| Parent | Status Project |
| --- | --- |
| D4 (#5) | Hoàn thành |
| D5 (#6) | Đang làm |
| D6 (#81) + #82–#85/#87–#89 | Hoàn thành |
| #7 (title cũ Sau MVP) | Chưa lên lịch — **rewrite thuộc worker GitHub** |

## Ngoài phạm vi có chủ đích (không làm MVP)

- Android native  
- Payment / refund / chuyển nhượng  
- Seat map  
- Apple / Google Wallet  

## Còn lại (không thuộc worker docs này)

1. Worker GitHub: rewrite Issue #7 + tạo/đặt Status Issues D7–D10 trên Project #3.  
2. Không implement code apps trong đợt docs này.  
3. Plan lịch sử `docs/plans/D6-UX-UI-PLAN.md` vẫn nhắc “Sau MVP / #7” — có thể chỉnh trong PR docs follow-up nếu cần; không chặn acceptance O10.

## Acceptance checklist

- [x] ROADMAP phản ánh MVP mở rộng D7–D10  
- [x] Android/payment/seat/Wallet không còn backlog MVP  
- [x] Gate §4.1 (headless UAT + local iOS build + deploy khi authorize + artifact + Project)  
- [x] DECISION-LOG O10  
- [x] Report path: file này  
