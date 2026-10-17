# D7-S4 — DoD tái thẩm định sau fix wave

Ngày: 2026-10-17. **Kết luận: FAIL** — #116 chưa đủ bằng chứng persistence/retry; #115 chưa đạt điều kiện phụ thuộc.

Reviewer độc lập: Codex, session `orca_session_id:9f6ce12c-4c88-4273-9955-3a14da337dae`, dispatch `ctx_8f56cdb5a7d3`, task `task_997bc691e46e`; khác implementer `ctx_d145fe9b9a9d`. Không sửa implementation, điều khiển Simulator/database của worker khác, merge, deploy hay đăng GitHub.

## Phạm vi và SHA

- Evidence tip PR #190: `94eade19cd8d436cdab117eb654cf5407158eb1a` (HEAD lúc review, working tree sạch).
- Behavior/code: `c8606fe59a8e5771aac79c420736960781d3ee3a`.
- API runtime do UAT khai báo: `f7c88ffd6f936b6da56aa8cea8451f3ae889c278`.
- Mốc FAIL cũ: `3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61`, reviewer dispatch `ctx_761db3a28cd2` theo đề bài.
- `git diff --stat c8606fe… 94eade1…`: chỉ hai thay đổi tham chiếu SHA trong tài liệu; `git diff --exit-code` cho `apps/mobile`, `pnpm-lock.yaml`, `scripts/sim-uat.sh` trả 0.

Đã đối chiếu PRD, technical design, decision log, ROADMAP và tiêu chí dispatch; không suy trạng thái live của Project từ docs. Không truy cập hay thay đổi board trong dispatch này.

## Kết quả theo Issue

| Issue | Kết quả | Cơ sở |
| --- | --- | --- |
| #116 | **FAIL** | Verified session + enqueue đã có; thiếu chứng cứ quan sát pending trên đĩa trước restart và DB trước/sau retry. |
| #117 | **PASS** (Simulator build) | Có log local mới, Team đúng, build từ đường dẫn D7; tài liệu gắn behavior SHA đúng. Không phải archive/device-signed release. |
| #118 | **PASS with known gap** | Dispatch chưa ủy quyền production; deploy skipped hợp lệ, không chứng minh prod deploy/health. |
| #115 | **FAIL** | Chỉ PASS khi #116 và #117 cùng PASS. |

## Phát hiện chặn #116

**F1 — Bằng chứng chưa phân biệt queue được lưu qua restart với queue đã replay trước khi terminate.**

[D7-S4-UAT.md](./D7-S4-UAT.md) có lệnh và chú thích `localStatus=pending`, `checkins=0`, nhưng không lưu output truy vấn/file tại mốc đó. Ảnh enqueue thực sự hiển thị `OFFLINE_ENQUEUED pending=1`; ảnh Staff thực sự hiển thị `Phiên: verified`, nên lỗi signed-out cũ đã được cải thiện. Tuy nhiên helper `apps/mobile/src/app/uat/scan.tsx` ép đường enqueue bằng `preferOffline=1`, sau đó gọi `probeConnectivity(apiBase)`; đây chưa chứng minh gián đoạn mạng kéo dài tới khi kill/restart. Cần output pending trên đĩa sau terminate và trước replay để xác nhận tiêu chí persistence.

**F2 — Chưa có output kiểm chứng retry không tạo check-in trùng.**

File [queue-final.json](./d7-uat/ios/d7-s4-queue-final.json) chỉ có một hàng `applied` với `clientEventId=e81186df-bd87-4b75-9781-6f21b59124f5`, ticket `ace74a71-7646-431a-a73e-7281848002a1`, checkin `dfec08db-a952-4850-9aa5-cb51187c1e6f`. Nó hỗ trợ replay cuối cùng nhưng không chứng minh số check-in 0 → 1 → 1 hoặc kết quả retry. Không có output SQL/API cho các mốc đó trong artifacts được giao.

Bốn ảnh `d7-s4-staff-verified.png`, `d7-s4-offline-after-restart.png`, `d7-s4-offline-after-replay.png`, `d7-s4-offline-retry-nodup.png` có cùng SHA256:

```text
355c385a2a3a0bac8fa092bdc3641e0ef1f895d1b78ca62d860062b55b202209
```

