# #859 — Revalidation privacy SEC-03/04 (batch user duyệt)

> Coordinator cập nhật: [root đã hoàn tất M10 và logout/relogin thường lệ trên cùng freeze83](UI-F02-PRIVACY-ROOT-COMPLETION-2026-10-24.md) sau khi sửa thao tác harness; phần native chưa chạy bên dưới là checkpoint của James, không phải kết quả cuối. [Security post-fix](F02-PRIVACY-SECURITY-2026-10-24.md) vẫn FAIL SEC-03/05; không coi source hash/unit PASS là code complete.


| Field | Value |
| --- | --- |
| Reviewer | Independent native lane · `reviewer-dod` / `reviewer-merged` · dispatch `task_7f52d3351cba` · `ctx_c73053c95795` |
| Implementer | Ada · `ctx_bcfe0b965d4a` — **≠** reviewer |
| `git rev-parse HEAD` | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (**dirty**, không integrated SHA) |
| Privacy source freeze | `.orca-metrics/fix-all/private/privacy-final-freeze.json` · SHA-256 manifest `c48f86a10b28822dcac6a5104c21661f8a46fc329dd0fc86d7c27b11f22f467a` · **83/83** path khớp hash trên worktree (kiểm độc lập lúc review) |
| Baseline trước fix | `.orca-metrics/fix-all/private/full-revalidation-freeze.json` · 77 file · `e0c7482763b00fd095be08308c320542a81811a02993144ff5673f98e199ec43` |
| Handoff fix | [REPORT-F02-PRIVACY-FIX.md](../../.orca-metrics/fix-all/REPORT-F02-PRIVACY-FIX.md) · [DECISION-F02-PRIVACY-APPROVED.md](../../.orca-metrics/fix-all/DECISION-F02-PRIVACY-APPROVED.md) |
| Security static (Turing) | [F02-FULL-SECURITY-REVALIDATION-2026-10-24.md](F02-FULL-SECURITY-REVALIDATION-2026-10-24.md) — reviewer **không** lặp static verdict; chỉ native evidence |
| Simulator | `UI-FixAll-859` / `B0727247-340D-423A-8547-A6C107A9756A` · `com.hangndat.ticket` |
| Runtime | API `:3001` · Metro `:8083` · proxy `:3009` · trace `.orca-metrics/fix-all/private/mobile-offline-trace.jsonl` (không restart stack/DB/storage) |
| Vé reviewer | `ef3254e4-403d-4eb4-a848-54587b47174d` · backup `3469a929-d032-4e63-9688-8d8955c7eb22` · [f02-privacy-fixtures.json](../../.orca-metrics/fix-all/private/f02-privacy-fixtures.json) |

**Không** sửa source · không commit/push/PR/Project · không rerun matrix author (452/438) — cite handoff fix.

## JWT metadata (không bearer)

| Flow | File | Ghi chú |
| --- | --- | --- |
| M10 (trước bind) | [m10-jwt-metadata.json](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/m10-jwt-metadata.json) | `refresh-native-staff.mjs` → `open-staff-session.mjs` · whitelist `iat`/`exp`/`sub`/`aud`/`acr` |

## Native UAT — M10 (vé `ef3254e4…`, ~19:39–19:48Z)

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Proxy `online` → staff bind | **PASS** | Gate «Sẵn sàng», tab Nhập tay |
| UUID 36 ký tự (char-by-char Orca) | **PASS** | [ax-uuid-36chars-proof.json](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/ax-uuid-36chars-proof.json) · value `ef3254e4-403d-4eb4-a848-54587b47174d` |
| Preview modal «Mã đọc được, chưa xác minh» | **PASS** | [m10-modal-open.png](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/m10-modal-open.png) · [m10-preview-modal.png](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/m10-preview-modal.png) |
| Proxy `offline` → «Gửi kiểm tra cổng» → queue + banner «Có lượt chờ…» / panel «Offline — chờ đồng bộ» | **FAIL** | Nhiều lần tap xác nhận (y≈0.58–0.62); **không** thấy banner/panel như [flowA-queued-offline.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-queued-offline.png). [m10-queued-offline.png](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/m10-queued-offline.png) vẫn «Sẵn sàng» / form trống kết quả. `mobile-offline-trace.jsonl` **không** thêm dòng sau 19:12Z (vẫn 13 dòng). |
| History **trước** restart · full `clientEventId` | **FAIL** | [m10-history-probe.png](assets/UI-F02-PRIVACY-REVALIDATION-2026-10-24/m10-history-probe.png) — không có row mới cho vé `ef3254e4…` lúc ~03:47 local; chỉ lịch sử flow James trước (4867e9d6…, f8d63674…, …). |
| `simctl terminate` + `launch` offline → Home → icon 0.6166,0.2606 | **Không chạy** | Phụ thuộc queue op — **bỏ qua** sau FAIL trên |
| Proxy `online` → foreground sync → cùng op → receipt / pending 0 | **Không chạy** | — |
| Logout UI → rebind staff → History rỗng (SEC-03/04) | **Không chạy** | Task yêu cầu sau M10; không giả PASS |

**Checkpoint:** harness Orca (tọa độ nút sticky header ~y 0.26 vs ~0.33, sheet «Gửi» ~0.59) — preview đạt, **không** chứng minh durable offline queue / full operation ID cho lượt privacy reviewer trên runtime freeze 83 file.

## Findings (privacy batch)

| ID | Trạng thái sau revalidation | Ghi chú |
| --- | --- | --- |
| **F02-SEC-03** | **Đóng (static/unit)** · **Mở (native)** | Handoff Ada: guard + deferred `runScan`/`reconcileOp` tests PASS trên adapter production ([REPORT-F02-PRIVACY-FIX.md](../../.orca-metrics/fix-all/REPORT-F02-PRIVACY-FIX.md)). Reviewer **chưa** chứng minh logout/restart không hồi sinh admission trên sim. |
| **F02-SEC-04** | **Đóng (static/unit)** · **Mở (native)** | Handoff: legacy `ticket.gate.ops.v1` fail-closed + tests seed legacy PASS. Reviewer **chưa** chạy logout UI → History rỗng. |
| **F02-M10 (privacy slice)** | **FAIL** | Không có op mới + không restart/sync trong phiên này. |
| **F02-HISTORY-ID** | **Giữ (prior PASS)** | AX prior flows vẫn full UUID; lượt mới không tạo row để đối chiếu. |

## Verdict phân tầng

| Gate | Verdict |
| --- | --- |
| **Code complete** (freeze 83 file khớp, không edit reviewer) | **PASS** — manifest `c48f86a…` · 83/83 hash trên disk |
| **Security (static)** | **Không verdict** — giữ lane Turing; unit closure SEC-03/04 cite handoff Ada |
| **UI / native acceptance (#859 privacy AC)** | **FAIL** — M10 offline queue + History op + restart/sync + logout purge **chưa** đạt trong phiên reviewer |
| **DoD acceptance (local simulator)** | **FAIL** |
| **Pilot ready** | **FAIL** — thiết bị thật / camera / push ngoài scope |

**Kết luận:** Batch privacy **code/local unit** có bằng chứng freeze + handoff fix; **acceptance native độc lập cho SEC-03/04 chưa đạt** — không dùng PASS with known gap cho privacy bắt buộc. Proxy kết thúc **`online`**; emulator helper released.
