# Cinematic Ticket Journey — MVP chờ review

Ngày 30/10/2026. Source kiểm tra: `fde877498135f78f85a256a127250acaff06ea95`. Production build ID `qMZckX4yYCnMj9cNfszrA`. Không deploy, push hoặc merge.

## URL local

- VI: http://127.0.0.1:3011/experience
- EN: http://127.0.0.1:3011/en/experience

Server `next start` giữ chạy để review. Đã đóng toàn bộ tab do agent mở và dừng QA proxy3012–3015. Build dùng marketing origin mặc định `https://vemoki.com`; canonical tương ứng `/experience` và `/en/experience`, hreflang vi/en/x-default. Runtime override localhost chỉ phục vụ allowlist analytics local. Cả hai route `noindex`, không nằm trong sitemap. Route cũ redirect về public URL. Homepage/product/auth/attendee không được thay workflow.

## Thay đổi

- Mở cổng bằng cubic smoothstep trên toàn khoảng mở, bỏ bước cuối 0.001 gây bật ảnh; camera/fade sang stage liên tục và đảo ngược theo cuộn.
- Public pages tách khỏi async marketing tree; loading riêng dùng HTML thuần để vẫn đọc được khi streaming reveal script bị chặn. Đã sửa token width khiến chữ fallback mobile bị bó hẹp.
- CTA giữ đích demo/quan tâm, thêm `surface: journey` vào allowlist backend. `journey_progress` chỉ nhận milestone enum + locale; mỗi milestone một lần trong mỗi view, không tổng hợp chương chưa tới. Giữ DNT/GPC, không PII/identity/storage mới.
- Nền marketing/logo dùng bản đã duyệt `95a5d8a354da349c186e3137a9644c1fb31d96f4`, đồng bộ từ công việc tiếp nối trước MVP; không làm lại visual.

## Checks và QA

- `pnpm --filter @ticket/web test`: **325/325**, không skip/fail.
- `pnpm --filter @ticket/web typecheck`, `lint`, `build`: pass. Lint/build chạy lại sau fix width hai className; tests/typecheck tái dùng vì không đổi logic/type.
- `git diff --check`: pass.
- [HTTP smoke](mvp-review/http-smoke-final.json): VI/EN200, canonical đúng locale, noindex, sitemap loại experience. Các trang `/`, `/en`, privacy/support VI/EN đều200; regression tests helpers marketing pass.
- Desktop923×1059, portrait390×844, landscape844×390: không tràn ngang, CTA cuối hiển thị.
- [Keyboard](mvp-review/keyboard-start.json): Tab không vào CTA đang inert; [cuối hành trình](mvp-review/keyboard-complete.json) chuyển focus demo → quan tâm.
- [Reduced motion](mvp-review/reduced-motion.json): năm still sections, không scroll track, 0 animation, CTA không inert.
- No-JS kiểm bằng QA proxy áp CSP `script-src 'none'`, không suy từ HTML ẩn: [snapshot](mvp-review/no-js-snapshot.json), [portrait](mvp-review/no-js-mobile.png), [CTA cuối](mvp-review/no-js-mobile-complete.png). Liên kết vẫn có href; form quan tâm ở marketing đích vẫn dùng cơ chế JS sẵn có, không thêm form no-JS.
- [Ảnh trả503](mvp-review/image-error-state.json) và [trễ2500ms](mvp-review/slow-images-state.json): scroll tới cuối được, CTA không inert; không khóa tiến trình theo tải ảnh.
- [Analytics browser](mvp-review/analytics-browser.json): locale switch sang EN, đi qua và quay lại các chương → đúng5 milestone duy nhất và CTA có source journey. Backend validation/API tests gồm privacy signals và schema allowlist.

## Performance production local

Dùng PerformanceObserver trong Orca Chromium150 trên máy Mac, localhost không throttle, cache warm/revalidated; không dùng dev server/Lighthouse. Đây là lab smoke, không thay dữ liệu production/thiết bị thật.

| Phép đo | LCP | CLS | Điều kiện |
|---|---:|---:|---|
| [Build cuối, desktop923×1059](mvp-review/desktop-performance-final.json) | 80ms | 0 | Source fde87749, cache ấm |
| Mobile frame390×844, build79096851 | Không có entry | 0.08649 | QA iframe, Chromium không cung cấp LCP iframe; không phải top-level mobile load |

Desktop lab đạt mục tiêu ≤2.5s/≤0.1 trong điều kiện trên. **Chưa xác minh LCP mobile**, INP, Safari hay thiết bị thật. Orca reset viewport khi navigation; các file `mobile-performance*.json`/`landscape-performance*.json` có viewport923×1059 không được dùng làm bằng chứng mobile. Iframe chỉ bổ sung CLS, không suy LCP/INP.

[Desktop scroll trace](mvp-review/desktop-scroll.json) và [mobile trace](mvp-review/mobile-scroll.json): mỗi trace362 mẫu tiến/lùi progress0.42→0.80→0.42; 89 giá trị clip khác nhau. Mỗi mẫu đợi **hai** rAF: median26.7ms; max28.3ms desktop/27.7ms mobile. Đây là khoảng lấy mẫu, không phải INP hay phép đo FPS từng frame. Choreography tại64914715 được tái dùng vì không đổi ở các commit routing/fallback sau đó.

## Ảnh review

- [Desktop hiện tại](mvp-review/desktop-final.png), [mobile hiện tại](mvp-review/mobile-final.png), [màn ngang thấp — CTA](mvp-review/landscape-complete.png).
- Mở cổng desktop: [scan0.52](mvp-review/desktop-gate-0.52.png) → [mở0.565](mvp-review/desktop-gate-0.565.png) → [0.595](mvp-review/desktop-gate-0.595.png) → [0.625](mvp-review/desktop-gate-0.625.png) → [stage0.72](mvp-review/desktop-gate-0.72.png).
- Mở cổng mobile: [scan0.52](mvp-review/mobile-gate-0.52.png) → [0.565](mvp-review/mobile-gate-0.565.png) → [0.595](mvp-review/mobile-gate-0.595.png) → [stage0.72](mvp-review/mobile-gate-0.72.png).

## Review và giới hạn

Review độc lập James bằng Codex `gpt-6-sol`, medium (thay Cursor hết usage theo yêu cầu user), cùng một phiên review. [Biên bản](../../reviews/JOURNEY-MVP-REVIEW-2026-10-30.md). Kết luận: UI/UX PASS; các AC chức năng đã kiểm PASS. DoD còn GAP evidence mobile LCP (F02, Medium); F01 no-JS mobile đã xác minh đóng. Chưa đủ bằng chứng để tuyên bố sẵn sàng phát hành.

Giới hạn phát hành: mobile LCP/INP, Safari/thiết bị thật chưa xác minh; cần review visual của người dùng. Analytics backend hiện chưa có external production sink (adapter hiện hữu chỉ log ngoài production); không bổ sung provider trong scope này. Không tuyên bố có dữ liệu analytics bền vững trên dịch vụ ngoài.

[Danh sách đầy đủ file thay đổi](mvp-review/changed-files.txt) từ base21a0b8ab đến source cuối, gồm phần Claude để lại và đồng bộ marketing đã duyệt. File chính của MVP: journey scenes/timeline/progress/publication/page/static-fallback, public routes+loading, hosts/links/robots-sitemap, analytics client/events/validate và regression tests. Evidence/report và company work-events là file bàn giao/tracking bổ sung.
