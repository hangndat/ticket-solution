# #859 — Revalidation bảo mật F02 sau batch fix cuối

| Mục | Kết quả |
| --- | --- |
| Reviewer | Turing · `reviewer-security` / đối chiếu DoD · session `orca_session_id:7f6390c5-ca54-4868-8879-9f2b5c2029db` · độc lập Ada/Santos |
| Scope | Source mobile Gate receipt/replay/session recovery/logout; PG receipt evidence. Không điều khiển simulator, không sửa source. |
| Exact HEAD | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` · dirty worktree |
| Source freeze | `.orca-metrics/fix-all/private/full-revalidation-freeze.json` · SHA-256 `e0c7482763b00fd095be08308c320542a81811a02993144ff5673f98e199ec43` · **77/77** file khớp sau tests |
| Contract | `docs/architecture/F02-OFFLINE-RECEIPT-2026-10-24.md` · SHA-256 `1b32cc12940a1b55607f264cbc7aec952138dd5d6829ca6ec49abd26057b349d`; thêm `.orca-metrics/fix-all/DECISION-F02-ORDER-RECOVERY.md` |
| Verdict | **FAIL — security/correctness gate; chặn code complete, acceptance và pilot** vì F02-SEC-03/04 bên dưới. Không mở batch fix mới trong dispatch này. |

## Pin diff và checks độc lập

Freeze trước `.orca-metrics/fix-all/private/full-final-freeze.json` có 72 file. Freeze mới có 77 file: 9 file cùng path đổi hash và 5 path mới. Vùng thay đổi: `gate-known-op-recovery`, `offline-scan-reconciliation`, `offline-sync-receipt`, `staff-gate-device-history-panel`, `staff-gate-workspace-context`, test tương ứng; thêm `gate-session-renewal`, `offline-queue`, `wallet-logout` và tests; `packages/backend/test/offline-sync-receipt.test.cjs` đổi. Backend runtime `packages/backend/src/offline-sync.ts`, `apps/api/src/gate.ts`, contracts và OpenAPI **không đổi hash** so với freeze trước; không kế thừa author tests thành independent check. HEAD không đổi; đây là dirty source freeze, chưa có integrated commit.

| Check trên freeze mới | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/backend test:offline-receipt` | **9/9 PASS**, exit 0; isolated PG, `receipt_login` → `ticket_runtime NOBYPASSRLS` (`packages/backend/test/offline-sync-receipt.test.cjs:48-135`). |
| `pnpm --filter @ticket/mobile test` | **438/438 PASS**, exit 0. |
| `pnpm --filter @ticket/mobile typecheck` | **PASS**, exit 0. |
| Manifest + contract SHA-256 check sau tests | **77/77** source files khớp; contract khớp. |

Backend test mới tạo ticket/checkin thực rồi đổi ticket `USED→ACTIVE` để xác nhận `NO_LONGER_CURRENT` historical; hai mismatched join hợp lệ FK đều trả uniform `OFFLINE_SYNC_RECEIPT_NOT_FOUND` (`packages/backend/test/offline-sync-receipt.test.cjs:727-892`). Test còn xác nhận hai FK `ON DELETE RESTRICT` và thao tác làm mất referenced ticket/checkin bị chặn (`:894-980`); đây là invariant cho trường hợp row thiếu thật, đúng quyết định coordinator trong `DECISION-F02-CONSOLIDATED-BATCH.md`. Backend runtime authz/RLS/GET đã được review trên cùng hash trong `F02-FULL-SECURITY-2026-10-24.md`; không tuyên bố chạy lại HTTP end-to-end ở dispatch này.

## Bảng findings xuyên freeze

