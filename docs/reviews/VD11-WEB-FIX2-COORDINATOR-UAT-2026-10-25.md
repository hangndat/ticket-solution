# VD11 — coordinator UAT batch cuối 2/2

Source logic `1cd4650fe1236c37d55b58c7fa2f513d8bd7dfcf`; host width `5c66678c961edab15cb7ef19c53d71b2527f7232`; source cuối `41da7c621af3065c631294fc43d6b6a46653728d` chỉ đổi main fallback sang `max-w-[64rem]`. Report Higo `0c005befb89a5ac5c965fee1bebeeeff9ae5a112`. Chưa có verdict James trên source cuối, chưa deploy.

## Luồng OIDC thật qua Orca

`python3 /tmp/vd11-cross-tab-proof.py --expect-clear --history --guest` exit0 trên `1cd4650f` rồi `5c66678c`. Lần sau có receipt [orca-cross-tab.json](assets/VD11-WEB-FIX2-2026-10-25/orca-cross-tab.json), metadata source được lấy bằng `git rev-parse HEAD`. Script chỉ dùng Orca CLI cho browser, form Keycloak thật và API local thật; không mock BFF. Credentials được helper đọc/điền kín, không có trong receipt.

| Bước | Kết quả quan sát |
| --- | --- |
| A đăng nhập | `/wallet` có6vé, avatar đúng A, header73px tại1440 |
| Warm account↔wallet | Điều hướng client cùng subject giữ nguyên DOM header |
| B đăng nhập ở tab khác | Fresh B `/me`200 đúngB, ví trống0card, streaming hidden boundaries0 |
| Focus tab A cũ | `/me`200 đúngB, avatarB, document được thay để loại cache cũ, ví trống0card; header73px, scrollWidth1440 |
| Back/forward | Back `/account`, forward `/wallet`: identityB, không emailA trong main,0ticket links |
| Logout B thành guest | Tab account cũ `/me`401, không còn emailB, avatar hoặc ticket links |
| Cleanup | Script đóng mọi tab nó tạo (`remainingOwnPages=[]`) |

Ảnh `/tmp/vd11-cross-proof-history-back-b.png`, `...history-forward-b.png`, `...account-after-guest-logout.png` thuộc source5c66678c. Ảnh `...old-tab-after-b-1440.png` bắt frame pending trước snapshot JSON đã settle; nó chứng minh private content đang bị chặn, không phải ảnh ví B trống. Hộp pending còn hẹp ở source đó và được sửa tại41da7c62. Không lấy ảnh pending cũ làm proof geometry của source cuối.

## Geometry cuối và lỗi mạng thật

Sau restart server3340 từ `41da7c62`, coordinator mở tab riêng, đặt offline qua Orca để `/me` thật thất bại, đi vào error state cùng main wrapper với pending. Không sửa DOM/CSS hoặc gọi React reveal để ép kết quả.

| Viewport | Main / max-width | Hộp error | Document scrollWidth |
| --- | --- | --- | --- |
| 1440×900 | 1024px /1024px | 672px | 1440 |
| 390×900 | 390px /1024px | 350px | 390 |

Hai ảnh `/tmp/vd11-private-error-fixed-1440.png` và `/tmp/vd11-private-error-fixed-390.png` đã mở kiểm tra: title/detail/nút thử lại đọc được, không cắt hoặc tràn ngang. Đã khôi phục online rồi đóng tab. Pending dùng cùng wrapper; không claim ảnh pending riêng trên41da. Cấu trúc trust không đổi giữa5c66 và41da; functional suite không bị gọi là đã chạy lại trên41da.

Checks theo provenance Higo: full web309 tests tại1cd; focused boundary5/typecheck/build/targeted lint/diff-check tại41da; production routes3 tại5c66. Portal source giữ nguyên source đã revalidate. Chưa probe riêng runtime ticket detail; route boundary/source/test có bao phủ nhóm private paths. Không suy ra lỗi backend/RLS hoặc phép đo INP/CLS toàn trang từ journey này. James quyết định đóng W-F04 trên exact candidate cuối; batch tự động2/2, không tự mở vòng3.
