# #859 — Revalidation độc lập patch F02 đã user-duyệt

> **Đối chiếu của coordinator, 2026-10-24:** Kết luận nghiệm thu dùng bản tổng hợp [UI-FIXALL-2026-10-23.md](UI-FIXALL-2026-10-23.md). UI còn thiếu History bắt buộc nên **chưa đạt**, không chấp nhận nhãn “PASS with gap” ở bảng reviewer bên dưới. Dòng F02-RESTART “Đóng” cũng chưa đủ căn cứ: vé759 được dùng cho foreground, không phải restart offline cùng operation/partition. Giữ F02-M10/F02-RESTART mở. Code/unit và Security PASS chỉ trong phạm vi source/tests đã nêu; chưa có runtime revoke drill.
>
> [Root checkpoint cuối](assets/UI-F02-APPROVED-REVIEW-2026-10-24/root-final-checkpoint.json) xác nhận 8 hash không đổi, baseline37 không drift ngoài context đã duyệt. Vé759 server APPLIED lúc17:27:25Z nhưng AX vẫn pending tới17:27:57Z; icon resume17:28:33Z mới hiện “Được vào”. Do đó icon tap chứng minh UI cập nhật, **không chứng minh POST chỉ bắt đầu khi chạm icon**; nguyên nhân chênh lệch lifecycle/render chưa được xác định. VéM10ffea vẫnACTIVE/chưa ledger lúc17:30:58Z. Không dùng DB để giả receipt client hay đóng recovery.

## Provenance

