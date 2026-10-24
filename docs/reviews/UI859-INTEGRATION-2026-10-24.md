# #859 — Tích hợp contract receipt và iOS

User đã yêu cầu tiếp tục commit/PR/CI/integration sau checkpoint local PASS. Checkout sạch từ main `31b26d5562a2bf46a012679697480a14ca24c2d6`; workspace nguồn UI-audit được giữ nguyên.

## Phạm vi

Coordinator contract exception: backend/API/contracts receipt và mobile consumer phải giữ cùng contract đã chốt; web/portal/mockups tách PR#862/#863/#864. Không thêm feature/schema/deploy. Bản import gồm101 paths từ manifest durable113. [Bản đồ hashes](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/integration-source-map.json) ghi rõ ba mobile paths thay đổi vì CI: root restore-error tokens/Button, dev Keychain probe spacing, manual form reset sau fresh admission. Journal/session/APNs/offline queue/native Swift giữ nguyên bytes đã security review.

## CI cleanup

- Loại setState-in-effect ở manual form bằng guard theo fresh-admit operationID; queued/denied/already không clear input giả.
- UI budget giữ baseline, không nâng counters hoặc chuyển Pressable sang file khác để né. Modal confirm cũ được giữ nguyên.
- Bổ sung endpoint receipt mới vào expected OpenAPI path list của API health test; không thay route contract.
- CI mobile chạy thêm production provider/session/logout integration; DB shard offline-sync-apply chạy thêm receipt isolation test.

## Checks trước commit

- Mobile470 tests, lint/typecheck/iOS export build PASS; production integration2/2 PASS; UI budget PASS (9 spacing/0font/0hex/4Pressable/1Modal).
- Backend/API/worker lint/typecheck/build và tests PASS sau health expected-path update; API33 tests, worker16, backend52; DB receipt matrix9/9 PASS với isolated Postgres.
- OpenAPI đã regenerate; nội dung khớp reviewed-source artifact.
- Native Swift/podspec và signed binary được giữ nguyên; build/probe/M10/logout evidence trước được tái dùng theo hash. Root chạy native smoke trên JS integration từ Metro riêng8084 qua launch argument RCT_jsLocation, không đổi Metro/API cũ hoặc reset store. Kết quả mới sẽ được gắn comment PR trên exact SHA.

## Gate và lịch sử

Security/DoD trên source dirty113 trước là evidence nền, **không** thay exact-commit independent review/remote CI. Sau commit cần James dod+sec riêng, CI toàn scope gồm database-isolation xanh rồi coordinator mới merge. Lịch sử2/2 + ngoại lệ/resumes/privacy/barrier/durable20/45/30 giữ nguyên; không mở vòng privacy tự động. Integration cleanup là công việc được user ủy quyền mới.

M09 crash-inflight/physical APNs, physical-device camera và production/store không thuộc local integration; chưa pilot ready. Không EAS Cloud.
