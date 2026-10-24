# #859 — Root native revalidation trên durable113

Root kiểm độc lập 24/10/2026 **02:21:29–02:25:37Z**, sau implementation handoff `ctx_f743389d2583` được collect/release. HEAD `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` dirty; manifest113 `.orca-metrics/fix-all/private/durable-final-freeze.json` SHA256 `0820c92399747e9b1c1c3ef032fceae9264ccb93daaca8f1935cdbf722b9b8c7`. Baseline91 SHA256 `0793c6e918b1f1fc0997c2917fafa5f0f40c971b477799bf3fb1bb21e6804342` là bản trước, không gọi tests cũ là đã chạy trên bản mới.

**Verdict riêng của root:** native module allowlist **PASS**, M10 queue → offline restart → APPLIED **PASS**, logout thường lệ → relogin → History rỗng **PASS**. Reviewer độc lập `ctx_f52aab538392` sau đó xác minh [security/DoD PASS, SEC-03/05/06 đóng](F02-DURABLE-SECURITY-2026-10-24.md); các success paths native này không thay failure-injection review và không cấp pilot ready.

## Binary và phạm vi thiết bị

- Chỉ simulator `B0727247-340D-423A-8547-A6C107A9756A`, bundle `com.hangndat.ticket`, VI, 393×852 pt. Không dùng simulator người dùng, không reset DB/store, không EAS/cloud/store.
- Signed local build `.orca-metrics/fix-all/durable-native-build/SignedDerivedData/Build/Products/Debug-iphonesimulator/Vemoki.app`; installed Mach-O SHA256 `02a529f3fb1256b7e3e5f1e73f5cd5fd2dd2bd6f6125abf0e30e930fa46a7084` khớp sản phẩm build. **Vemoki.debug.dylib** installed/built cùng SHA256 `6d8cf52dac80ba7ac00b49cd886c5dd1d7c9b41f5386798eb2f0b242b70322b9`; không chỉ so bootstrap executable. Native Swift SHA256 `a02c57220628be5b7f7575bc7421c9fb689adf7561b498bee0a856c1e6782403`, signed build log SHA256 `6eae823ea18151b33f9c5005bf76d7427bbfb6f954d1d4004f381dc3aac18c39`.
- [Binary proof](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/native-binary-proof.json); [113 hashes vẫn khớp](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/freeze-check.json) lúc02:25:21Z. JS chạy từ Metro root-owned; native module lấy từ signed binary nêu trên.
- Root mở dev-only `vemoki://uat/durable-keychain`: synthetic workspace/queue được native index tìm, decoy cùng prefix ở identity service bị loại, exact deletion rồi native absence đạt. [Ảnh root probe](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/keychain-probe-root.png), [AX](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/keychain-probe-root-ax.json). Chỉ chứng minh native I/O/allowlist; không giả làm production auth/đổi user proof.

## M10 — cùng operation xuyên offline restart

| Bước | Bằng chứng và kết quả |
| --- | --- |
| Chuẩn bị | Fresh local fixture JWT trước flow (acr1, audience ticket-api, TTL300s); `/v1/me` xác minh qua production boundary. Online warmup với vé **đã USED** `ef3254e4-403d-4eb4-a848-54587b47174d` chỉ để mở staff session, API từ chối `Ticket is not active`, không admission mới. Restart online làm rỗng form nhập, không xóa store. |
| Queue offline | Dùng vé tổng hợp mới `14de0a49-4af9-4f8c-8aec-fc98e7057cc3`, mode proxy offline; History ghi op **`b932b811-b6c5-48b6-9a3d-bb4992a399c7`**, “Offline — chờ đồng bộ”, “chưa cho vào”. [Ảnh](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/m10-queued-history.png), [AX đầy đủ UUID](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/m10-queued-history-ax.json). |
| Cold start offline | Terminate/launch khi proxy vẫn offline; UI guest fail closed/Thử lại, không admission. [Ảnh](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/m10-restart-offline.png). [PG lúc offline](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/ledger-offline.json): ACTIVE, checkinCount0. |
| Khôi phục online | Chỉ đổi proxy online + tap Thử lại. **Không** reinject credential, rescan, rebind hay reset trong queue→restart→recovery. Production restore xác minh cùng A, hydrate queue và sync. |
| Terminal | HTTP201 trả APPLIED lúc02:24:32Z cho **cùng op**; receipt **`cae78aec-86e2-458c-a4ea-caa6ffbb8f80`**. History “Được vào”, full op/receipt trong AX. [Ảnh](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/m10-terminal-history.png), [AX](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/m10-terminal-history-ax.json). |

[Trace chỉ trường allowlist](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/offline-trace-proof.json): session `10e2af24-13fd-4161-ba6a-fa91d4d955a5`, device `9a95b622-336b-47d1-826e-2fc0af25327c`, clientSeq0. [Postgres ledger](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/ledger-applied.json) khớp operation/receipt/session/device, **đúng1 check-in**, ticket USED, confirmed `2026-10-24T02:24:32.455738+00:00`. Không undo/reset để làm lại PASS; backup fixture chưa dùng. Đây là Gate-only append fixtures, không M07 issuance/quota acceptance.

## Logout/relogin sau khi M10 hoàn tất

Account → Đăng xuất → chấp thuận iOS end-session dialog → chờ guest Events với attendee account navigation. [Guest đã ổn định](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/logout-settled-guest.png), [AX](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/logout-settled-guest-ax.json). Capture `logout-completed-guest` sớm còn Safari transition, **không dùng** làm completion evidence.

Sau đó mới refresh/bind fixture JWT cho flow riêng, vào History: **“Chưa có lượt quét trên thiết bị này.”** [Ảnh](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/history-after-logout-relogin.png), [AX](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/history-after-logout-relogin-ax.json). [Ledger sau logout](assets/UI-F02-DURABLE-REVALIDATION-2026-10-24/ledger-after-logout.json) vẫn đúng1 check-in; purge chỉ dữ liệu client.

## Giới hạn và cleanup

- Fixture local acr1 không là bằng chứng PKCE/MFA/production deployment. Native cold-start/failure-injection/account-switch race có verdict source/harness riêng từ reviewer; không dùng ordinary logout PASS để miễn SEC-03/05/06.
- Không kiểm physical APNs delivery, lost-response crash-inflight M09, hoặc server activation sau late cross-user POST; các giới hạn đã chốt trong handoff được giữ nguyên. Không hứa physical erasure nếu mọi durable operation lỗi trước intent confirmed.
- Proxy đã trả online; API/Metro/DB và IPv4→IPv6 bridge giữ nguyên root-owned. Root đã yêu cầu dừng helper của simulator được giao, giữ simulator/app dữ liệu hiện tại; không tác động simulator người dùng. Không commit/push/merge/deploy. Lịch sử 2/2 + ngoại lệ/resumes/privacy/barrier + gói20/45/30 giữ nguyên.
