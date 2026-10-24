# DoD + Security review — PR #263 / Issue #232 (D11 Web Gate AC-G4)

| Field | Value |
| --- | --- |
| Reviewer | Cursor · Role `reviewer-dod` + `reviewer-security` (`docs/agents/roles/reviewer-dod.md`, `docs/agents/roles/reviewer-security.md`) · Orca terminal `term_97650fd0-d5af-4fd2-a5e6-800837ff4865` · task `task_cf178215fa7c` · dispatch `ctx_f6697120356b` · run `run_39e3bc589df3` — **≠** implementer (`ctx_a51abd99cc9d`) |
| Scope | PR [#263](https://github.com/hangndat/ticket-solution/pull/263) → `main`; Issue [#232](https://github.com/hangndat/ticket-solution/issues/232) (parent #230 · Epic #222). Ownership: `apps/web` `/gate` only. Architecture impact: **Không** (UI fail-closed; không đổi ADR-18 sync). |
| Commit SHA | **`30f88b3ad4373aa859cd193babad13b034829c28`** (PR tip; CI `head_sha` khớp) |
| Checks | See below |
| Verdict DoD | **PASS** |
| Verdict Security | **PASS** |

## Checks (on exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Tip SHA | **PASS** | `git rev-parse 30f88b3ad4373aa859cd193babad13b034829c28` + `gh pr view 263` tip commit = `30f88b3…` |
| Diff ownership | **PASS** | Behavior commits under `apps/web` gate (+ evidence/UAT under `docs/reviews/`); không đụng BE/iOS/contracts/lockfile |
| Unit / copy tests (implementer + CI) | **PASS (CI)** | Tip run [39090763197](https://github.com/hangndat/ticket-solution/actions/runs/39090763197) · `web` SUCCESS · aggregate `ci` SUCCESS · `headSha` = `30f88b3…`. Reviewer worktree không có `node_modules` — **không** re-run `tsx --test` local. |
| Typecheck / lint | **PASS (CI)** | Job `web` trên tip (path-filtered) |
| Headless UAT | **PASS (artifacts + script)** | Implementer: `node apps/web/tests/gate-offline-uat.mjs` + PNGs [`d11-uat/web/d11-gate-offline.png`](./d11-uat/web/d11-gate-offline.png) / [`d11-uat/web/d11-gate-online.png`](./d11-uat/web/d11-gate-online.png). Script asserts banner `Cổng web offline`, disable `gate-confirm-submit` / `gate-session-submit` khi offline, không UI «Đã xếp hàng — chờ đồng bộ». Reviewer không re-host Playwright trong session này. |
| CI tip | **PASS** | Run `39090763197` conclusion `success`; jobs `changes` / `web` / `ci` / `turbo-persist` SUCCESS; mobile/backend/db skipped (path filter) |
| Independent reviewer | **PASS** | Dispatch `ctx_f6697120356b` ≠ implementer `ctx_a51abd99cc9d` |

## Checklist AC-G4 / Issue #232

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | Offline / degraded banner plain VI | **PASS** | `GateOfflineBanner` + `OFFLINE_BANNER` / `DEGRADED_BANNER`; `data-testid="gate-offline-banner"`; title «Cổng web offline» / «API cổng không tới được» |
| 2 | Disable confirm (và mở phiên) khi unreachable | **PASS** | `actionsBlocked = link !== 'online'` → `gate-confirm-submit` / session submit `disabled`; `guardBeforeMutate` chặn browser offline cứng |
| 3 | Không giả offline queue iOS trên web | **PASS** | Copy «Không xếp hàng trên web»; tests/UAT reject `CHECKIN_OFFLINE` / «Đã xếp hàng — chờ đồng bộ»; không enqueue web |
| 4 | Copy VI admitted / denied / unknown rõ | **PASS** | `presentGateDecision`: «Cho vào» / «Không cho vào» / «Chưa rõ — không cho vào» (+ offline-blocked / already-checked-in); unknown assertive |
| 5 | Fail-closed: không admit khi API unreachable / 5xx / timeout | **PASS** | `decideGateConfirm` → `unknown` khi `timedOut` / `networkError` / `status===0` / `>=500`; admit chỉ 200 `USED`+ids hoặc 409 `ALREADY_CHECKED_IN` |
| 6 | OIDC thiếu → không mock session | **PASS** | `page.tsx` fail-closed notice khi `!isOidcConfigured()` |
| 7 | Tip fix copy routes CI | **PASS** | `30f88b3` khôi phục cụm «Không cho khách qua» trên intro/meta — không đổi logic fail-closed |

## Security (Gate authz / offline fail-closed — slice UI)

Threat / abuse cases xét trong scope web Gate UI:

| Case | Kết luận |
| --- | --- |
| Staff cố confirm khi browser offline | UI disable + `guardBeforeMutate` → deny `GATE_OFFLINE`; không POST |
| API timeout / 5xx / network error | `noteUnreachable` → degraded banner; `decideGateConfirm` → `unknown` («Không cho khách qua»); không tone admit |
| Fake «đã xếp hàng» / client queue web | Không có path enqueue `CHECKIN_OFFLINE`; copy hướng app Nhân viên |
| Admit từ payload lỗi / thiếu `checkinId` | Chỉ admit khi 200+`USED`+ids hoặc 409 `ALREADY_CHECKED_IN` đã biết |
| Thiếu OIDC | Form không mount; notice fail-closed — không mock auth |

**Không** trong scope PR: Nest/BFF gate authz, RLS, idempotency server, iOS queue sync (ADR-18 apply). Security PASS = UX fail-closed + không bypass admit phía client trong diff; không thay security gate API.

### Should-fix / nit (không chặn)

- **Nit:** `guardBeforeMutate` còn `window.confirm(UNREACHABLE_CONFIRM)` khi `apiUnreachable` — primary UI đã `actionsBlocked`, recovery chính là `clearUnreachable`. Confirm OK nếu gọi được vẫn không admit khi response unreachable (`decideGateConfirm`). Không blocker AC-G4.

## Findings

- **Blocker:** không.
- **Should-fix trước merge:** không.
- **Nit:** như trên.

## Limitations (known, non-blocking)

1. Reviewer không re-run unit/UAT local (thiếu `node_modules` / không spin Next) — tin CI `web` + source tại exact SHA + artifact UAT implementer.
2. UAT offline shell: disable confirm chỉ assert khi `GateForm` mount (OIDC configured) — đã ghi trong `D11-WEB-GATE-EVIDENCE.md`.
3. Không claim pilot ready / acceptance complete / merge (coordinator).

## Verdict

**PASS** (DoD) + **PASS** (security, UI Gate fail-closed scope).

Coordinator có thể merge sau khi đủ gate Project; reviewer **không** merge.
