# DoD revalidation — PR #182 (D7-S3 web gate offline)

Ngày: 2026-10-17  
Verdict: **PASS with known gap**

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor worker `term_d2b51b78-693a-4781-99fc-c67068f6cd7a` · task `task_683fedc1e916` · dispatch `ctx_3a2034dcb95d` (≠ implementer; revalidation after rebase) |
| Scope | #113 #114 · PR #182 · `apps/web` gate offline/degraded |
| Commit SHA | `edc733456d3683ad47a2df78e7c81c5cf98c9abd` (tip; `gh pr view 182`) |
| Behavior SHA | `fbdade1f2fdf5b7954e36cd2df2e03a63898b077` (ancestor of tip; tip commits after it are docs pin only) |
| Prior DoD | PASS with known gap on `5358d1185a5075459b336c056d9e5aeb673d17a0` — **revalidated** on tip after rebase |
| Checks | CI run [39023813822](https://github.com/hangndat/ticket-solution/actions/runs/39023813822) `head_sha` = tip → `changes`/`web`/`turbo-persist`/`ci` SUCCESS (non-web jobs SKIPPED). Local `tsx` unavailable in this worktree; unit coverage accepted via CI `web` job. Source review of tip trees for connectivity/decide/form/banner/UAT. |
| Findings / limitations | See known gaps below |
| Revalidation | Required after rebase; this artifact supersedes prior tip SHA for merge readiness |

## Checklist (#113 / #114)

- [x] Detect browser offline + API unreachable (timeout/network/0/5xx)
- [x] Banner VI `data-testid=gate-offline-banner` (offline/degraded)
- [x] Fail-closed: `decideGateConfirm` never admits on unreachable; offline blocks mutate; degraded confirms before retry
- [x] Confirm disabled when `!browserOnline`; iOS `CHECKIN_OFFLINE` guide (web does not enqueue)
- [x] `ALREADY_CHECKED_IN` (409) still admits
- [x] Ownership `apps/web` only vs `main` (13 files)
- [x] CI green on exact tip SHA
- [x] Evidence doc pins behavior SHA `fbdade1…`

## Known gaps (không chặn merge)

1. OIDC unconfigured: `GateOfflineShell` vẫn hiện banner browser-offline (fail-closed chrome).
2. Web không enqueue `CHECKIN_OFFLINE` (by design → iOS / ADR-18 / #105).
3. Degraded chỉ sau request lỗi (không proactive API probe ở shell).
4. Confirm button disable theo `!browserOnline` (không disable cứng khi degraded — dùng `window.confirm` + guard).

Coordinator **có thể merge** khi vẫn muốn; reviewer **không** self-merge.
