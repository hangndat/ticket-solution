# D11 — Kiểm tra prototype bằng Playwright headless

Epic #222 / PD #225. Source baseline `3e61cde42d55654897048d6d627ab6834b54b808`; prototype **local chưa commit**, SHA256 từng file trong [results.json](./d11-prototype-qa/results.json). Không coi baseline source là SHA nội dung mới hoặc deployed SHA.

## Lệnh và kết quả

- `scripts/web-uat.sh screenshot file:///Users/admin/SideProject/ticket-solution/docs/design/d11-prototype/flows/attendee-redeem.html /tmp/d11-attendee-polished.png` — PASS, screenshot để review composition.
- `node /tmp/ticket-d11-prototype-qa.cjs` — Playwright Chromium `chrome-headless-shell`, headless, không điều khiển chuột macOS. Script kiểm tra trên prototype file local; không gọi API/DB.
- Kết quả cuối: **29/29 PASS**, `2026-10-17T16:54:59.793Z`. `source-unchanged-during-check` PASS; file hashes pin trong JSON.

## Nội dung kiểm tra

- Hub + 3 flow, desktop 1280px và mobile 390px: không tràn ngang, state switches không phát sinh exception.
- Attendee: mã trim rỗng và chưa đồng ý điều khoản không cấp vé; đang xử lý khóa submit; chuyển offline hủy timer cũ; form demo hợp lệ hiển thị vé demo.
- Admin: blocked/unclear/offline đều khóa Publish.
- Staff: queued/conflict/unknown không hiển thị tone admitted.
- Không có `pageerror` JavaScript.

Trước fix, 4 checks form FAIL; PD fix `ctx_c25fa83c254d` đã xử lý validation/focus, disable double-submit, timer cancel/nonce và reduced-motion. Chỉ kết quả cuối trên hashes trong JSON được dùng cho bàn giao này.

## Ảnh review

- [Admin desktop](./d11-prototype-qa/flows-admin-readiness-1280.png)
- [Attendee mobile](./d11-prototype-qa/flows-attendee-redeem-390.png)
- [Thẻ vé demo](./d11-prototype-qa/attendee-issued.png)
- [Staff mobile](./d11-prototype-qa/flows-staff-scan-390.png)

## Giới hạn

Đây là **kiểm tra prototype**, không phải UAT ứng dụng web/iOS production, không kiểm chứng API/RLS/concurrency, native camera/haptics/push, screen reader thật hay WCAG AA toàn bộ. Nghiên cứu người dùng chưa chạy; không claim pilot/production ready. Không build iOS vì pha này không sửa app; không EAS Cloud, không deploy/store.
