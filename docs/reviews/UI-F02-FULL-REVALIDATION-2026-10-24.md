# #859 — Revalidation độc lập sau consolidated fix (F02 full batch)

> Coordinator tổng hợp sau khi cả hai lane hoàn tất: native UI/simulator PASS trong scope report này. Code complete/security/acceptance tổng thể **FAIL** do F02-SEC-03/04 trong [review bảo mật post-fix](F02-FULL-SECURITY-REVALIDATION-2026-10-24.md). Các dòng static security còn chờ/pre-fix bên dưới là trạng thái khi James viết, đã được thay bằng verdict post-fix của Turing.


| Field | Value |
| --- | --- |
| Reviewer | James · `reviewer-dod` / `reviewer-merged.md` (native `dod+ux`; **không** duplicate static security — Turing `F02-FULL-SECURITY-2026-10-24.md`) |
| Dispatch | `task_b02b9cd8398b` · `ctx_5bb479de9d5c` |
| Implementer | Ada (iOS) · Santos (PG test) — **≠** reviewer |
| `git rev-parse HEAD` | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (**dirty**, không integrated SHA) |
| Source freeze (revalidation) | `.orca-metrics/fix-all/private/full-revalidation-freeze.json` SHA-256 `e0c7482763b00fd095be08308c320542a81811a02993144ff5673f98e199ec43` (77 paths) |
| Contract | `docs/architecture/F02-OFFLINE-RECEIPT-2026-10-24.md` SHA-256 `1b32cc12940a1b55607f264cbc7aec952138dd5d6829ca6ec49abd26057b349d` |
| Order recovery | `.orca-metrics/fix-all/DECISION-F02-ORDER-RECOVERY.md` + `docs/DECISION-LOG.md` |
| Simulator | `UI-FixAll-859` / `B0727247-340D-423A-8547-A6C107A9756A` · Debug 26 · 393×852@3 · VI |
| Runtime | API `:3001` · Metro `:8083` (PID 48112) · proxy `:3009` (PID 36920) · trace `.orca-metrics/fix-all/private/mobile-offline-trace.jsonl` |
| Proxy cuối phiên | **`online`** (`GET :3009/v1/health` → **200**) |

**Không** sửa source · không commit/push/PR/Project · không chạy lại author test matrix (438/438 + PG 9/9 chỉ cite handoff).

## JWT metadata (không bearer)

| Flow | File | Ghi chú |
| --- | --- | --- |
| A (trước bind) | [flowA-jwt-metadata.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-jwt-metadata.json) | `refresh-native-staff.mjs` → `open-staff-session.mjs` |
| B (trước bind, sau Flow A xong) | [flowB-jwt-metadata.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-jwt-metadata.json) | Không inject giữa queue→offline→restart→online trong từng flow |

## Native UAT — Flow A (foreground, vé reviewer `b11366f4-0135-4c17-bb36-f69998f0a0f6`)

| Bước | UTC (approx) | Evidence |
| --- | --- | --- |
| Online preview UUID 36 ký tự | 19:10Z | [flowA-preview-modal.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-preview-modal.png) · [flowA-preview-modal-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-preview-modal-ax.json) |
| Proxy **offline** → queue | 19:10:50–58Z | [flowA-queued-offline.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-queued-offline.png) · «Có lượt chờ đồng bộ offline» / «Offline — chờ đồng bộ» |
| History **trước** sync | 19:11Z | [flowA-history-before-sync.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-history-before-sync.png) · heading **«Lịch sử trên máy này»** · op **`f8d63674-0363-458b-a9db-f1cdfe5bdff6`** (full UUID trong `accessibilityLabel`) |
| Proxy **online** → Home → icon **0.6166, 0.2606** · chờ ~25s | 19:11Z | [flowA-after-foreground-sync.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-after-foreground-sync.png) · chrome «Sẵn sàng» |
| History **sau** sync | 19:12Z | [flowA-history-after-sync.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-history-after-sync.png) · **Được vào** · biên nhận **`11e1953f-35ca-4ebd-b789-c7731a0fa37a`** · cùng op `f8d63674-…` |
| PG scoped (read-only) | — | `offline_sync_events`: `f8d63674-0363-458b-a9db-f1cdfe5bdff6` → ticket `b11366f4-…` · checkin `11e1953f-35ca-4ebd-b789-c7731a0fa37a` |

## Native UAT — Flow B (M10 restart, vé reviewer `979d7ce0-fdd1-4fd9-a599-de3a5c6936da`)