| Mục | Giá trị |
| --- | --- |
| Reviewer | James · `reviewer-dod` / `reviewer-merged.md` · `dod+sec+ux` |
| Dispatch | `task_4158da7d1402` · `ctx_a4adbc2f5cc1` (batch) → `task_9f1797825109` · `ctx_e2ded3cdeddb` (provenance) → `task_68b79ccaa531` · `ctx_e62b54efb44b` (AppState 759aa) |
| Implementer (batch) | Zico · `ctx_1270309dd3e4` / `ctx_2d867efd7089` / `ctx_869c3003a36b` (≠ reviewer) |
| HEAD | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` · **dirty** · không integrated SHA |
| Freeze | [approved-freeze-manifest.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/approved-freeze-manifest.json) · worker [REPORT-F02-APPROVED-IOS.md](../../.orca-metrics/fix-all/REPORT-F02-APPROVED-IOS.md) |
| Simulator | `UI-FixAll-859` / `B0727247-340D-423A-8547-A6C107A9756A` · Debug 26 · 393×852 @3 · VI |
| DB | `ticket_fixall_859` · fixtures `adbef3d7-…` (foreground) ACTIVE → USED sau sync |
| Proxy cuối | **online** · `:3009/v1/health` **200** |

## Source freeze (8 file)

[source-hashes-verified.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/source-hashes-verified.json): **8/8** SHA-256 khớp manifest user-duyệt. Baseline reviewer: context `4861bf78…` (dirty checkpoint); `_layout` git HEAD `232ac014…`; `staff-gate-workspace-context` copy HEAD `5b93c4d3…` — không dùng làm runtime proof.

## Checks (reviewer, SHA trên)

```text
apps/mobile: npm run typecheck → PASS (batch Zico, không rerun trong provenance pass)
apps/mobile: npm test → 392/392 PASS (batch Zico, không rerun trong provenance pass)
```

### Code / lifecycle (patch đã duyệt)

| AC patch | Đánh giá |
| --- | --- |
| `StaffGateWorkspaceProvider active={identity.status === 'verified'}` | Khớp `_layout.tsx` |
| Mount + foreground một chain (`scheduleGateWorkspaceLifecycleWork`) | Khớp `gate-workspace-lifecycle.ts` + tests |
| Eager `ready=false` + generation invalidate trước queue | Khớp provider + test invalidate-after-await |
| `loadWorkspaceWithLifecycleGuard` trước assign `workspaceRef` | Khớp |
| `await offlineScanQueue.bindUser` trước sync | Khớp |
| Eligibility fail-closed khi `refresh` (không sticky staff A → B) | **F02-SEC-02** test PASS trong `staff-eligibility.test.ts` |

Orphan `6c812d24-…`: theo [ORPHAN-COORDINATOR-DECISION.md](../../.orca-metrics/fix-all/ORPHAN-COORDINATOR-DECISION.md) — **unknown non-admit**; `GateOp` không đủ H03 replay; **không** miễn bằng patch iOS.

## Native UAT — fixture `adbef3d7-…` (reviewer ACTIVE)

Tóm tắt: [uat-adbef-foreground-summary.txt](assets/UI-F02-APPROVED-REVIEW-2026-10-24/uat-adbef-foreground-summary.txt)\
Timeline chi tiết: [uat-provenance-actions.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/uat-provenance-actions.json)

| Bước | Kết quả | Phân loại |
| --- | --- | --- |
| Staff inject trước flow | `refresh-native-staff.mjs` + `open-staff-session.mjs` @ `fetchedAt` 2026-10-23T17:20:52Z | [jwt-staff-metadata.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/jwt-staff-metadata.json) — `staffAccessTokenPresent`, `iat`/`exp`/`sub`/`preferred_username`, **không** token |
| UUID 36 ký tự (char-by-char Orca) | [ax-uuid-36chars-proof.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/ax-uuid-36chars-proof.json) | — |
| Online preview «Mã đọc được, chưa xác minh» | [f02-adbef-modal-open.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-adbef-modal-open.png) | — |
| Offline queue >5s | AX: «Có lượt chờ đồng bộ offline», «Offline — chờ đồng bộ» · [f02-adbef-queued-offline-8s.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-adbef-queued-offline-8s.png) | **Đóng** (queue contract) |
| Online → **Home** → **`simctl terminate` + `launch`** → «Được vào» t=5s…25s, không manual sync | [f02-adbef-foreground-25s.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-adbef-foreground-25s.png) | **Cold/warm relaunch** — **không** chứng minh `AppState` foreground-only / `runForegroundSync` runtime |
| Server receipt (scoped) | `clientEventId` `357a6d33-dd0b-416c-a192-263254a1b555` · `checkinId` `79e07462-b5c3-4c4c-999e-8d641586dd26` | [root-db-checkpoint.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/root-db-checkpoint.json) (17:17:45Z, chưa applied) → [root-db-after-adbef.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/root-db-after-adbef.json) |

## Native UAT — fixture `759aa40b-…` (AppState foreground, không terminate)

Tóm tắt: [uat-759aa-appstate-summary.txt](assets/UI-F02-APPROVED-REVIEW-2026-10-24/uat-759aa-appstate-summary.txt) · log: [uat-759aa-appstate-provenance.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/uat-759aa-appstate-provenance.json)

| Bước | Kết quả |
| --- | --- |
| Staff inject trước flow @ 17:26:46Z | [jwt-staff-metadata.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/jwt-staff-metadata.json) `759aaFlowInject` |
| Offline queue + online | [f02-759aa-queued-offline-8s.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-759aa-queued-offline-8s.png) |
| Home → `simctl launch` (không terminate) | **FAIL** sync: vẫn «Offline — chờ đồng bộ» t=25s ([f02-759aa-appstate-25s.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-759aa-appstate-25s.png)) |
| **Correction:** Home → tap icon «Vemoki» (SpringBoard AX) | «Được vào» t=5s…25s · [f02-759aa-appstate-foreground-5s.png](assets/UI-F02-APPROVED-REVIEW-2026-10-24/f02-759aa-appstate-foreground-5s.png) — **không** terminate / inject giữa flow |
| Chrome sau sync | «Sẵn sàng» (không «Có lượt chờ»); **History list row** không đọc được qua AX |
| DB | `clientEventId` `4aeccfec-aa8c-475a-967a-973a2cdd787a` · [root-db-after-759aa.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/root-db-after-759aa.json) |

**Chưa chứng minh:** History tab liệt kê vé + pending badge AX; M10 `ffea00b3-…`; orphan `6c812d24-…`.

## Findings (tách patch vs mandatory #859)

| ID | Phạm vi | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| **F02-APPROVED-CODE** | Patch lifecycle | **Đóng** | Hash + batch tests/typecheck |
| **F02-SEC-02** | Security chrome | **Đóng (batch)** | Regression test + `refresh` fail-closed |
| **F02-APPROVED-OFFLINE** | UAT queue | **Đóng** | Offline queue AX + ảnh |
| **F02-APPROVED-RELAUNCH** | UAT sync sau relaunch | **Đóng** | terminate+launch, «Được vào» |
| **F02-APPROVED-APPSTATE** | F02 foreground runtime | **Đóng (có điều kiện)** | `759aa40b`: Home + tap icon → «Được vào»; `simctl launch` alone **không** đủ |
| **F02-759AA-HARNESS** | Orca harness | **Mở (ghi chú)** | Launch không trigger sync; icon tap mới có AppState proof |
| **F02-HISTORY-PENDING** | History AX | **Mở** | Không claim pending=0 trên list; chỉ chrome «Sẵn sàng» |
| **F02-M10** | Mandatory #859 | **Mở** | `ffea00b3-…` |
| **F02-ORPHAN** | Mandatory #859 | **Mở** | `6c812d24-…` |
| **F02-RESTART** | Reviewer fixture partition | **Đóng** | `759aa40b` USED + `clientEventId` server |

## Verdict

| Gate | Verdict | Ghi chú |
| --- | --- | --- |
| **Approved patch (code + unit)** | **PASS** | Freeze + batch 392/392 |
| **Security (patch scope)** | **PASS** | F02-SEC-02 đóng trên hash hiện tại |
| **UI (patch scope)** | **PASS with gap** | Queue + relaunch (`adbef`) + AppState (`759aa` via icon); **History list** chưa |
| **DoD #859 (toàn exception)** | **FAIL** | M10 + orphan + History AX; không PASS-with-gap toàn exception |
| **Local software acceptance #859** | **FAIL** | Không claim pilot |
| **Pilot ready** | **FAIL** | |

**Code complete (batch đã duyệt):** có. **Integration SHA:** chưa. **Không** sửa business source / commit trong phiên review.

## Giới hạn

- Không reset DB / SecureStore / đổi sim user.
- JWT: [jwt-staff-metadata.json](assets/UI-F02-APPROVED-REVIEW-2026-10-24/jwt-staff-metadata.json) — claims/metadata only.
- Kế thừa [UI-F02-RESUME-REVIEW-2026-10-24.md](UI-F02-RESUME-REVIEW-2026-10-24.md) (SEC-02 trước hydrate); verdict SEC trên **hash freeze hiện tại**.
