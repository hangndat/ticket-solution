# DoD review — PR #384 / Issue #380 (SEC-CACHE iOS staffEligible)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Orca terminal `term_70b6a22e-a32e-49d5-91d3-5e7265b98745` · task `task_d45934be1eb1` · dispatch `ctx_a0611893a2b2` · run `run_c6f7360b34d4` — **≠** implementer (`ctx_0e58dcce1182`) |
| Scope | PR [#384](https://github.com/hangndat/ticket-solution/pull/384) → `main`; Issue [#380](https://github.com/hangndat/ticket-solution/issues/380) (iOS portion). Ownership: `apps/mobile` only |
| Commit SHA | **`31cd9da15fcd7212f3f0ae60a11c50213186b885`** (confirmed `git rev-parse HEAD` == PR tip == CI `headSha`) |
| Decision IDs | O02 (chrome theo MeEvents / deny-by-default); SEC-CACHE #380 (fail-closed clear sticky `staffEligible`) |
| Architecture impact | Không — UX privilege signaling / cache clear; không đổi contract API |
| Checks | See below |
| Verdict | **PASS** |

## Checks (on exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Worktree SHA | **PASS** | `git rev-parse HEAD` → `31cd9da15fcd7212f3f0ae60a11c50213186b885` |
| Unit tests | **PASS** | `cd apps/mobile && pnpm test` → **220 pass / 0 fail** (incl. `isMembershipAuthzDenial`, MeEvents 403 → not sticky, `reset()` aborts late ok, Gate `MEMBERSHIP_REVOKED` → `membershipAuthzDenied`) |
| Typecheck / lint | **PASS** | `pnpm typecheck` clean · `pnpm lint` clean (after local `pnpm install --filter @ticket/mobile...`) |
| CI tip | **PASS** | Actions run [`39123306469`](https://github.com/hangndat/ticket-solution/actions/runs/39123306469) · `headSha` = `31cd9da…` · `mobile` SUCCESS · aggregate `ci` SUCCESS · `changes` / `turbo-persist` SUCCESS (web/backend/db path-filtered skip) |
| EAS Cloud | **PASS** | Diff chỉ `apps/mobile` identity/gate/screens; không EAS / cloud build |
| Ownership | **PASS** | 5 files under `apps/mobile/` only — không `apps/web` |

## Checklist vs AC

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | Fail-closed clear cache on MeEvents 401/403 | **PASS** | `probeMeEvents` → `unauthorized` → `StaffEligibilityStore.refresh` gọi `reset()`; refresh cũng publish `staffEligible:false` ngay khi bắt đầu probe (không giữ prior `true`) |
| 2 | Tab Nhân viên không sticky sau revoke | **PASS** | `_layout.tsx`: `hidden={!showStaff}` với `showStaff = eligibility.staffEligible === true`; Gate `MEMBERSHIP_*` / `PERMISSION_DENIED` / 401 → `membershipAuthzDenied` → `clearStaffChromeAfterAuthzDenial()` (`reset` + refresh nếu session còn verified) |
| 3 | `reset()` abort in-flight — late 200 không hồi chrome | **PASS** | Unit `StaffEligibilityStore reset aborts in-flight so late ok cannot restore revoke` |
| 4 | Gate open-session `MEMBERSHIP_REVOKED` signals caller | **PASS** | `runScan` + test; `reconcileOp` cũng trả `membershipAuthzDenied`; `staff.tsx` wire cả scan + reconcile |
| 5 | Soft-deny nếu đã vào staff route | **PASS** | `(tabs)/staff/index.tsx` Redirect `/staff-access` khi `!staffEligible` (baseline O02; vẫn đúng sau reset) |
| 6 | Tests + typecheck + lint | **PASS** | Xem bảng Checks |
| 7 | Không EAS | **PASS** | Không đụng Expo cloud build |
| 8 | iOS portion đủ; web có thể PR riêng | **PASS** | Task/PR ghi rõ; không chặn merge iOS |
| 9 | Independent reviewer ≠ implementer | **PASS** | `ctx_a0611893a2b2` ≠ `ctx_0e58dcce1182` |
| D-O02 | Nav theo permission server | **PASS** | Chrome vẫn SoT MeEvents; PR chỉ fail-closed khi authz revoke — không tự cấp quyền bằng tab |
| D-PD-6.1 / D-PERM-UAT | Dual-persona headless sim trên SHA này | **Known gap (non-blocking)** | Không re-run sim-uat guest/staff trên tip; SEC-CACHE AC phủ bằng unit + wiring. Gap không nuốt fail-closed cache clear |

## Findings

- **Blocker:** không.
- **Should-fix:** không.
- **Nit (không chặn merge):** `isMembershipAuthzDenial(401, *)` luôn true (kể cả body rỗng) — đúng fail-closed; MeEvents path đã map mọi 401/403 → `unauthorized` trước khi helper Gate dùng.

## Limitations

1. **Web SEC-CACHE** — ngoài scope PR #384; theo dõi Issue #380 / PR web riêng.
2. **Không sim-uat revoke dual-persona trên SHA này** — unit + CI mobile đủ AC Task; không claim physical-device / pilot.
3. Reviewer không rebuild Xcode — không bắt buộc cho slice cache/unit này.

## Verdict

**PASS** trên exact SHA `31cd9da15fcd7212f3f0ae60a11c50213186b885`.

An toàn để coordinator merge PR #384 khi được ủy quyền integration. Revalidate nếu tip có commit **hành vi** mới sau SHA này.

Không merge từ session reviewer này.
