# D7-S4 — Review DoD độc lập (#115–#118)

Ngày: 2026-10-17. **Kết luận tổng: FAIL — chưa đủ điều kiện đóng #115 / Epic #103.**

Reviewer: Codex, Orca session `6285de4f-5f30-44b5-bcdc-f0e8a18f75c7`, dispatch `ctx_761db3a28cd2`, khác implementer `ctx_ee2afff81db6`. Phạm vi chỉ kiểm tra bằng chứng; không sửa ứng dụng, không điều khiển Simulator, không deploy hay merge. Dispatch chỉ cho báo qua Orca, vì vậy nội dung bình luận Issues được chuẩn bị bên dưới để coordinator đăng; reviewer không đăng GitHub hoặc đổi Project.

## SHA và nguồn bằng chứng

- Commit chứa toàn bộ evidence S4: **`3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61`**, nhánh `hangndat/d7-milestone` (13 files, chỉ docs và PNG).
- Integration được artifact dẫn: **`d6f53624ca8d5cd5410bf75ac614748eba1d7971`**.
- Merge web #182: `e511058b6c149ef89a5b3b5b9b23f9d16502f9d4`.
- Merge iOS #178: `0c8bcdf7846703628f6abbf98c4c06c896fb3aac`.
- Merge BE #183: `0ff9460b7324512841a4aa115b838189455e4bd9`.
- Cây thực sự dùng build local: **`31490627df2bafbd6ba654b808afd4484f1900fa`**, worktree `d6-ios`.
- Checkout reviewer: `f0e2ff48f06234bc43053cc0bbd2caf7a4f9668a`; các kết luận dưới đây áp dụng cho evidence commit nêu trên, không tự mở rộng sang tip mới.

