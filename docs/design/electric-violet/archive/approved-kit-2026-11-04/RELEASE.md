# Electric Violet — bàn giao phát hành 05/11/2026

## Lưu trữ sau phát hành và đồng bộ Project

PR #1224–#1228 đã merge và được đồng bộ về **Hoàn thành** trên GitHub Project #3. Domain E2E #1031 giữ nguyên acceptance riêng; không suy QR hiển thị thành camera Gate/pilot PASS.

Artifact và evidence từ các worktree tạm đã được sao lưu, kiểm SHA-256 tại `/Users/admin/SideProject/ticket-solution/.orca-metrics/releases/electric-violet-2026-11-05`. Các đường dẫn worktree dưới đây là provenance lịch sử; dùng vị trí lưu trữ mới để tải file:

- IPA TestFlight 49: `Vemoki-TestFlight-49.ipa`.
- Archive source `1d4733aa`: `Vemoki-1d4733aa.xcarchive.zip`.
- IPA TestFlight 48, device 47, Archive và simulator cũ cũng được giữ cùng thư mục.
- `manifest.json` ghi checksum từng file; `cleanup-receipt.json` ghi kết quả dọn worktree, evidence nằm dưới `evidence/<tên-worktree>/`.

## Hotfix QR trên app — hoàn tất

Build 48 thiếu QR do API chưa rollout signed credentials. Đã migrate schema 51→54, triển khai API/worker với cấu hình ký ES256 và backfill 12 vé ACTIVE cũ. User xác nhận lại trên build 48: QR và mã nhập tay đều hiện. Worker đã khôi phục sau khi sửa guard nhận diện lineage; không bypass pin hoặc sửa manifest. Các service và pin Web/Portal khác giữ nguyên; HTTP 200 và unauthenticated 401 đều đạt.

Bản sửa cache/QR trên app, PR #1227, đã merge tại `2ad27b7d`; 551 tests, review và CI đạt. Bản sửa guard phát hành, PR #1228, đã merge tại `84a6b97a`; 30 tests, review và CI đạt. **Bản 1.0.0 (49) đã upload TestFlight thành công**, Apple đang processing, chưa xác minh tester availability. IPA/Archive dùng source `1d4733aa`, personal team `BLUA62D52G`, mã native khớp merge `2ad27b7d`. Xem [báo cáo incident](./QR-INCIDENT.md) cho exact source, artifact, backup, checks và giới hạn. Nội dung build 48/upload và F02 bên dưới là lịch sử trước hotfix.

## TestFlight — cập nhật theo yêu cầu upload

Local Xcode `app-store-connect` export/upload đã thành công (exit 0), personal team `BLUA62D52G`, bundle `com.hangndat.ticket`, version `1.0.0`, managed export build `48`. Build `47` ban đầu bị Apple từ chối do đã dùng; Xcode quản lý tăng build number, không đổi source. IPA distribution đã được kiểm codesign deep/strict, App Store profile không giới hạn UDID, APS production và API/OIDC/source SHA markers đúng.

Log upload xác nhận `Uploaded package is processing`, `Upload succeeded` và `EXPORT SUCCEEDED`. Chưa xác minh processing hoàn tất hoặc tester đã thấy build; browser ASC cần đăng nhập. Không gửi App Store Review, không thông báo tester hoặc thêm nhóm external. Cảnh báo dSYM framework không chặn upload được lưu tại worktree iOS `.orca-metrics/electric-violet/TESTFLIGHT.md` và `testflight-upload-managed.log`. Không EAS Cloud Build/upload signing material. Các đoạn chưa upload bên dưới mô tả bàn giao trước yêu cầu mới này.

## Web đã merge và deploy

