# #859 — Chẩn đoán F-WEB-04 bởi coordinator

Đây là chẩn đoán root, chưa thay independent revalidation. Cùng tab cũ `55750899-6fd3-4c07-a60b-5379f000cada`, current source Sheet 868394be2323 / SiteNav44c4b9569c21: Escape sau 0/10Tab +ShiftTab vẫn giữ closed dialog khi renderer không nhận frame. RAF diagnostic: tab cũ `visible`, timer/DocumentTimeline chạy nhưng requestAnimationFrame không fired sau1,5s, CSS exit pending/currentTime0/startTimenull; fresh tab có RAF.

Chỉ `orca tab switch --page <old-id> --focus` (reveal Orca browser) đã làm RAF hoạt động và dialog tự unmount. Không reload/source/CSS/DOM/animation.finish intervention. Chạy lại tự nhiên 0Tab và 10Tab+ShiftTab→Escape+1200ms trên chính tab cũ: cả hai dialogMounted=false, focusOnTrigger=true, viewport390×844/DPR1. Đây là căn cứ render-frame suspension của browser tab môi trường; reviewer phải kiểm độc lập cùng tab/coverage trước closure.

Evidence: assets/UI-FIXALL-WEB-FOCUS-ENV-2026-10-23/. `requestAnimationFrame` probe chỉ ghi diagnostic global, không thay DOM/CSS hay focus. Các ảnh/focus fresh normal+reduced EN/VI độc lập vẫn ở UI-FIXALL-FINAL-2026-10-23.md. Không cần sửa callback hoặc bỏ animation vì môi trường tool.