Đã đọc trực tiếp tại evidence commit: [UAT](https://github.com/hangndat/ticket-solution/blob/3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61/docs/reviews/D7-S4-UAT.md), [build iOS](https://github.com/hangndat/ticket-solution/blob/3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61/docs/reviews/D7-S4-IOS-BUILD.md), [deploy](https://github.com/hangndat/ticket-solution/blob/3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61/docs/reviews/D7-S4-DEPLOY-PROD.md), excerpt build và ảnh UAT. Project #3 đọc trực tiếp qua `gh project item-list`: #103 Đang làm; #115–#118 Chờ duyệt tại lúc review; không suy trạng thái từ roadmap cũ.

## Kết quả theo gate

| Issue | Verdict | Căn cứ |
| --- | --- | --- |
| #116 | **FAIL** | Web có evidence headless; iOS mới launch/tap Staff khi signed-out, chưa chạy offline enqueue/replay/conflict thực tế. |
| #117 | **FAIL cho gate D7** | Build local thành công nhưng ở cây D6; chưa chứng minh build của D7 SHA. |
| #118 | **PASS with known gap** | Chưa có ủy quyền deploy rõ ràng; artifact ghi bỏ qua và không nhận đã deploy. Không phải bằng chứng production đã chạy D7. |
| #115 | **FAIL** | #116 và #117 chưa đáp ứng gate; chưa được coi acceptance complete. |

### F1 — Thiếu UAT iOS offline thực tế (#116, chặn nghiệm thu)

`D7-S4-UAT.md` tự ghi “Live offline banner with pending queue on device: GAP” và chưa drive enqueue/replay do thiếu staff session. Ảnh `d7-s4-staff-screen.png` xác nhận `Phiên: signed-out`; các ảnh S2 banner là ảnh khối nội dung riêng, không thể hiện thiết bị thực hiện queue/replay hay kết quả API. Các số 148/148 unit và 10/10 web là kết quả implementer báo trong artifact, reviewer không chạy lại; unit không thay thế UAT tích hợp.

Cần bổ sung headless UAT bằng staff session hợp lệ trên đúng SHA: enqueue offline và giữ trạng thái chưa cho vào, khởi động lại giữ queue, online replay với kết quả server, retry không tạo check-in trùng và conflict giữa thiết bị. Ghi lệnh, SHA client/server, kết quả và ảnh/log đã loại dữ liệu nhạy cảm. Không dùng mock authentication trên production hoặc mượn simulator/database worker khác.

### F2 — Build thành công chưa gắn với D7 (#117, chặn gate build D7)

Reviewer đọc được `/tmp/d7-s4-xcodebuild.log` trên host: có `DEVELOPMENT_TEAM = BLUA62D52G`, `Signing Identity: "Sign to Run Locally"`, `SKIP_BUNDLING enabled; skipping.` và `** BUILD SUCCEEDED **`. Vì vậy bằng chứng build local và Team là có thật; không có căn cứ trong evidence cho việc đã dùng EAS Cloud.

Tuy nhiên command chạy trong `d6-ios/apps/mobile/ios`, SHA `31490627df2bafbd6ba654b808afd4484f1900fa`. `git diff --stat` với integration D7 liệt kê 47 mobile files thay đổi, gồm offline queue, staff UI, config và package manifest. Artifact thừa nhận không đóng gói D7 JS vào `.app`; chưa có evidence local prebuild/build tái tạo từ D7 SHA hoặc chứng minh dependency/native config tương đương. Build D6 không đủ đóng milestone có thay đổi mobile D7.

Cần chạy local Expo prebuild + Xcode/xcodebuild hoặc fastlane từ exact D7 SHA đã chọn, lưu command, dependency/config provenance, exit status và log bền vững. Nếu dùng Debug/Metro, phải gắn rõ native tree và JS tree vào cùng D7 SHA; không bắt buộc archive/store submission cho task này. Không dùng EAS Cloud hoặc cloud fallback.

### #118 — Gap có chủ đích, không chặn riêng gate deploy

Đã đọc trực tiếp body #118, #115 và #103: không có ủy quyền deploy rõ ràng. Acceptance của dispatch cho phép PASS with known gap trường hợp này; artifact ghi “NOT authorized — deploy skipped”, không tái dùng deploy D6 làm bằng chứng D7. Không cần triển khai để sửa review này. Nếu được ủy quyền sau, cần SHA deploy + health checks và review lại.

## Kiểm tra reviewer thực hiện

- `git show --stat 3f352a5` và `git show 3f352a5:<artifact>`: kiểm tra nội dung, SHA và đường dẫn ảnh.
- `git show --no-patch --format=fuller <merge-sha>`; `git merge-base --is-ancestor` cho merge web/BE vào integration: hợp lệ.
- `git diff --exit-code d6f53624ca8d5cd5410bf75ac614748eba1d7971 5358d1185a5075459b336c056d9e5aeb673d17a0 -- apps/web/app/gate`: exit 0, xác nhận riêng subtree Gate ở worktree web bằng integration; không chứng minh toàn dependency tree.
- `git diff --stat 31490627df2bafbd6ba654b808afd4484f1900fa d6f53624ca8d5cd5410bf75ac614748eba1d7971 -- apps/mobile`: xác định build không cùng cây D7.
- Đọc log host và xem trực tiếp ảnh Staff / S2 offline banner. Không chạy lại runtime UAT/build, không dùng simulator hay database của worker khác.
- `gh issue view 115/116/117/118 --json title,body,state`, `gh issue view 116/117/118 --comments`, `gh issue view 103 --json body`, `gh project item-list 3 --owner hangndat --limit 200 --format json`: kiểm tra tiêu chí, evidence đã đăng và trạng thái hiện hành.
- CRG namespace yêu cầu trong repo không có trong tool catalog phiên này; review chỉ evidence/docs, không thay đổi hoặc kết luận về implementation từ graph. Không xác nhận lại CI hay security/concurrency bằng lần review này.

## Nội dung để coordinator bình luận Issues

- **#115:** DoD độc lập **FAIL** trên evidence `3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61`, integration `d6f53624ca8d5cd5410bf75ac614748eba1d7971`: còn thiếu #116 UAT iOS offline thực tế và #117 local build gắn D7 SHA; #118 PASS with known gap do chưa authorize deploy. Xem `docs/reviews/D7-S4-DOD.md`; chưa đóng Story/Epic hoặc tuyên bố pilot ready.
- **#116:** **FAIL**: Staff screenshot signed-out, chưa drive offline enqueue/replay/conflict; 148 unit tests và banner PNG chưa đủ UAT tích hợp. Bổ sung headless evidence trên exact SHA rồi review lại; giữ Chờ duyệt hoặc chuyển Đang làm khi giao sửa.
- **#117:** **FAIL cho gate D7**: xác nhận local BUILD SUCCEEDED, Team BLUA62D52G, nhưng build SHA D6 `31490627df2bafbd6ba654b808afd4484f1900fa` và SKIP_BUNDLING. Cần local prebuild/build có provenance D7 SHA; không EAS Cloud.
- **#118:** **PASS with known gap** trên evidence commit nêu trên: không có ủy quyền deploy, ghi skip là đúng phạm vi; không có claim D7 production health/deploy. Coordinator xử lý trạng thái sau khi artifact review được tích hợp theo workflow.

Không tự merge hoặc đóng Issue. Code complete, acceptance complete và pilot ready vẫn là các trạng thái riêng.
