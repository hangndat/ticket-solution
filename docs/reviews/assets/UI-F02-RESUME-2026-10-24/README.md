# UI-F02-RESUME-2026-10-24

Simulator **UI-FixAll-859** `B0727247-340D-423A-8547-A6C107A9756A`, Debug SDK 58, 1179×2556 px (393×852 pt @3), VI.

| File | Mô tả |
| --- | --- |
| `boot-after-fix.png` | Sau `simctl launch` + Metro reload |
| `f02-applied-offline-7s.png` | Manual entry + proxy offline → confirm sheet |
| `f02-applied-foreground-20s.png` | Sau sim home + relaunch (sheet vẫn mở — UAT chưa hoàn tất submit queue) |
| `f02-applied-queued-offline.png` | Cùng trạng thái confirm (automation chưa bấm «Gửi kiểm tra cổng») |
| `f02-applied-after-relaunch-3s.png` | Relaunch 3s — sheet persist |

**Giới hạn:** Orca computer UAT chưa đóng confirm sheet → chưa chứng minh APPLIED foreground end-to-end trong phiên này; unit + code trace là căn cứ chính. Reviewer nên chạy: offline → «Gửi kiểm tra cổng» → queued >5s → online → Home → app 20–30s → panel terminal.
