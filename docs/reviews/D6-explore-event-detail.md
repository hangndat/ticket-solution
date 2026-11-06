# Review D6 — Khám phá / chi tiết sự kiện #1233

## Revalidation guest tích hợp — 06/11/2026

James · `dod+sec+ux`, base `8b7d715d8200df75fab7c7f68b02be0ae5e1be5b` → exact HEAD **`69c91d1194971466a876dbd2b1ea82134158530a`**; diff chỉ hai chuỗi ở `apps/mobile/src/screens/events.tsx:323,334`. CRG ticket stats/query đúng worktree/HEAD; ảnh/AX và manifest ở `apps/mobile/.uat-artifacts/d6/guest-evidence-integrated.md`. **F03 PASS, đóng theo AC4 ở 390×844 pt; DoD/UI Explore PASS trong scope đã review, Security N/A** vì diff chỉ copy, không đổi auth/tenant/credential; DoD toàn #1233 vẫn GAP theo các review khác. Fix counter giữ **1/2** theo report trước; lượt revalidation evidence này không tự tạo lượt fix mới.

- **F03 · PASS/đã xác minh:** 5 PNG khớp toàn bộ SHA-256 trong manifest, mỗi ảnh 1170×2532 px = 390×844 pt. `search-focus-fresh-device-69c91d.png` có caret và bàn phím mềm; `search-typed-keyboard-69c91d.png` có query `Nmach` nhập bằng tap phím, “Không có kết quả” còn thấy trên bàn phím. Sau gesture cuộn, `search-scroll-keyboard-69c91d.png` và `search-scroll.ax.json` cho thấy keyboard đóng, query/nội dung còn đọc được, tab Sự kiện/Đổi mã vẫn hiện và enabled. Đây là ca guest catalog rỗng; không suy trạng thái verified/Staff hoặc CTA của sự kiện có dữ liệu từ ảnh này.
- **Catalog/search copy · PASS:** fixture loopback `GET /v1/public/events` độc lập trả HTTP 200 `items:[]`; `catalog-empty.ax.json` hiện “Chưa có sự kiện” và “Làm mới”, khác error. `search-no-results.ax.json` hiện “Không có kết quả” và câu “Thử từ khóa khác hoặc xóa ô tìm kiếm.”; source trên SHA mới bỏ khẳng định sai “20 sự kiện” ở empty query và footer. Footer chỉ render khi `listData.length > 0`, nên ảnh rỗng không tự xác minh footer runtime; diff xác minh copy. Log Xcode Release SHA-256 `23197b61…` khớp manifest; `EXConstants.bundle/app.config` của binary ghi đúng SHA/API fixture. Worker báo typecheck PASS, lint exit 0 (8 warning ngoài diff), local build exit 0; reviewer không chạy lại suite/build. `git diff --check` PASS.
- **Giới hạn provenance:** ảnh/AX không nhúng build ID; liên kết với binary pin SHA dựa vào handoff build/install của worker và metadata artifact đã kiểm. Không có evidence mới cho verified/Staff, invalid redeem response hoặc deep link; xem F02 remaining states.

## Evidence lượt 2 — kết luận hiện tại

James · dod+ux, exact SHA **`9f240683460c43a29743fe116584e017faa63916`**, source không đổi; chỉ review evidence mới, miễn CRG cho lượt đọc artifact, không chạy lại suite. **DoD GAP; UI GAP; Security N/A. F01/F02/F04/F05 đóng; chỉ F03 còn mở và chặn AC4. Fix counter giữ 1/2.**

**F02 — đã xác minh, đóng:** `evidence2-detail-503.png` và `evidence2-detail-200.png` đúng hash `1ca2b38e…`/`e5884227…`, cùng 1170×2532 px (390×844 pt). AX trước có lỗi kết nối và nút “Thử lại” enabled; AX sau có UAT bright, metadata và CTA Đổi mã. Worker ghi cùng endpoint `/v1/public/tenants/uat/events/bright` trả 503 lúc 02:48:00.757Z rồi 200 lúc 02:48:22.543Z sau đổi fixture detail503→brands và Orca tap `(0.5,0.37)`; dùng lại Release binary fix1 pin SHA tại DerivedData đã ghi trong worker report. Reviewer kiểm ảnh/hash/AX và provenance bàn giao; không nhận là tự chạy journey.

**F03 — còn mở, thiếu evidence target:** cả ba PNG Duo đúng hash worker report, khổ 1398×2034 px = 466×678 pt. `evidence2-keyboard-27.1.png` xác nhận software keyboard đang hiện và search có caret; ảnh search/scroll tiếp theo không còn keyboard. Không chứng minh AC4 ở 390×844 pt. Điều kiện đóng: build pin SHA trên target 390×844, ảnh/AX lúc keyboard đang hiện sau nhập và tương tác cuộn, kiểm search/hành động có thể dùng được. Coordinator cần cấp runtime simulator đúng device class có keyboard hoặc UAT trên thiết bị test USB được ủy quyền; không lặp probe cũ khi chưa có giả thuyết mới.

