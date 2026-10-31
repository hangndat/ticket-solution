# Review độc lập — Cinematic Journey MVP (2026-10-30)

**Reviewer:** James (`reviewer-dod + reviewer-uiux`). **Lượt fix:** 1/2. **Baseline:** `21a0b8ab0f6978d792556bff2bb6d045947c9727`. **SHA giao review:** `64914715739e82a9674b28e19b2819407a389423`. **SHA revalidate cuối:** `fde877498135f78f85a256a127250acaff06ea95`.

## Verdict

- **DoD: GAP về evidence hiệu năng mobile; các AC chức năng đã kiểm là PASS.** Tại SHA cuối, LCP desktop 80 ms và CLS 0 trên Chromium local, production build, cache hỗn hợp ấm, không throttle; CLS khung 390×844 là 0,08649. `mobile-frame-performance-final.json` không thu được LCP vì giới hạn PerformanceObserver trong iframe; các phép navigation mobile trong Orca tự đổi viewport về 923×1059 nên không chứng minh LCP mobile. Không suy diễn số desktop thành mobile.
- **UI/UX: PASS tại SHA cuối.** Ảnh desktop, mobile, landscape, reduced motion và no-JS sau fix giữ hướng visual spike đã duyệt; CTA đọc và thao tác được. F01 dưới đây đã đóng bằng ảnh sau fix.
- **Security chuyên sâu:** N/A theo scope. Kiểm privacy/allowlist analytics trong DoD: PASS qua source, test và browser evidence; không có PII trong payload quan sát.

## Findings và điều kiện đóng

| ID | Mức | Trạng thái | Bằng chứng, tác động và cách tái hiện | Điều kiện đóng |
| --- | --- | --- | --- | --- |
| F01 | High · UI | **Đã xác minh đóng** tại `fde87749` | Tại `79096851`, reviewer và coordinator xem no-JS mobile 390×844: copy fallback thành cột rất hẹp, từng từ xuống dòng; ảnh trước fix đã bị ghi đè trong cùng đường dẫn khi revalidate. Theme làm `max-w-xl` tính còn 20 px. | Đổi fallback copy sang `w-full max-w-[36rem]` và brand body sang `max-w-[36rem]`; ảnh `no-js-mobile.png`, `no-js-mobile-complete.png` sau fix cho thấy copy rộng 350 px, hai CTA nhìn thấy; `no-js-state.json` ghi overflow 0. |
| F02 | Medium · evidence | **Mở** | Chưa có LCP mobile đúng viewport navigation. Iframe 390×844 đo CLS nhưng LCP rỗng; cả thử native `orca viewport --mobile` cũng trở về 923×1059 sau navigation (`mobile-native-viewport-attempt.json`). | Thu một phép đo LCP local trên navigation 390×844 có điều kiện cache/throttle ghi rõ và xác nhận ≤ 2500 ms, hoặc ghi quyết định chấp nhận GAP theo gate phát hành. |

## Đối chiếu AC

| AC | Kết luận và evidence |
| --- | --- |
| Cửa mở liên tục, đảo chiều, không snap | PASS source: `doorInset()` dùng smoothstep trên đoạn 0,55–0,64; test quét bước 0,001; ảnh gate nhiều mốc desktop/mobile và trace cuộn tiến/lùi trong `mvp-review/`. Choreography không đổi từ SHA giao review. |
| Public VI/EN, SEO và tương thích | PASS: HTTP 200 ở `/experience`, `/en/experience`; canonical riêng từng locale, hreflang vi/en/x-default; `noindex, follow`; sitemap loại hai URL. Build dùng `MARKETING_ORIGIN` mặc định `https://vemoki.com`, nên metadata local vẫn trỏ origin đó; runtime local override phục vụ analytics. Source routing tại SHA cuối cho public path `next` thay vì rewrite vòng; product `/` và `/auth` giữ nhánh cũ. |
| CTA demo/interest | PASS: demo đến `https://app.vemoki.com/?demo=1`, interest về `/#interest` hoặc `/en#interest`; browser state cho thấy CTA cuối visible, không inert. |
| Analytics | PASS: `journey_progress` chỉ nhận 5 milestone và locale allowlist; `cta_click` chỉ nhận CTA ID, locale và surface `journey`; source client không thêm định danh/PII, DNT/GPC chặn client và server. `analytics-browser.json` ghi 5 milestone EN duy nhất dù cuộn lùi/ghé lại, và CTA click có surface `journey`. Adapter production hiện no-op theo quyết định tích hợp, nên đây là kiểm contract/acceptance, không phải xác nhận gửi sang provider ngoài. |
| Fallback | PASS sau F01: no-JS snapshot có 4 heading chương, brand và hai link CTA; ảnh mobile sau fix đọc được. Reduced motion: 0 animation, 5 chapter và CTA không inert. Proxy ảnh lỗi/ảnh chậm vẫn cho CTA hoạt động, không overflow ở 390×844. |
| Chất lượng build | Coordinator báo 325 tests, typecheck, lint, production build PASS tại `79096851`; fix `fde87749` chỉ đổi hai class độ rộng fallback. Reviewer không chạy lại full suite. |

## Evidence và giới hạn

Evidence tại `docs/design/cinematic-journey/mvp-review/`: `http-smoke-final.json`, `analytics-browser.json`, `reduced-motion.json`, `keyboard-start.json`, `keyboard-complete.json`, `image-error-state.json`, `slow-images-state.json`, `no-js-snapshot.json`, các ảnh no-JS sau fix, `desktop-performance-final.json`, `mobile-frame-performance-final.json`, ảnh gate và trace cuộn. Reviewer đối chiếu source exact SHA, diff fix, HTTP 3011, ảnh và JSON; không chạy lại UAT browser vì coordinator đã thu cùng runtime.

LCP/CLS desktop là lab Chromium localhost không throttle và cache hỗn hợp, không đại diện người dùng thật. INP, Safari và thiết bị thật chưa xác minh do capability hiện tại. F02 là evidence gap duy nhất còn mở; không ghi thành lỗi code.