- Web/shared PR [#1224](https://github.com/hangndat/ticket-solution/pull/1224), merge SHA `a767623a74437d78424595df4d1ce767f0d5501b`.
- Tooling Web-only schema PR [#1225](https://github.com/hangndat/ticket-solution/pull/1225), merge/source deployed SHA `8f0365946770c0fc2b18bedf55f4c4a966219564`.
- Cả hai có independent review exact SHA/tree-equivalent merge và CI integrated exit 0. Tooling tests 25+3 PASS; Web 347 tests và UI 18 tests, lint/typecheck/production build PASS theo evidence gắn SHA.
- Immutable artifact `/opt/vemoki/releases/8f0365946770c0fc2b18bedf55f4c4a966219564-a84cc0abcf89`: Linux amd64 / Node 24.22.0, native Prisma/sharp smoke, checksum final verify PASS. Retry đầu hết lỗi sau khi sửa ownership đúng cache pnpm; không đổi source hoặc guard.
- Web declared schema `51:51`; các app khác và migrate declared conservative `54`, không eligible ở DB production 51. Không chạy migration. DB 51 applied/0 unfinished, các pin và container ngoài Web không đổi.
- Rollout exit 0: backup pin trước rollout, chỉ `pin web --schema 51`, Compose dùng cả hai env files, `up -d --no-deps --force-recreate web`. `/app` mount đúng artifact và read-only. Last-good release được verify và giữ cho rollback; không xóa release.
- HTTP smoke VPS qua TLS/SNI `--resolve ...:443:127.0.0.1`: apex/app 200, API health 200, unauthenticated BFF 401. Primary/white lockup và mark SVG có SHA-256 khớp artifact; apex HTML dùng Electric Violet. Không gọi smoke là full production UAT.
- Smoke độc lập từ Mac qua domain public cũng đạt apex/app/API 200, BFF 401 và checksum SVG khớp (`PUBLIC-SMOKE.json`).

## Archive và IPA local cho thiết bị

Source iOS `9edad2eadf71b03d59e471ea31796dcd5ffb730d`, clean checkout riêng. Local Xcode Release Archive và `release-testing` IPA export exit 0. Personal team `BLUA62D52G`, bundle `com.hangndat.ticket`, build 47; certificate còn hiệu lực, exported IPA codesign deep/strict PASS và profile hợp lệ cho hai thiết bị đã đăng ký, APS production. Public API/OIDC và SHA marker trong bundle được xác minh. Không EAS/cloud build, không upload store, không USB install.

- IPA: `electric-violet-ios-build/.orca-metrics/electric-violet/Vemoki-device-9edad2ea.ipa`; SHA-256 `b8aa4886e598f213c620a2b39d0bc5eb65267b0e45beaa428e3cb03649626e3c`.
- Archive ZIP: `electric-violet-ios-build/.orca-metrics/electric-violet/Vemoki-9edad2ea.xcarchive.zip`; SHA-256 `27cab4e67f929126c9c97df9a4fe5eb661e7baa0c19d1808c6e2ba2e13232828`.

## Giới hạn còn lại

### Cập nhật cuối — iOS đã merge theo xác nhận owner

Sau khi được thông báo phần còn thiếu là signed-in vé/QR trên Electric Violet, user xác nhận **“thành công rồi, làm tiếp đi”**. Coordinator ghi nhận owner nghiệm thu F02, không coi đây là ảnh hoặc lượt UAT mới do agent thu, không sửa lịch sử kết luận reviewer. PR #1226 đã merge ngày 05/11/2026 tại `5bb44d2872e5c7a14d06b2a85cf16086aa236e18`; exact source `9edad2ea` đã có independent static/build PASS và CI PASS. Bằng chứng/nguồn xác nhận: https://github.com/hangndat/ticket-solution/pull/1226#issuecomment-6649561091. Archive/IPA giữ source provenance `9edad2ea`, không đổi binary hay upload store. Các đoạn draft/GAP bên dưới là lịch sử trước xác nhận owner.

Đã fetch merge SHA và đối chiếu `git diff --exit-code 9edad2ea 5bb44d28 -- apps/mobile`: không có delta native. CI integrated run `41967035342` đã hoàn tất, `gh run watch --exit-status` exit 0 (PASS). Watch đầu bị gateway timeout do output; watcher khôi phục ghi log riêng và kết thúc thành công: `.orca-metrics/electric-violet/ios-merge-ci-watch.log`.

Đính chính sau đối chiếu lịch sử 05/11: native PKCE login đã PASS simulator theo `docs/reviews/UI-FIXALL-IOS-2026-10-23.md`; wallet và QR copy/source cũng có evidence lịch sử, còn `D13-REVIEW-ACCOUNTS-2026-10-21.md` ghi staff camera check-in thật trên iPhone. Không kết luận login/QR chưa từng đạt. Electric Violet không đổi cơ chế auth/QR; phần F02 còn thiếu là signed-in owner ticket/QR và O28 tabs trên bản Electric Violet có provenance. Ảnh native lịch sử được dẫn trong report nhưng không có ở checkout hiện tại; không phủ nhận sự tồn tại của chúng. Reviewer đã ghi addendum tại `IOS-EXACT-REVIEW.md`, dispatch `ctx_4a2af76c292c`; static/build PASS, acceptance vẫn GAP, không yêu cầu chạy lại full auth matrix.

Native [PR #1226](https://github.com/hangndat/ticket-solution/pull/1226) để draft: **F02 iOS signed-in owner ticket/QR vẫn thiếu evidence**, local sign-in trở guest và stage chưa xác định. Build thành công không đóng gate này; không sửa auth hoặc mặc định user đã miễn acceptance. F03 desktop compositor là giới hạn evidence không chặn Web riêng; không claim ảnh desktop sạch. Không gọi toàn bộ Epic/pilot ready.

CI PR #1226 đã PASS tại exact SHA `9edad2ea`. Independent native revalidation hoàn tất theo task `task_ca9e4d2a01cb`, dispatch `ctx_ecbc05ff051f` (James): static source và build/sign PASS; acceptance/merge FAIL/GAP do F02 còn mở. Theme tests 6/6 đạt; full mobile local 532/534, hai lỗi thiếu build artifact `@ticket/contracts/dist/index.js` ngoài diff được ghi riêng, không claim full suite PASS. Báo cáo tại worktree iOS `.orca-metrics/electric-violet/IOS-EXACT-REVIEW.md`. Không chạy thêm login loop hoặc sửa auth.

Evidence private: `main-3/.orca-metrics/electric-violet/{remote-build-8f036594-retry1.log,PUBLIC-SMOKE.json}`, review/check logs trong hai worktree release; server `/opt/vemoki/release-build/ev-8f-web-rollout/{RESULT.json,pins-before.env,rollout.log}`. Không chứa token, signing material hoặc credential trong báo cáo này.
