# Spec đề xuất — D11-B8 Milestone gate (sau khi có coding đợt)

> **CHƯA APPROVED.** Chỉ mở khi user duyệt pha B và có Stories coding hoàn tất đủ để đóng đợt.

## Vai trò

- Coordinator (+ workers ownership cho từng evidence Task)  
- Reviewer: `reviewer-dod` trên exact SHA tích hợp

## Mục tiêu

Đóng parent đợt triển khai D11 (nếu có) theo ROADMAP §4.1 — **không** suy pilot ready.

## Gate bắt buộc

1. Headless UAT web và/hoặc iOS theo scope đã merge  
2. Local iOS build (prebuild + xcodebuild) nếu đụng `apps/mobile` — **cấm** EAS Cloud  
3. Deploy prod **chỉ** nếu task ủy quyền; không thì ghi “chưa deploy”  
4. Artifacts `docs/reviews/*` + exact SHA  
5. Project Status sync (coordinator)

## Bổ sung production (không tự miễn)

- [ ] O06: còn mở thì **không** tuyên bố sẵn sàng PII thật  
- [ ] Privacy URL / deletion: trạng thái observed ghi rõ  
- [ ] Runbook/rollback đã review bởi on-call giả định  
- [ ] Device UAT: chỉ PASS khi có evidence thiết bị; không dùng sim thay thế  
- [ ] Store submit: mặc định **không**

## OUT

Tự deploy/store; đánh dấu Hoàn thành chỉ vì `worker_done`.