| ID / trạng thái | Bằng chứng và điều kiện đóng |
| --- | --- |
| **F02-SEC-01 · Đã xác minh** | Import chụp epoch trước `resolveGateAuth`, guard trước GET, sau await và trước `persist`, bao gồm recorded noop (`staff-gate-workspace-context.tsx:871-955`, `gate-known-op-recovery.ts:110-219`). Foreground/sync capture trước probe/bind; replay guard epoch + user/scope/session/generation trước POST, sau POST và trước commit (`staff-gate-workspace-context.tsx:329-414,435-452,854-865`, `offline-queue.ts:487-601`). Test stale-before-request/response và same-user reauth theo `SessionBoundary.generation` pass. Đây là closure cho receipt/replay, không bao gồm scan/logout race F02-SEC-03. |
| **F02-SEC-02 · Đã xác minh** | Receipt 401/403 ở import và background lookup gọi callback sau lifecycle guard (`gate-known-op-recovery.ts:177-185`, `offline-sync-receipt.ts:273-305`); `clearStaffChromeAfterAuthzDenial` reset eligibility đồng bộ trước refresh server (`staff-gate-workspace-context.tsx:98-104`). Stale response không reset user mới. Tests cả hai status trong cả hai path pass. |
| **F02-CON-01 · Đã xác minh** | Replay chỉ rebase changed operation IDs lên `viewRef.current.ops` mới, bỏ ghi đè recorded từ import (`offline-scan-reconciliation.ts:76-92`, `staff-gate-workspace-context.tsx:392-414`). Workspace writes nối chuỗi (`:217-229`); test hai thứ tự deferred X/Y và JSON reload giữ hai receipt pass. |
| **F02-CON-02 · Đã xác minh** | Input UUID uppercase được canonical lowercase trước GET/dedupe (`gate-known-op-recovery.ts:24-28`); test uppercase → một recorded row pass. |
| **F02-EVID-01 · Đã xác minh** | Independent PG test 9/9 trên runtime role NOBYPASSRLS chứng minh `NO_LONGER_CURRENT`, mismatched ticket/checkin joins → 404 và FK làm missing row bất khả thi khi constraints còn hiệu lực. |
| **F02-FLOWA-QUEUE-REJECT · Source fix đã xác minh; native acceptance chờ James** | Renewal chỉ kích hoạt khi per-item `REJECTED/OFFLINE_SYNC_REPLAY_ORDER_INVALID` khớp active session/scope (`staff-gate-workspace-context.tsx:360-367,416-432`); dùng server-issued session, không rewrite old op/payload hoặc revoke old pending (`gate-session-renewal.ts:4-42`). Guard epoch, once-per-session Set; 401/403 reset eligibility và session null. Author trace cho old denied/new session thật; reviewer này không điều khiển simulator. |
| **F02-HISTORY-ID · Đã xác minh từ artifact AX** | Row `accessible={true}` với full operation/checkin UUID (`staff-gate-device-history-panel.tsx:157-167`). `m10-applied-history-ax.json` chứa **cả** `08adf857-27da-492d-be03-77280a109119` và `543049fc-90b2-40e6-8115-11b59c96528b` ở trạng thái từ chối, cùng `6380dc86-7cab-4539-8e73-112f541a8dd1` APPLIED. Nhận xét root trước đó về thiếu hai row do lọc AX là sai; không dựng finding mất dữ liệu từ nhận xét đó. |
| **F02-M10 / F02-HISTORY runtime · Chờ reviewer native độc lập** | Author chứng minh queue op `6380dc86…` → terminate/launch OFFLINE → online không inject → POST APPLIED checkin `65437eb8…`; AX có full IDs/pending 0 theo handoff. Đây là **author proof**, không thay independent native flow/physical-device acceptance. |

## Findings mới, chặn merge

### F02-SEC-03 — Deferred scan/reconcile có thể tái tạo workspace sau logout

**Loại:** correctness/privacy · **blocker: Có** · phát hiện mới trong revalidation, không khẳng định là regression riêng của một dòng diff. `submitScan` chờ `resolveGateAuth`, `bindUser`, `runScan` và có thể chờ queue trước khi gọi `persist` mà không kiểm epoch/generation/logout trước commit (`staff-gate-workspace-context.tsx:675-792`). `reconcile` tương tự chờ auth/POST rồi gọi `persist` (`:825-848`). `persist` dùng closure `verifiedUserId`/`gateScope` cũ, đồng bộ cập nhật `workspaceRef`, rồi enqueue `saveStaffGateWorkspace` cho user cũ (`:307-326`). `logoutStaff` chỉ tăng `feedbackGeneration` và chờ **những writes đã enqueue** trước khi `logoutAndClearWalletArtifacts` xóa key (`:964-973`, `wallet-logout.ts:113-131`); một `runScan`/`reconcileOp` còn pending không nằm trong write chain và có thể hoàn thành **sau** xóa, tạo lại key `ticket.gate.workspace.v2.<oldUserId>`. Logout từ entry point wallet khác còn không chờ `workspaceWriteRef`. Operation cũ cũng có thể hiển thị lại trong memory/feedback khi callback muộn. Unit tests hiện chỉ phủ race queue enqueue và replay/import, không phủ provider submit/reconcile so với logout.

