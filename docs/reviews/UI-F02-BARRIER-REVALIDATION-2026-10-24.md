# #859 — Native revalidation sau purge barrier, 24/10/2026

Root kiểm độc lập với Ada; chỉ drive UI và đọc ledger, không sửa product source. Phiên nghiệm thu 01:18:42–01:26:48Z, trong giới hạn 25 phút. HEAD `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` dirty; freeze91 SHA-256 `0793c6e918b1f1fc0997c2917fafa5f0f40c971b477799bf3fb1bb21e6804342`. [Checkpoint cuối](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/root-final-checkpoint.json): 91/91 khớp, diffcheck PASS.

Thiết bị duy nhất: UI-FixAll-859 `B0727247-340D-423A-8547-A6C107A9756A`, Debug `com.hangndat.ticket`, iOS 26.5, 393×852 pt, tiếng Việt. Orca emulator attach/ax/tap/type; screenshot qua simctl sau attach. Không chạm simulator của user.

## M10 — PASS trên freeze91

Lượt đầu 01:19Z chưa có staff session sau logout trước đó nên app từ chối offline, không tạo queue: [AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/queued-before-restart-ax.json). Khi đổi mã, ô nhập giữ nội dung cũ nên một lượt lỗi định dạng; không ghi lượt này là M10. Root mở lại app online để bỏ state form, không xóa SecureStore/DB bằng tool. Token bind cuối trước flow lúc 01:22:17Z; [metadata](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-jwt-metadata.json), acr1, không phải PKCE/MFA proof.

Root gửi vé đã USED `ef3254e4-403d-4eb4-a848-54587b47174d` online để mở staff session qua API thật. Máy chủ từ chối vé không active, không tạo admission mới: [AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/online-warmup-settled-ax.json). Mở lại app online để reset form, không đổi credential.

| Bước | Evidence |
| --- | --- |
| Vé dự phòng `3469a929-d032-4e63-9688-8d8955c7eb22` ACTIVE, checkinCount0 trước flow; UI nhập mã, preview, proxy OFFLINE, gửi 01:23:58Z | [History queued AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-queued-history-ax.json), [ảnh](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-queued-history.png): full op `ba81cd4f-5582-4da3-b494-1baa282400a1`, “Offline — chờ đồng bộ”, chưa cho vào. |
| Terminate/launch 01:24:17Z khi proxy vẫn OFFLINE | [AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-restart-offline-ax.json): guest Events lỗi tải/Thử lại; chưa có staff admission. |
| Proxy ONLINE và bấm Thử lại 01:24:29Z; không inject/rescan giữa queue→restart→recovery | Trace API thật trả APPLIED, cùng full operation ID và receipt `39c38c92-467e-4f1c-93f3-2d12bebf8a3f`. |
| History terminal 01:24:54Z | [AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-terminal-history-ax.json), [ảnh](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-terminal-history.png): “Được vào”, cùng full op/receipt. |
| PG read-only và trace whitelist | [Ledger proof](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/m10-ledger-proof.json): vé USED, checkinCount1, cùng op/receipt; staffSession `83d7fcd4-e696-4110-98f4-7193f31d84eb`, device `9a95b622-336b-47d1-826e-2fc0af25327c`, clientSeq0. |

## Logout/relogin thông thường — PASS

Sau khi M10 đã hoàn tất, root Account→Đăng xuất 01:25:36Z. [AX signed out](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/after-logout-ax.json), iOS Continue cho end-session, rồi [guest hoàn tất](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/logout-complete-guest-ax.json). Token bind mới 01:26:36Z thuộc test riêng; History 01:26:47Z: [AX](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/history-after-logout-relogin-ax.json), [ảnh](assets/UI-F02-BARRIER-REVALIDATION-2026-10-24/history-after-logout-relogin.png) “Chưa có lượt quét trên thiết bị này.”

## Giới hạn

M10 và logout thường lệ PASS không đóng SEC-03 failed delete/restart, SEC-05 remount/cold-start owner tracking, SEC-06 APNs late POST/compensation. [Review độc lập](F02-BARRIER-SECURITY-2026-10-24.md) vẫn FAIL. Chưa có mounted-provider failure injection hoặc physical APNs proof; không gọi các probe Map/unit là native proof. Không chạy Xcode build mới vì chỉ JS/TS thay đổi; runtime dùng Debug binary hiện hữu + Metro source hiện tại, chưa có integrated commit/CI/pilot.

Proxy được trả ONLINE. Helper riêng đã kill qua Orca lúc 01:27Z, device vẫn booted; API/Metro/DB giữ nguyên. Root đã xem ảnh queued, terminal receipt và History rỗng; không sửa source/DB/store để ép PASS, không commit/push/deploy/cloud/store.