| Bước | UTC (approx) | Evidence |
| --- | --- | --- |
| Queue **offline** (token bind đầu flow B only) | 19:12Z | [flowB-queued-before-restart-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-queued-before-restart-ax.json) |
| History trước restart · op **`4867e9d6-0070-41c6-9d90-e16811158e93`** | 19:12Z | [flowB-history-before-restart-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-history-before-restart-ax.json) |
| `simctl terminate` + `launch` **vẫn offline** | 19:12Z | [flowB-relaunch-offline.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-relaunch-offline.png) · [flowB-relaunch-offline-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-relaunch-offline-ax.json) |
| Proxy **online** → Home → icon · **không** inject mid-flow · ~30s | 19:13Z | [flowB-after-online-sync.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-after-online-sync.png) |
| History terminal | 19:13Z | [flowB-history-after-sync.png](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-history-after-sync.png) · **Được vào** · biên nhận **`74d44692-6599-4edb-a48d-6cf1a624fd85`** · cùng op `4867e9d6-…` |
| PG scoped | — | `offline_sync_events`: `4867e9d6-0070-41c6-9d90-e16811158e93` → ticket `979d7ce0-…` · checkin `74d44692-6599-4edb-a48d-6cf1a624fd85` |

## History / known-op / rows «thiếu» (root observation)

Trong [flowA-history-before-sync-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowA-history-before-sync-ax.json) và [flowB-history-after-sync-ax.json](assets/UI-F02-FULL-REVALIDATION-2026-10-24/flowB-history-after-sync-ax.json), reviewer thấy **đủ** các op durable denied `08adf857-…`, `543049fc-…`, `d2db721b-…`, author M10 `6380dc86-…`, known-op neutral `6c812d24-…` / receipt `46a428ee-…` — **không** có bằng chứng mất storage; coordinator đính chính ảnh author cũng có hai row rejected. **F02-HISTORY-ID:** row `accessible` + full UUID 36 ký tự trong label (vd. `f8d63674-0363-458b-a9db-f1cdfe5bdff6`).

**Chưa làm trong budget:** CON02 uppercase dedupe tùy chọn; physical-device camera/push (ROADMAP §1.2 — known gap pilot).

## Findings (revalidation — proof / closure)

| ID | Trước | Sau revalidation | Bằng chứng đóng |
| --- | --- | --- | --- |
| **F02-M10** | Mở | **Đóng** | Flow B: cùng `4867e9d6-…` queue offline → terminate/relaunch offline → online foreground → History + PG checkin |
| **F02-HISTORY-ID** | Mở | **Đóng** | Full op/checkin trong AX label (flows A/B + list lịch sử) |
| **F02-HISTORY** | Một phần | **Đóng** (scope local batch) | Heading đúng; known-op + denied rows còn; M10 persist qua restart |
| **F02-FLOWA-QUEUE-REJECT** | Mở (vé cũ `d2db`) | **Đóng** cho recovery path mới | Vé reviewer mới **APPLIED**; op cũ `d2db`/`08ad`/`543` vẫn denied/immutable trong History |
| **F02-EVID-01** | Mở | **Đóng** (cite lane BE) | [REPORT-F02-CONSOLIDATED-PG.md](../../.orca-metrics/fix-all/REPORT-F02-CONSOLIDATED-PG.md) 9/9; reviewer **không** rerun |
| **F02-SEC-01/02, F02-CON-01/02** | Mở (Turing pre-fix) | **Mở** (security lane) | Handoff Ada + unit tests; **không** static re-review trong dispatch James — cần Turing trên SHA post-fix nếu gate merge bắt buộc |

## Verdict

| Gate | Verdict |
| --- | --- |
| **Code complete** (freeze + dirty mobile diff, không edit reviewer) | **PASS** — freeze hash khớp task; implementation cite [REPORT-F02-CONSOLIDATED-FIX.md](../../.orca-metrics/fix-all/REPORT-F02-CONSOLIDATED-FIX.md) |
| **Security (static)** | **Không verdict** — giữ [F02-FULL-SECURITY-2026-10-24.md](F02-FULL-SECURITY-2026-10-24.md) pre-fix **FAIL** cho đến re-run độc lập |
| **UI / native acceptance (#859 batch AC)** | **PASS** — Flow A + Flow B độc lập; DB receipt khớp; proxy **online** |
| **DoD acceptance (local simulator slice)** | **PASS** |
| **Pilot ready** | **FAIL** — thiết bị thật / camera / push ngoài phạm vi simulator |

**Lịch sử review:** initial [UI-F02-FULL-REVIEW-2026-10-24.md](UI-F02-FULL-REVIEW-2026-10-24.md) FAIL DoD → một consolidated fix batch → **revalidation này**.