**Quan sát Duo riêng:** chrome native dọc bên phải đè lên search/nội dung, thấy rõ ở `evidence2-keyboard-scroll.png` ngay cả khi keyboard đóng. Đây là bất thường layout/runtime trên Duo ngoài geometry AC, chưa đủ quy kết lỗi source hoặc regression; coordinator cần xác minh cấu hình device/orientation nếu đưa Duo vào scope hỗ trợ, không dùng ảnh này làm PASS cho 390 pt. Các kết luận dưới đây giữ lịch sử trước evidence lượt 2.

## Revalidation fix 1/2 — lịch sử 06/11/2026

James · dod+ux; reviewed `539583646a404cd71504c68e9d2b42a3bc181a36` → **`9f240683460c43a29743fe116584e017faa63916`**. CRG stats khớp worktree/HEAD, `detect_changes_tool` ưu tiên rank/heading/timer; đã kiểm toàn diff mobile của fix và fixture ignored. Không sửa source, không lặp suite: worker report ghi 563 tests/typecheck/lint/UI budget/local Release build PASS trên SHA mới.

**Verdict hiện tại: DoD GAP; UI GAP; Security N/A.** Còn F02 (phần detail) và F03 chặn acceptance. Không phát hiện regression mới trong diff fix; bằng chứng runtime do worker tạo, reviewer kiểm ảnh/hash và đường đi code, không nhận là tự chạy lại journey.

| ID | Kết quả trên SHA mới | Evidence / phần còn lại |
| --- | --- | --- |
| F01 | Đã xác minh, đóng | `fix1-empty.png`: catalog HTTP 200 rỗng, “Làm mới” secondary; fixture trả `items: []`, khác error. |
| F02 | Đã xác minh phần catalog; còn mở phần detail | `fix1-unavailable.png` + `fix1-retry-brands.png` chứng minh catalog 503/Thử lại/phục hồi; API client ánh xạ 503 → unreachable. Fixture hiện chỉ trả 503 ở `/v1/public/events`; detail ngoài mode brands trả 404, nên chưa chứng minh detail lỗi kết nối/Thử lại → phục hồi. Cần ảnh + journey detail 503 hoặc fetch failure rồi retry thành công trên build pin SHA. |
| F03 | Mở, blocker | `fix1-search-focus.png` có caret và `fix1-search-no-results.png` có query nhưng cả hai không có software keyboard; focus không thay thế AC4 khi keyboard mở. Đóng khi có ảnh/AX trên build pin SHA ở 390×844 pt với keyboard phần mềm **đang hiện**, sau nhập và cuộn, chứng minh ô search, tab và hành động không bị che. |
| F04 | Đã xác minh, đóng | `eventCtaForeground` chọn đen/trắng theo luminance, được dùng cho Text trong CTA; tests màu sáng/tối và ảnh `fix1-detail-bright.png`/`fix1-detail-dark.png` xác nhận chữ đọc được. Đây là xác minh finding UI, không ghi a11y UAT PASS. |
| F05 | Đã xác minh, đóng | `catalogNow` cập nhật khi retry/fetch; timer chờ mốc bắt đầu và cleanup khi đổi state/unmount. Rank/heading dùng `start > now`; test kiểm trước/đúng mốc và chuyển event nổi bật. |

Đã xem 7 ảnh fix1 và kiểm SHA-256 khớp toàn bộ worker report; ảnh mới giữ khổ 1170×2532 px. Fix đã dùng **1/2**; chưa có vòng fix thứ hai. Nội dung dưới đây giữ lịch sử review đầu trên SHA cũ.

UAT tiếp theo cho F03: coordinator cấp simulator riêng mà Orca thực sự hiển thị software keyboard, rồi chụp cùng journey search/focus/scroll; nếu Orca vẫn không hỗ trợ toggle, chuyển ca kiểm trên iPhone USB local cho người kiểm thử và giữ GAP tới khi có ảnh runtime. F02 cần fixture detail trả 503 rồi 200 sau retry; catalog 503 hiện có không đóng thay detail.

## Review đầu — lịch sử

**James · dod+ux · lượt đầu · fix 0/2.** Worktree `ios-approved-ui-20261105`; base `94a153c5e5580aaa6153a91e18ea55d6a1f6d018` → exact HEAD/build worker `539583646a404cd71504c68e9d2b42a3bc181a36`. Diff đúng 9 file `apps/mobile/**`; không sửa source. CRG ticket stats khớp worktree/HEAD, `get_review_context_tool` trên base chỉ ra 24 hàm UI đổi chưa có direct test; đã kiểm toàn diff và các route/CTA liên quan.

