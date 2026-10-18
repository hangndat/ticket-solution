# DoD revalidation — PR #281 / Issue #271 (invite HTTP CSRF + VI)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Orca terminal `term_11a9efe6-7460-4d2e-8bf5-c3f23130c970` · task `task_a61035aa4e3e` · dispatch `ctx_7707bc519835` · Agent cursor |
| Independence | ≠ implementer `ctx_23223774b34c` · ≠ fix worker `ctx_dae70b696766` · ≠ prior FAIL reviewer `ctx_ca9c5ef6afb5` |
| Scope | Issue [#271](https://github.com/hangndat/ticket-solution/issues/271) · PR [#281](https://github.com/hangndat/ticket-solution/pull/281) · ownership `apps/web` only · Architecture impact: **Không** |
| Commit SHA | **`84efc4af10717138d65afab7f50ae5f741a6e086`** (exact tip; `git rev-parse` + `gh pr view 281` `headRefOid`) |
| Prior FAIL (không kế thừa) | SHA `375ad7ab1eef89b7f720e834dc5b58a76ad1bf3d` · artifact `docs/reviews/D11-PR-281-INVITE-HTTP-DOD.md` · **FAIL** vì CI `web` lint đỏ (`setTokenOverride` sync trong `useEffect`) |
| Verdict | **PASS** |

## Checks (trên exact SHA)

| Check | Kết quả | Evidence |
| ----- | ------- | -------- |
| Tip SHA khớp PR | **PASS** | Worktree `hangndat/d11-281-invite-dod-reval` HEAD = `84efc4af…`; PR #281 tip cùng SHA |
| Diff fix vs FAIL tip | **PASS** | `375ad7a..84efc4a` chỉ `apps/web/app/invite/invite-accept.tsx` — bỏ `parkQueryTokenIfPresent` + `setTokenOverride(parked)` trong effect; đọc `?token` trong pure `getInviteTokenSnapshot`; effect chỉ `persistInviteToken` (sessionStorage + `history.replaceState`) |
| setState-in-effect (park) | **PASS** | Không còn `setTokenOverride` / sync setState trong park effect (L103–109). CSRF bootstrap vẫn `setCsrfReady` trong async `finally` — CI lint trên tip xanh |
| Unit CSRF + VI | **PASS** | `pnpm --filter @ticket/web exec tsx --test tests/invite-messages.test.ts tests/invite-csrf.test.ts` trên cùng tip (sibling wt `d11-invite-http-271`) → **12 pass / 0 fail** |
| CI web (+ aggregate) | **PASS** | Run [39094781474](https://github.com/hangndat/ticket-solution/actions/runs/39094781474) · `headSha=84efc4af10717138d65afab7f50ae5f741a6e086` · conclusion **success** · jobs `web` + `ci` + `changes` + `turbo-persist` SUCCESS; backend/mobile/db skipped (path filter) |
| Ownership | **PASS** | `main...84efc4a`: chỉ `apps/web` (+ `docs/reviews/D11-INVITE-271-EVIDENCE.md`) — không BE/iOS/contracts/lockfile |

## Checklist revalidation

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | -------- | ------- | ------- |
| 1 | setState-in-effect park đã hết; CI web xanh trên SHA này | **PASS** | Fix commit `84efc4a`; CI run `39094781474` (mới hơn FAIL run `39094490312`) |
| 2 | CSRF / park / VI / tests vẫn đúng | **PASS** | CSRF: Origin missing/mismatch + double-submit unit; park: snapshot `#` → `?` → sessionStorage + strip URL; VI: INVITE_*/CSRF_*/network map không lộ raw code làm title |
| 3 | Artifact REVAL exact SHA + verdict | **PASS** | File này |

### CSRF / park / VI (chi tiết)

- **CSRF bootstrap:** `InviteAcceptForm` vẫn GET `/api/bff/me/tenants` trước khi enable submit (`csrfReady`).
- **CSRF fail-closed:** `invite-csrf.test.ts` + `routes.integration.mjs` (evil/missing Origin) — không đổi hành vi trên tip.
- **Token park:** `getInviteTokenSnapshot` đọc `#token` rồi `?token` rồi sessionStorage; effect persist + strip; UAT script assert `tokenLeakedInUrl=false` (implementer evidence; reviewer không re-host Keycloak).
- **VI copy:** `invite-messages.ts` + unit — used / invalid-or-expired / CSRF Origin / network không claim success giả.

## Findings

- **Blocker:** không (FAIL lint trên `375ad7ab…` đã đóng bởi tip `84efc4af…` + CI xanh).
- **Should-fix trước merge:** không.
- **Nit (non-blocking):** `D11-INVITE-271-EVIDENCE.md` vẫn pin tip cũ (`8fe71f83…`) — evidence UAT vẫn hợp lệ cho AC; nên cập nhật tip SHA khi merge/handoff (không chặn DoD).

## Limitations

1. Reviewer không tái chạy headless UAT + Keycloak/Nest trong session này — dựa unit 12 pass + CI `web` lint/typecheck/test/build/routes trên exact SHA + evidence implementer (known gap env `OIDC_ISSUER` LAN vẫn ghi nhận, không phải regression tip).
2. Không merge / không đổi Project Status (coordinator).
3. Không kế thừa verdict từ `375ad7ab…`.

## Verdict

**PASS** — revalidation DoD trên exact SHA `84efc4af10717138d65afab7f50ae5f741a6e086`. Prior FAIL (lint setState-in-effect) **không** kế thừa. Coordinator có thể merge khi sẵn sàng; reviewer **không** merge.