**Điều kiện đóng:** fence session epoch + verified user + scope/session/generation trước mọi side effect sau await của submit/reconcile và trước durable save; fence/serialize purge với tất cả workspace writes (kể cả logout từ entry point khác). Test deferred `runScan` và `reconcileOp` theo hai thứ tự logout/write, kể cả same-user reauth và user switch: không admission/feedback cũ, không key cũ sau purge, không ảnh hưởng workspace mới. Không sửa source trong revalidation này.

### F02-SEC-04 — Legacy global Gate key có thể rehydrate dữ liệu sau purge

**Loại:** privacy/cross-user isolation · **blocker: Có** · phát hiện mới khi kiểm đường logout. `clearStaffGateWorkspace` chỉ xóa per-user v2 key (`staff-gate-workspace-store.ts:124-128`); `wallet-logout.ts:124-130` gọi clear này. Khi v2 không còn, `loadStaffGateWorkspace` luôn chạy `migrateLegacyWorkspace` (`staff-gate-workspace-store.ts:69-110`), đọc global `ticket.gate.ops.v1`, rồi tự lấy tenant/event từ op cũ nếu chưa có persisted scope. Legacy writer/reader của key này vẫn tồn tại (`gate-store.ts:4-25`); không có xóa legacy key trong logout hoặc migration. Vì vậy thiết bị từng lưu legacy ops có thể rehydrate operation sau explicit logout vào workspace user mới và có thể hiển thị nếu user đó có quyền cùng event. Đây là đường dẫn code có điều kiện legacy key tồn tại; không tuyên bố đã tái hiện trên simulator cụ thể.

**Điều kiện đóng:** migration phải gắn ownership đã xác minh hoặc fail closed đối với global legacy ops; purge legacy key khi explicit logout/migration phù hợp privacy, và không cho account B nạp op của A. Test seed legacy key thật → migrate/logout/relogin A và login B; không có lịch sử cũ, còn unreachable cold start vẫn giữ dữ liệu đúng user.

## Recovery, giới hạn và checkpoint

Receipt GET vẫn chỉ là lịch sử, `recorded` neutral/non-admit; 404/network/malformed không biến thành server rejection. Durable order rejection giữ immutable op cũ, session thật mới chỉ cho scan tương lai; session mở thất bại để `null` và offline không thể tạo scan với old session. Chưa phát hiện regression tenant leak trong backend runtime không đổi hash. `staff-gate-workspace.ts:10,50-54` vẫn cắt v2 ops còn 5 mỗi scope; History AX sau M10 hiển thị 7 row vì thêm queue rows (`staff-gate-device-history.ts:33-107`). Không suy diễn AX hiện tại mất denied rows; retention dài hạn và pagination không phải bằng chứng native acceptance cho #859.

**Verdict phân tầng:** code complete **FAIL** (F02-SEC-03/04), security **FAIL**, acceptance **FAIL** (hai blocker và native independent proof chưa xong), pilot ready **FAIL**. Không dùng `PASS with known gap` cho privacy/acceptance bắt buộc. Handoff coordinator: giữ checkpoint `2/2 + ngoại lệ + resume rollback + approved lifecycle + đúng một full fix batch` từ `DECISION-F02-FULL-2026-10-24.md`/`DECISION-F02-CONSOLIDATED-BATCH.md`; không tự mở lượt fix hay reset counter. Cần quyết định mới có thẩm quyền và kế hoạch xác minh giới hạn trước source fix tiếp. Không commit/push/PR/Issue/Project/cloud/store.