**Verdict:** DoD **GAP, chặn acceptance**; UI **GAP**; Security **N/A** (diff chỉ presentation/state published, không đổi auth/tenant/secret/contract). Code complete theo checks worker: typecheck/test/lint/UI budget, local Xcode build, `git diff --check` PASS trên SHA trên; không lặp suite. O33 waive a11y UAT, không ghi a11y PASS.

**AC:** AC1 phần catalog/search/banner/nav **PASS theo code và runtime mẫu**; AC2 **GAP**; AC3 phần published/not-found/deep link/CTA **PASS theo code và runtime mẫu**, lỗi kết nối **GAP**; AC4 CTA/scroll/safe area **PASS ở state đã chụp**, bàn phím **GAP**. O27–O30, ADR wireframe, HTML gốc Khám phá/detail và bốn CTA delta README đã đối chiếu: thẻ nổi bật không lặp hàng, O28 native tab/header, banner theo event, vé sở hữu cạnh metadata, CTA đáy và link sai chỉ về Khám phá. Nội dung seed tiếng Anh là dữ liệu nguồn, chrome tiếng Việt.

**Evidence:** `apps/mobile/.uat-artifacts/d6/worker-report.md` pin build và journey; 5 PNG worker đúng hash ghi trong report, đều 1170×2532 px = 390×844 pt ở 3×, locale worker `vi_VN`. Reviewer attach cùng simulator qua Orca, đóng toast debug, chụp `reviewer-search-focus.png` (`7365bcde…`), `reviewer-detail-cta.png` (`982afc19…`), `reviewer-detail-scrolled-cta.png` (`f7e26a0b…`), `reviewer-detail-unavailable.png` (`bd1d9bd1…`) trong cùng thư mục. AX xác nhận tap catalog → detail, CTA sau cuộn → tab Đổi mã, `vemoki://events/no-such-tenant/no-such-event` → chỉ nút Khám phá → catalog. Probe chỉ kế thừa provenance build từ worker report; PNG không tự chứa build ID. Đã `orca emulator kill` helper, giữ simulator booted.

| ID | Loại / mức / chặn | Bằng chứng và điều kiện đóng | Trạng thái |
| --- | --- | --- | --- |
| F01 | Thiếu evidence AC2 · blocker · Có | API hiện trả event; chưa có ảnh **catalog published thật rỗng** với “Làm mới” secondary. Cần fixture/local response `200 items: []` an toàn, ảnh + AX trên build pin SHA, không sửa API/DB ngoài scope. | Mở · owner coordinator/fixture |
| F02 | Thiếu evidence AC2–3 · blocker · Có | Unit test phân biệt unreachable/invalid/not-found, nhưng chưa có ảnh runtime **lỗi kết nối** và “Thử lại” đúng điều kiện. Cần lỗi mạng cô lập trên simulator/fixture local và ảnh + retry journey; không tắt mạng host dùng chung. | Mở · owner coordinator/fixture |
| F03 | Thiếu evidence AC4 · blocker · Có | Orca tap `events-search` cho AX AutoFill nhưng bàn phím phần mềm không xuất hiện; `reviewer-search-focus.png` không chứng minh tab/CTA khi keyboard mở. Cần bật software keyboard trên simulator cô lập và ảnh trạng thái focus, cuộn, hành động không bị che. | Mở · owner iOS/UAT |
| F04 | Lỗi UI theo input published · blocker · Có | `event-detail.tsx:286` dùng `eventIdentityColor` làm nền CTA; `button.tsx:197-199` luôn chữ trắng. `event-identity.ts:21-31` nhận `#fff`, `published-event-api.ts:16-23` không giới hạn độ sáng: CTA trắng trên trắng nếu client nhận brand `#fff` mà validator hiện chấp nhận. Cần chọn foreground/brand CTA có tương phản đọc được, kiểm ít nhất màu sáng/tối trên simulator. | Mở · owner iOS |
| F05 | Lỗi edge case catalog · should-fix · Không | `events.tsx:163,211,269` giữ `catalogNow` từ mount; qua giờ bắt đầu sự kiện vẫn gắn “Sắp diễn ra gần nhất”, kể cả refresh vì mốc không cập nhật. Cần cập nhật mốc khi reload/focus hoặc tính lại theo thời gian, test vượt thời điểm bắt đầu. | Mở · owner iOS |

Không tạo được F01/F02 bằng app/API hiện có mà vẫn giữ scope; F03 bị thiết lập keyboard của simulator. Các giả thuyết sản phẩm tương ứng chưa được coi là lỗi đã tái hiện. Findings F04/F05 dựa trên đường đi code; chưa có ảnh state tương ứng. Chưa đủ điều kiện DoD/acceptance; coordinator gom findings cho lượt fix 1/2.
