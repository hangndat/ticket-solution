# DoD review — PR #533 / Issue #531 (UX-UI Phase 2 web)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_7f93e909-e5c4-4ca0-bbe3-d51f5fcaefb2` · task `task_59108b19dc6c` · dispatch `ctx_411d899721fb` · run `run_49b7e3a43465` — **≠** implementer session |
| Scope | PR [#533](https://github.com/hangndat/ticket-solution/pull/533) · Issue [#531](https://github.com/hangndat/ticket-solution/issues/531) · Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) · ownership `apps/web` only · handoff `docs/design/ux-ui-revamp/phase-2/` |
| Commit SHA reviewed | **`d05a4b69131b518dad2c3236e77261574e180c51`** (`gh pr view 533` `headRefOid` == tip; confirmed `git rev-parse`) |
| Agent | `cursor` (`orca-agent-routing`) · Cost tier: `standard` |
| Architecture impact | Không (Issue/PR) — không gate Architect |
| Verdict | **PASS with known gap** |

## Checks (exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Tip SHA | **PASS** | `headRefOid` = `d05a4b69131b518dad2c3236e77261574e180c51` |
| Ownership slice | **PASS** | Diff = 10 files under `apps/web/**` only — không portal / BE / mobile |
| CI tip | **PASS** | Actions [39196190972](https://github.com/hangndat/ticket-solution/actions/runs/39196190972) · `headSha` = tip · **web** SUCCESS (`lint`/`typecheck`/`test`/`build` turbo + `test:routes`) · **changes** / **ci** / **turbo-persist** SUCCESS |
| Local re-run lint/test | **GAP** | Worktree không có `node_modules` (`eslint`/`next`/`tsx` missing) — không cài lại trong session DoD; tin CI trên exact SHA |
| Headless UAT | **GAP** | PR ghi deferred (cần stack local); reviewer không chạy `scripts/web-uat.sh` — không có PNG trong worktree |
| CRG `detect_changes` | **PASS (review aid)** | Risk ~0.55; changed: account/claim/event/home + `live-region` + CSS; test gaps UI components (không blocker khi CI xanh + AC code review) |
| Independent reviewer ≠ implementer | **PASS** | Dispatch `ctx_411d899721fb` riêng |

## Checklist AC / UI (phase-2 handoff)

| ID | Criterion | Result | Notes |
| --- | --- | --- | --- |
| AC-E1 | Event ready → one composition: media plane + H1 + ≤1 support + CTA group; no card cluster | **PASS** | `event-hero-bleed` full-bleed banner + `event-hero-copy` H1 + `hero-support` + `hero-cta` (Đổi mã / Nhận lời mời / Chi tiết) |
| AC-E2 | not-found / unreachable → plain VI + safe exit; no demo | **PASS (nit)** | Unreachable/invalid → `SurfaceState` + «Về trang chủ»; not-found → `notFound()` → `app/not-found.tsx` (plain VI, không demo). Copy PD «Sự kiện không khả dụng» không dùng nguyên văn — xem gap |
| AC-E3 | CTA Đổi mã mang `tenantSlug`+`eventSlug` | **PASS** | `/redeem?tenantSlug=…&eventSlug=…` |
| AC-A1 | Signed-out → login `return=/account` | **PASS** | `loginHref('/account')` → `/api/auth/login?return=…` |
| AC-A2 | Signed-in → logout visible; deletion + privacy; Live Pulse visual | **PASS** | Session hierarchy + signal CTA; deletion section; privacy link; CSS account-* Live Pulse |
| AC-C1 | Thiếu phiên → auth CTA + intent giữ qua login-return | **PASS** | 401/403 → `kind: 'auth'` + CTA `return=/claim`; `parkGuestClaimIntent` trước/mutate |
| AC-C2 | Issued/pending/denied outcomes đúng | **PASS (code)** | pending copy «Chưa phải vé»; denied/expired via `messageForDecision` + error chrome; issued clears intent |
| AC-C3 | Logout / đổi phiên → xoá parked claim intent | **PASS** | `clearGuestClaimIntent` on logout click + when signed-in → signed-out transition |
| AC-H1 | Home first viewport: wordmark + Live Pulse signal | **PASS** | `HeroWordmark` + `home-cta-primary` signal `#E11D48` / Sora on h1 |
| AC-V1 | Tokens ink/paper/signal/focus + Sora / Be Vietnam Pro; no Syne/v1 | **PASS** | `:root` Live Pulse; no Syne/terracotta in touched surfaces |
| A11y basics | focus / hit≥44 / live region / reduced-motion | **PASS (code)** | `:focus-visible` focus ring; CTA min-height 44; `liveRegionForStatus` assertive for error/denied/expired/auth; unit test updated; new animations listed under `prefers-reduced-motion` |
| No portal/BE/mobile | Scope | **PASS** | Diff web-only |

## Findings

| Severity | Finding |
| --- | --- |
| Blocker | Không |
| Should-fix | Không |
| Known gap (non-blocking) | Headless UAT screenshot `/` `/account` `/claim` + event detail **chưa** chạy trên SHA này (implementer + reviewer). AC visual/states đã đối chiếu source; CI unit/routes xanh. |
| Known gap (non-blocking) | Reviewer không re-run `pnpm --filter @ticket/web` local (thiếu `node_modules`) — thay bằng CI web job trên exact SHA. |
| Known gap (non-blocking) | Event `not-found` dùng generic `app/not-found.tsx` thay copy PD «Sự kiện không khả dụng» — vẫn plain VI + thoát an toàn, không demo. |
| Nit | CRG: chưa có unit test riêng cho `SessionPanel` clear-intent / claim 401 path — phủ bằng code review + `live-region.test.ts` + CI. |

## Verdict

**PASS with known gap** trên exact SHA `d05a4b69131b518dad2c3236e77261574e180c51`.

Đủ DoD Task web #531 / PR #533 theo AC Phase 2 + Live Pulse tokens + a11y basics trong scope `apps/web`; CI web xanh trên tip. Gap UAT headless + untested UI paths là documented / không nuốt gate acceptance bắt buộc của Issue (implementer đã ghi deferred UAT khi thiếu stack).

Coordinator **có thể merge** sau khi chấp nhận gap UAT (hoặc chạy UAT headless trước merge nếu muốn siết gate Epic). Revalidate nếu tip có commit **hành vi** mới sau SHA này.

Không merge từ session reviewer này. Không post GitHub comment từ worker (report qua Orca mailbox).
