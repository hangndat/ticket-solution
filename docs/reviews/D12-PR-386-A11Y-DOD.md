# D12 — DoD review PR #386 A11y residual redeem/admin/gate (#382)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_974f2a1f-d74f-4f4c-804e-0a8a8dd2e934` · Task `task_78a7ad454f3e` · Dispatch `ctx_35b1af3e04d1` · **≠** implementer `ctx_85e30fe093bc` |
| Scope | PR [#386](https://github.com/hangndat/ticket-solution/pull/386) · Issue [#382](https://github.com/hangndat/ticket-solution/issues/382) · ownership **web** (`apps/web/**` + lockfile/`axe-core` + evidence) |
| Commit SHA | `8c5999437c03782e938c922b7b1c3f2a03442394` (exact; = PR tip / CI `headSha`) |
| Behavior SHA (a11y code) | `63f1b56df0f4926df5847edca9ae247acb105922` |
| Architecture impact | **Không** — residual UX-10 focus/live-region/hit-target + axe UAT; không đổi contract API |
| Claim WCAG AA toàn app | **Không** (PR body, UAT script, `live-region.ts` comment, evidence) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| Tip verify | `git rev-parse` / `gh pr view` → tip = `8c5999437c03782e938c922b7b1c3f2a03442394` |
| Diff vs `origin/main` | 10 files web/docs/lockfile only: `gate-form.tsx`, `redeem-form.tsx`, `globals.css`, `live-region.ts`, `surface-state.tsx`, `a11y-redeem-admin-gate-uat.mjs`, `live-region.test.ts`, `package.json`, `pnpm-lock.yaml`, `docs/reviews/d12-a11y-382.md` — **không** đụng `apps/mobile` / API |
| Unit | `pnpm --filter @ticket/web exec tsx --test tests/live-region.test.ts` trên worktree tip → **2/2 pass** |
| CI trên SHA | Run [39124583548](https://github.com/hangndat/ticket-solution/actions/runs/39124583548) · `headSha` khớp tip · `web` PASS · `backend` PASS · `mobile` PASS · `changes` PASS · `ci` PASS · `turbo-persist` PASS · database-isolation/d5-* skip (không đụng) |
| Lockfile | `axe-core@4.14.0` thêm vào `apps/web` devDependencies + `pnpm-lock.yaml` — **justified** (Playwright UAT inject `axe-core.source`) |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |

## Đối chiếu checklist #382 / UX-10 scoped

| Yêu cầu | Evidence trên SHA |
| --- | --- |
| Focus-visible | `globals.css`: mở rộng `[tabindex]:focus-visible`, `.skip-link:focus-visible`; UAT `assertFocusVisible` trên redeem submit / auth landing khi có control |
| Live region unknown/queued assertive | `liveRegionForStatus`: `unknown`\|`queued` → `role=alert` + `aria-live=assertive`; unit test pin contract; redeem/gate wire `role`/`aria-live`/`aria-atomic`; SurfaceState `error`/`unknown` assertive |
| Hit target ≥44px | CSS min 44×44 cho redeem/gate/admin primary controls + checkbox row; UAT `assertHitTarget` |
| Axe UAT (serious/critical=0) | `apps/web/tests/a11y-redeem-admin-gate-uat.mjs` — redeem + admin/gate path hoặc soft-redirect; **không** claim WCAG AA toàn app |
| Không claim WCAG AA toàn app | Explicit trong PR, UAT header, `live-region.ts`, evidence `d12-a11y-382.md` |
| LIMIT O02 admin/gate redirect | UAT ghi `LIMIT … soft-redirect → /auth (O02); staff chrome axe deferred` — **chấp nhận** theo task DoD |

## Findings

### Blocker

Không có.

### Known gap (chấp nhận — không hạ FAIL)

1. **O02 soft-redirect:** Anonymous `/admin` và `/gate` → `/auth`; axe/hit-target chạy trên landing auth, **không** cover staff chrome đầy đủ khi chưa có session. Đã ghi LIMIT trong UAT + handoff implementer — khớp checklist «Known LIMIT admin/gate redirect O02 OK».
2. **Evidence tip string lag:** `docs/reviews/d12-a11y-382.md` vẫn ghi Branch tip `580664facfb69c3c855f738b4b17c52a67e54b9b` trong khi PR HEAD = `8c59994…` (docs-only commits sau behavior). Behavior SHA `63f1b56…` vẫn đúng; không ảnh hưởng runtime. Follow-up optional: pin tip = HEAD sau khi freeze.

### Nit (không ảnh hưởng verdict)

- UAT fixture `fixture-queued` thực chất assert **pending polite** (đúng với `liveRegionForStatus('pending')`); tên testid dễ nhầm với kind `queued` (assertive). Contract unit test đã cover `queued` assertive riêng.
- Redeem status `error` đi qua `liveRegionForStatus` → polite; SurfaceState `error` vẫn assertive. AC scoped chỉ bắt buộc unknown/queued assertive — không FAIL.

## Limitations / revalidation

- Verdict chỉ pin SHA `8c5999437c03782e938c922b7b1c3f2a03442394`. Commit hành vi mới sau này → bắt buộc DoD lại.
- Reviewer **không** re-run Playwright axe local (phụ thuộc `localhost:3012`); dựa evidence handoff implementer + đọc UAT script + CI web xanh trên exact SHA.
- iOS VoiceOver / `apps/mobile` ngoài ownership PR — soft note only.
- Reviewer **không** merge; coordinator quyết định merge sau DoD + CI (jobs web/ci đã xanh trên tip).

## Verdict

**PASS with known gap** — đủ DoD a11y residual redeem/admin/gate trên exact SHA: focus/live-region/hit-target + axe UAT scoped, không claim WCAG AA toàn app; gap O02 staff-chrome-without-session được task chấp nhận sẵn.
