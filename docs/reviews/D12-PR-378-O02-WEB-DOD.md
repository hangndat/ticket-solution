# DoD review — PR #378 / Issue #371 (O02 SiteNav capabilities + soft-redirect)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_49b76e69-0673-410a-8a1d-ec4079e073e4` · task `task_cd1d54aa61ee` · dispatch `ctx_c165fbc745e4` · run `run_a023a59320b4` — **≠** implementer `ctx_ae68862a8c9e` |
| Scope | PR [#378](https://github.com/hangndat/ticket-solution/pull/378) · Issue [#371](https://github.com/hangndat/ticket-solution/issues/371) · Epic [#293](https://github.com/hangndat/ticket-solution/issues/293) · ownership `apps/web` (+ `scripts/web-uat.mjs`, evidence docs) · handoff `docs/design/o02-permission-nav/` |
| Commit SHA reviewed | **`d877cb723fed7a09076bb811fc3d361389109835`** (confirmed `gh pr view 378` `headRefOid` == tip) |
| Agent | `cursor` (`orca-agent-routing`) |
| Verdict | **PASS with known gap** |

## Checks (exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Tip SHA | **PASS** | `headRefOid` = `d877cb723fed7a09076bb811fc3d361389109835` |
| Ownership slice | **PASS** | Diff = `apps/web/**` + `scripts/web-uat.mjs` + `docs/reviews/o02-web-371-nav-uat.md` — **không** đụng `apps/api` / `apps/worker` / `packages/backend` |
| Nest authz | **PASS** | Không weaken Nest: BFF `GET /api/bff/me/events` chỉ `forwardTenantBearer` + `Cache-Control: private, no-store`; chrome/guards web-only |
| Unit matrix | **PASS (CI)** | `nav-capabilities.test.ts` — guest deny-by-default, attendee, Scanner Gate-only, Owner Admin, platform operator, fail-closed parse |
| Routes soft-redirect | **PASS (CI)** | `routes.integration.mjs` — anonymous `/admin`\|`/gate` HTTP **307** → `/auth?next=` |
| CI tip | **PASS** | Actions [39118567818](https://github.com/hangndat/ticket-solution/actions/runs/39118567818) · `headSha` = tip · **web** SUCCESS · **changes** / **ci** / **turbo-persist** SUCCESS |
| Headless UAT script | **PASS (code + handoff)** | `apps/web/tests/nav-o02-uat.mjs` + `scripts/web-uat.mjs` case `nav-o02`; implementer evidence `docs/reviews/o02-web-371-nav-uat.md` + gitignored `apps/web/.uat-artifacts/o02-*.png` |
| Reviewer re-run UAT | **GAP** | Không re-run Playwright trong session này (worktree không có artifact PNG local) — tin CI unit/routes + handoff |

## Checklist O02 / contract chrome mapping (§3 · soft-redirect)

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | SiteNav **không** hardcode staff route theo variant | **PASS** | Xóa `NavVariant` / `LINKS[guest|staff|admin|platform]`; `SiteNav` load `loadNavCapabilities()` → `deriveNavCapabilities` từ MeEvents / MeTenants / PlatformMe |
| 2 | Guest chrome deny-by-default | **PASS** | `GUEST_NAV_LINKS` = redeem/claim/auth; fail/catch → guest; unit + home HTML assert không `nav-admin`/`nav-gate`/`nav-platform` |
| 3 | Soft-redirect anonymous `/admin`\|`/gate` → `/auth?next=` | **PASS** | `proxy.ts` cookie check → HTTP **307**; RSC `requireSessionOrAuth` backup |
| 4 | Soft-redirect authenticated thiếu capability → home fail-closed | **PASS (code)** | `requireAdminCapabilityOrHome` / `requireGateCapabilityOrHome` → `/?notice=admin_denied|gate_denied` + copy trên `app/page.tsx` |
| 5 | Chrome mapping khớp contract | **PASS** | Admin = `staffEligible` ∧ tenant perms ∩ `{event.create,event.list,members.manage,tenant.profile}`; Gate = `staffEligible` ∧ `gate.confirm`; Platform = `platformMe.operator` |
| 6 | Fail-closed parse / 401 | **PASS** | Invalid shape → null → deny; 401 discovery → `/auth?next=` |
| 7 | Không weaken Nest authz | **PASS** | Web-only; không đổi guards Nest |
| 8 | Headless UAT evidence (anonymous guest + soft-redirect) | **PASS with known gap** | Script + implementer shots; authenticated staff-capability path **không** UAT (cần Nest live) — đã ghi trong handoff |
| 9 | Independent reviewer ≠ implementer | **PASS** | `ctx_c165fbc745e4` ≠ `ctx_ae68862a8c9e` |

## Findings

| Severity | Finding |
| --- | --- |
| Blocker | Không |
| Should-fix | Không |
| Known gap (non-blocking) | UAT anonymous-only; authenticated `/?notice=*_denied` chưa chạy e2e (cần Nest MeEvents/MeTenants live). Phủ bằng RSC guards + unit matrix. |
| Known gap (non-blocking) | Reviewer không re-run `nav-o02-uat.mjs` / không có PNG local trong worktree DoD này. |
| Nit | Authenticated nav vẫn luôn thêm link «Đăng nhập» — pattern sẵn có; không lệch AC O02. |

## Verdict

**PASS with known gap** trên exact SHA `d877cb723fed7a09076bb811fc3d361389109835`.

Đủ DoD web #371 / PR #378 theo O02 contract: capability-driven SiteNav, guest deny-by-default, soft-redirect anonymous + authenticated (code), CI web xanh, không đụng Nest authz. Gap UAT staff-signed-in là chủ đích / documented — **không** vi phạm gate bắt buộc anonymous/guest + soft-redirect.

Coordinator **có thể merge** sau khi chấp nhận gap trên. Revalidate nếu tip có commit **hành vi** mới sau SHA này.

Không merge từ session reviewer này. Không post GitHub comment từ worker (report qua Orca mailbox).