Ảnh giống nhau không tự chứng minh UAT sai, nhưng không phân biệt được các chuyển trạng thái cần nghiệm thu. Reviewer đọc thêm AX dumps có sẵn tại `d7-milestone/apps/mobile/.uat-artifacts/d7-s4-describe-{pending-staff,after-restart,after-replay}.txt`: cả ba đều có `[applied] ace74a71…`, không có mốc pending cần xác nhận. Đây là kiểm tra file có sẵn, không chạy lại trên Simulator của implementer.

Nguồn `offline-queue-store.ts` đã dùng `expo-file-system/legacy`, nhưng `writeString` nuốt lỗi ghi và giữ memory mirror. Vì vậy UI enqueue thành công không đủ để suy ra ghi đĩa thành công. Phát hiện này giải thích yêu cầu bằng chứng; review không kết luận đã xảy ra mất dữ liệu.

Để đóng F1/F2: bổ sung transcript có timestamp và exact SHA/tree, verified STAFF, chặn replay tới sau restart, nội dung queue pending đọc từ Documents sau terminate, cùng ticket/clientEventId qua restart, output replay, và truy vấn check-in trước/sau replay/retry chứng minh 0 → 1 → 1. Redact credential; không cần đổi code chỉ để tạo log.

## Kiểm chứng #117 và giới hạn

Đã đọc [IOS-BUILD](./D7-S4-IOS-BUILD.md), [excerpt thực tế](./d7-s4/xcodebuild-d7-excerpt.md) và host log `/tmp/d7-s4-xcodebuild-d7.log` (7,438,905 bytes tại review). Đầu log có `xcodebuild`, destination iOS Simulator `F191CF59-4B73-44E5-BFA8-4CE439EB31AD`, `DEVELOPMENT_TEAM = BLUA62D52G`; cuối log dòng 40857 có `** BUILD SUCCEEDED **`. Build path là `/Users/admin/orca/workspaces/ticket-solution/d7-milestone/apps/mobile/ios`, product ở `/tmp/d7-s4-DerivedData-d7sha`, có ExpoFileSystem target/framework. Kết hợp tài liệu gắn `c8606fe…` và code tree không đổi tại evidence tip, chấp nhận bằng chứng build D7 thay cho D6 `3149062…` cũ. Không chạy lại build; log không chứa git attestation riêng cho generated native tree.

Lỗi tài liệu nhỏ: IOS-BUILD trỏ `d7-s4/xcodebuild-d7-excerpt.log` nhưng file committed là `.md`; coordinator nên sửa link khi bổ sung evidence. Không phát hiện bằng chứng EAS Cloud trong chuỗi local được cung cấp. Simulator codesign ad hoc/Team setting không được diễn giải thành signed archive, TestFlight hay store submission.

## Các kiểm tra thực hiện

- `git rev-parse HEAD`, `git status --short`, `git log -5 --oneline`, `git show --stat c8606fe`, diff hai SHA.
- Đọc ba tài liệu UAT/build/deploy-skip, excerpt committed, queue JSON, host xcodebuild log.
- Mở trực tiếp năm ảnh UAT mới; `shasum -a 256 docs/reviews/d7-uat/ios/d7-s4-*.png`.
- Parse AX dumps sẵn có để lấy AXLabel; đọc đúng nguồn ba file helper/store liên quan.
- Không chạy lại unit suite; `182/182` là kết quả implementer ghi trong UAT, không phải kết quả độc lập của reviewer. Unit tests không thay thế bằng chứng runtime nêu trên.
- Graph MCP repo không được expose trong session (đã dò danh sách tools); dùng đường dẫn có sẵn từ evidence và lean-ctx để xác minh nguồn. Không thực hiện review toàn bộ sản phẩm hoặc bảo đảm security/concurrency từ build.

## Nội dung comment chuẩn bị cho coordinator (chưa đăng)

> DoD D7-S4 tái thẩm định tại evidence `94eade19cd8d436cdab117eb654cf5407158eb1a`, code `c8606fe59a8e5771aac79c420736960781d3ee3a`: **FAIL**. #117 PASS với local Simulator xcodebuild Team BLUA62D52G; #118 PASS with known gap vì chưa ủy quyền deploy. #116 đã có verified session/enqueue nhưng thiếu transcript pending trên đĩa qua terminate/restart và DB 0 → 1 → 1 cho replay/retry; bốn ảnh verified/restart/replay/retry giống hệt nhau, queue-final chỉ chứng minh trạng thái applied. #115 chưa PASS. Chi tiết: `docs/reviews/D7-S4-DOD-REVAL.md`; không tuyên bố acceptance complete, pilot ready hay store submission.
