# DoD review — PR #240 / Issue #231 (D11 iOS Gate staff scan)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Orca worker `term_0d946950-c26e-4f1b-8957-94592a5770f9` · task `task_432a1998e166` · dispatch `ctx_8a4c70fb7370` · run `run_fc9a4f91e99c` — **≠** implementer (`ctx_fcb26ae7ed3a`) |
| Scope | PR [#240](https://github.com/hangndat/ticket-solution/pull/240) → `main`; Issue [#231](https://github.com/hangndat/ticket-solution/issues/231) (parent #230 · Epic #222). Ownership: `apps/mobile` staff/gate + handoff `apps/mobile/D11-B4-IOS-STAFF-SCAN-HANDOFF.md` |
| Commit SHA | **`f67b9a8ec9fbe924beb1a13ab151df080dea1ffb`** (confirmed `git rev-parse HEAD` == tip PR + CI `head_sha`) |
| Checks | See below |
| Verdict | **PASS with known gap** |

## Checks (on exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Worktree SHA | **PASS** | `git rev-parse HEAD` → `f67b9a8ec9fbe924beb1a13ab151df080dea1ffb` |
| Unit tests | **PASS** | `cd apps/mobile && pnpm test` → **191 pass / 0 fail** (incl. `gate-outcome-copy`, offline banner online≠admit, supervisor `admissionKind`) |
| Typecheck / lint | **PASS** | `pnpm typecheck` clean · `pnpm lint` clean |
| CI tip | **PASS** | Actions run `39053831424` · `head_sha` = `f67b9a8…` · `mobile` SUCCESS · aggregate `ci` SUCCESS · `changes` / `turbo-persist` SUCCESS (web/backend/db path-filtered skip) |
| Local xcodebuild | **PASS (handoff; not re-run)** | Logs under `apps/mobile/.uat-artifacts/d11-b4-ios/`: Debug + Release `** BUILD SUCCEEDED **`; `DEVELOPMENT_TEAM=BLUA62D52G`; sim `121ECECA-D9F9-45D6-BC69-789958E07055` (**D11-Gate-UAT**). Reviewer did **not** re-run prebuild/xcodebuild. |
| Headless sim UAT | **PASS (artifacts)** | `staff-scan.png` / `staff-home.png` present; screenshot shows composition VI: ngoại tuyến banner, «Ngữ cảnh cổng», «Vùng quét», offline queue warning «chưa cho vào». Tool path: `scripts/sim-uat.sh` / AXe (handoff). |
| Fixture #237 E2E sync | **GAP** | `:4111` responds Nest-style 404 on `/` and `/api/health` — not a READY check-in/sync fixture for this review. **E2E sync thật không bắt buộc** per DoD task when UI/queue AC đủ. |

## Checklist vs AC

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | Composition PD Gate (ngữ cảnh · vùng quét · outcome lớn · hàng đợi) | **PASS** | `staff.tsx` layout + handoff screenshot |
| 2 | Copy VI; states online/offline/pending/APPLIED/DUPLICATE/CONFLICT/REJECTED/unknown/queued/already | **PASS** | `gate-outcome-copy.ts` + queue chips; unit coverage |
| 3 | `unknown` / `queued` / DUPLICATE / CONFLICT **không** tone admit | **PASS** | Tests assert; `presentQueueStatus` duplicate/conflict → `unknown`; queued/unknown → assertive + «không/chưa cho vào» |
| 4 | Pending / syncing không màu thành công | **PASS** | `tone: 'unknown'` |
| 5 | Banner «Trực tuyến» ≠ admit | **PASS** | `offlineBannerCopy` online → `tone: 'default'`; test `assert.notEqual(online.tone, 'admit')` |
| 6 | Already-checked-in distinct from fresh admit | **PASS** | `admissionKind` UI-only; titles «Cho vào» vs «Đã check-in trước đó»; protocol phase vẫn `admitted` (ADR-18 / existing race) |
| 7 | Race protocol / classifyScan / reconcile unchanged | **PASS** | Diff only adds optional `admissionKind` on `GateOp` + clear on non-admit branches; `classifyScan` / `runScan` / reconcile paths untouched |
| 8 | Ownership mobile-only | **PASS** | 9 files under `apps/mobile/` only |
| 9 | No EAS Cloud / Team personal | **PASS** | Handoff + logs Team `BLUA62D52G`; no EAS cloud evidence |
| 10 | Headless UAT (not computer-use) | **PASS** | Artifacts + handoff claim AXe/`sim-uat`; screenshot honest (offline / chưa đăng nhập) |
| 11 | Independent reviewer ≠ implementer | **PASS** | Dispatch `ctx_8a4c70fb7370` ≠ `ctx_fcb26ae7ed3a` |

## Known gaps (non-blocking)

1. **E2E offline sync với fixture #237** — chưa có sync check-in thật trên API READY; UI/queue/unit đủ AC Task. Theo dõi khi fixture handoff.
2. **Reviewer không re-run xcodebuild / sim-uat** — tin logs + PNG local trên SHA tip; giới hạn: binary không rebuild trong session DoD này.
3. **Physical device UAT** — không (AC cho phép headless sim; không claim pilot/device).
4. **Screenshot outcome denied** — handoff ghi flake AXe; phủ bằng unit `gate-outcome-copy` / `supervisor` (chấp nhận).

## Findings

- **Blocker:** không.
- **Should-fix:** không.
- **Nit (không chặn merge):** `already-checked-in` dùng `tone: 'admit'` (xanh) với title khác fresh — đúng «đã ghi nhận / cho qua theo kết quả cũ»; không lẫn DUPLICATE/CONFLICT. Nếu PD muốn màu trung tính cho already, follow-up UX riêng.

## Verdict

**PASS with known gap** trên exact SHA `f67b9a8ec9fbe924beb1a13ab151df080dea1ffb`.

An toàn để coordinator merge PR #240 sau khi chấp nhận gap E2E fixture #237 (đã ghi trong handoff/PR). Revalidate nếu tip có commit **hành vi** mới sau SHA này; commit docs evidence-only không cần re-run behavior review.

Không merge từ session reviewer này.
