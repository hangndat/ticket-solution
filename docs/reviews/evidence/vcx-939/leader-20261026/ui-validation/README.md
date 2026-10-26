# F-976-01 — bổ sung validation UI

Đóng phần thiếu evidence của review trên 53f175d1311565cc6db157feff7e5fb7d4ea6c45; không thay business code.

- Chạy nguyên bản docs/agents/tools/ui-chrome-wrap-probe.js qua Orca eval cho owner /redeem (form có scope fixture đã tải xong) và guest /claim tại 390×844, 1024×900, 1440×900. Sáu JSON ghi viewport thực, page, route, thời điểm và sourceCodeSha; tất cả issues=[].
- Probe kiểm chrome/control wrap, không phải proof lại mọi outcome. Bốn scenario chức năng và guest pending→rejected tái dùng packet cùng source tree; không lặp mutation/API/SMTP.
- Source runtime vẫn 1f4ce0be, production build FBtTotHjh3LNaWJJ8TiMh, API riêng3540 qua proxy3541; không thay source/env để đo.
- Chạy chế độ ưu tiên sẵn có của checker: bash docs/agents/tools/ui-evidence-check.sh --manifest docs/reviews/evidence/vcx-939/leader-20261026/manifest.json → PASS (full provenance/state/scope gate). Không sửa checker, snapshot JSON hay ảnh để né duplicate.
- Vì accessibility tree có thể giống byte giữa 1024/1440 dù PNG khác, dùng manifest hash + viewport PNG thay chế độ duplicate mọi file trong folder. 32 PNG nguyên bản đều khác hash. Đây là hai chế độ đã có trong script; manifest là gate được script ghi preferred.
- cleanup.json xác nhận hai tab mới đã đóng. Giữ nguyên các tab user và server review.

Reviewer cần revalidate F-976-01 theo diff evidence trên tip mới; code/security PASS cũ chỉ tái dùng khi apps/web/API/backend không đổi.
