# #859 — Independent native DoD review (F02 full batch)

| Field | Value |
| --- | --- |
| Reviewer | James · `reviewer-dod` / `reviewer-merged.md` (`dod+ux`; security verdict **không** trong phạm vi dispatch — root/Turing `F02-FULL-SECURITY-2026-10-24.md`) |
| Dispatch | `task_ac0a4ff08c8a` · `ctx_8f6cdf12605a` |
| Implementer | Zico / Santos (≠ reviewer) |
| HEAD | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` · **dirty** · không integrated SHA |
| Freeze | `.orca-metrics/fix-all/private/full-final-freeze.json` (72 paths) — spot-check mobile gate files **khớp** |
| Architecture | `docs/architecture/F02-OFFLINE-RECEIPT-2026-10-24.md` SHA256 `1b32cc12940a1b55607f264cbc7aec952138dd5d6829ca6ec49abd26057b349d` |
| Simulator | `UI-FixAll-859` / `B0727247-340D-423A-8547-A6C107A9756A` · Debug 26 · 393×852@3 · VI |
| Runtime | Metro `:8083` PID **48112** · API `:3001` · proxy `:3009` mode file ABS · **proxy cuối: online** (`/v1/health` **200**) |
| DB (read-only) | `ui-audit-fixall-859-postgres-1` · `ticket_fixall_859` |

## Checks (reviewer, SHA trên)

| Check | Kết quả |
| --- | --- |
| Freeze spot (gate-known-op, offline-sync-receipt) | **Khớp** manifest |
| Author iOS tests/typecheck | **425/425** + typecheck PASS — cite [REPORT-F02-FULL-IOS-CONSUME.md](../../.orca-metrics/fix-all/REPORT-F02-FULL-IOS-CONSUME.md); **không rerun** full suite (hash policy) |
| Author BE handoff | Cite [REPORT-F02-FULL-BE.md](../../.orca-metrics/fix-all/REPORT-F02-FULL-BE.md) + root [root-http-receipt-proof.json](assets/UI-F02-FULL-BE-2026-10-24/root-http-receipt-proof.json) |
| Native UAT harness | Orca `emulator attach` + char-by-char `type`; Home → SpringBoard icon **0.6166, 0.2606**; submit modal tap **y≈0.237** (sticky header) |

Staff token: `refresh-native-staff.mjs` + `open-staff-session.mjs` **trước flow** · metadata [jwt-staff-metadata.json](assets/UI-F02-FULL-REVIEW-2026-10-24/jwt-staff-metadata.json) (`fetchedAt` **2026-10-23T18:40Z** flow B refresh; flow A **~18:38Z** sau online reinject) — **không** bearer in report.

## Native UAT — Flow A (foreground `32d7ace4-498d-4c0c-a15b-744cbdae281e`)

Fixture ACTIVE (root preflight + reviewer query). Summary: [uat-flowA-summary.txt](assets/UI-F02-FULL-REVIEW-2026-10-24/uat-flowA-summary.txt).

| Bước | UTC (approx) | Evidence |
| --- | --- | --- |
| UUID 36 char + preview online «Mã đọc được, chưa xác minh» | 18:36Z | [f02-flowA-preview-modal.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-flowA-preview-modal.png) · [ax-flowA-preview-modal.json](assets/UI-F02-FULL-REVIEW-2026-10-24/ax-flowA-preview-modal.json) |
| Proxy **offline** → «Gửi kiểm tra cổng» → queue **>5s** | 18:38Z | [f02-flowA-queued-offline-8s.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-flowA-queued-offline-8s.png) · AX: «Có lượt chờ đồng bộ offline», «Offline — chờ đồng bộ» [ax-flowA-queued-offline-8s.json](assets/UI-F02-FULL-REVIEW-2026-10-24/ax-flowA-queued-offline-8s.json) |
| **BEFORE sync** History heading + row | 18:38:58Z | [f02-flowA-history-offline-before-sync.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-flowA-history-offline-before-sync.png) · **«Lịch sử trên máy này»** · vé `32d7ace4-4…` · **Mã lượt `d2db721b-81d…`** (AX truncated; **chưa** full UUID in tree) |
| Proxy **online** → Home → icon foreground **25s** | 18:39:28Z → +25s | [f02-flowA-foreground-sync-25s.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-flowA-foreground-sync-25s.png) · **FAIL terminal:** «Không cho vào» — «Thứ tự hàng đợi không hợp lệ…» · chrome «Sẵn sàng» (không pending badge) |
| Server ledger | — | `offline_sync_events` **không** row cho `ticket_id=32d7ace4…` hoặc `client_event_id` prefix `d2db721b` (read-only sau sync) |

**Harness notes:** Inject staff khi proxy offline → «UAT session bị từ chối» (`/v1/me`); corrected: **online inject → preview → offline queue only**. `Kiểm tra vé` cần tap theo frame sticky (**y≈0.237**), không **y≈0.50**.

## Native UAT — Flow B (`752ba87d-ac32-4200-98d6-f2fb88836f3f` restart OFFLINE)

**Checkpoint:** **chưa chạy** trong budget sau Flow A replay reject; vé vẫn ACTIVE, chưa consumed (root preflight). Cần batch tiếp theo.

## Native UAT — History / known-op (`6c812d24-2d8e-44eb-b55d-23c358e75f09`)

| Bước | Evidence |
| --- | --- |
| Heading **«Lịch sử trên máy này»** + section đối soát | [f02-flowA-history-offline-before-sync.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-flowA-history-offline-before-sync.png) · [f02-history-known-op-reimport.png](assets/UI-F02-FULL-REVIEW-2026-10-24/f02-history-known-op-reimport.png) |
| Row neutral **«Đã ghi nhận trước đó»** · vé `e93ddc6b-1…` · mã lượt `6c812d24-2d8…` · biên nhận `46a428ee-10d…` | AX [ax-history-known-op-reimport.json](assets/UI-F02-FULL-REVIEW-2026-10-24/ax-history-known-op-reimport.json) |
| Re-import same UUID (36 char field value) | Message **«Lượt này đã được ghi nhận trước đó trên máy.»** — dedupe/no fresh admit (no new admission row in list) |
| Author PNGs `f02-full-history-tab-author` | **Không** dùng — manual form + warning; đối chiếu [root-ax-history-current-bundle.json](assets/UI-F02-FULL-IOS-2026-10-24/root-ax-history-current-bundle.json) |

**Chưa chứng minh:** persist qua **terminate/relaunch** cho known-op (budget).

## Findings (gom batch — không sửa source)

| ID | Trạng thái | Ghi chú reviewer |
| --- | --- | --- |
| **F02-SEC-01** | **Mở** | Giữ FINDINGS batch; **không** security PASS — Turing artifact |
| **F02-M10** | **Mở** | Flow A: queue contract **đóng**; foreground resume → **reject** «Thứ tự hàng đợi không hợp lệ», **không** receipt DB; Flow B **chưa** |
| **F02-HISTORY** | **Một phần đóng** | Heading + full UUID field + neutral row + dedupe message; thiếu restart persist proof |
| **F02-FLOWA-QUEUE-REJECT** | **Mở (mới)** | `d2db721b-81d…` queued locally → online sync deny; cần BE/client cursor diagnosis (root read-only) |
| C01–C12 | Theo [FINDINGS-F02-FULL.md](../../.orca-metrics/fix-all/FINDINGS-F02-FULL.md) | Implementation review + author tests; **không** thay native proof |

## Verdict

| Gate | Verdict |
| --- | --- |
| **Code complete (freeze scope)** | **PASS with reliance on author 425/425 + BE report** — reviewer không rerun full matrix |
| **Security** | **Không verdict** (out of scope dispatch); F02-SEC-01 **mở** |
| **UI / UX (History + queue)** | **PASS with gap** — History known-op dedupe + queue UI; gap: Flow A terminal + Flow B |
| **DoD #859 acceptance** | **FAIL** — M10 chưa đóng; Flow A sync fail; Flow B chưa |
| **Pilot ready** | **FAIL** |

**Không** commit / push / Project mutation trong phiên review.
