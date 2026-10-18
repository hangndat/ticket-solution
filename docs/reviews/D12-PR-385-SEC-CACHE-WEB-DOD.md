# DoD — PR #385 SEC-CACHE web (SiteNav clear on MEMBERSHIP 401/403)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_329eb786-bf82-41af-bfe6-9300716946f1` · Task `task_a8240aa29a84` · Dispatch `ctx_7bd8558542af` · **≠** implementer `ctx_a4e0bd2996c1` |
| Scope | PR [#385](https://github.com/hangndat/ticket-solution/pull/385) · Related [#380](https://github.com/hangndat/ticket-solution/issues/380) · ownership **`apps/web` only** · clear SiteNav capabilities on `MEMBERSHIP_*` / `PERMISSION_DENIED` 401/403 |
| Commit SHA | `c4a529159daff967b4a2660d93999cf68b99eb9e` (exact; = PR `headRefOid`) |
| Architecture impact | Không (client chrome cache / fail-closed UX; không đổi Nest authz) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| Tip verify | `gh pr view 385 --json headRefOid` → `c4a529159daff967b4a2660d93999cf68b99eb9e` |
| Diff scope | 6 files, toàn `apps/web/**` — **không** đụng `apps/api`, `apps/worker`, `packages/backend` (Nest không bị weaken) |
| CI trên SHA | Run [39123699215](https://github.com/hangndat/ticket-solution/actions/runs/39123699215) **success** — `changes` + `web` + `ci` + `turbo-persist` PASS; backend/mobile/database-isolation/d5-* SKIPPED (đúng web-only) |
| Local `nav-sec-cache.test.ts` | Chạy trên detached tip: **8/8 pass** (isMembershipAuthzDenial, reset, handleAuthzDenial, late-refresh abort, fetchJson observer, discovery URL exclude, singleton helper) |
| Local full `pnpm --filter @ticket/web test` | Không dùng làm gate: worktree thiếu `@ticket/contracts` dist — **CI web PASS** là authority |
| Graph `detect_changes_tool` | Graph MCP trỏ workspace SideProject/stale; ưu tiên source + `git show` tip — không dựa risk score nhiễu |

## Checklist DoD

| Mục | Kết quả |
| --- | --- |
| Fail-closed SiteNav | **PASS** — `refresh()` / `reset()` / soft-clear khi đang refresh đều publish guest caps trước khi (re)load; `requestId` chặn late discovery restore sau revoke |
| MEMBERSHIP / PERMISSION_DENIED | **PASS** — `isMembershipAuthzDenial`: mọi **401**; **403** chỉ khi `code` bắt đầu `MEMBERSHIP_` hoặc `PERMISSION_DENIED`; 403 khác (vd. `SLUG_TAKEN`) không clear |
| Discovery không false-positive | **PASS** — observer bỏ qua `/api/bff/me/events`, `/api/bff/me/tenants`, `/api/bff/platform/me` (401 guest bình thường) |
| fetchJson hook an toàn | **PASS** — `publishResult` bọc try/catch từng observer; timeout/network không gọi clear; `cache: 'no-store'` giữ nguyên |
| Revalidate session | **PASS** — SiteNav bind observer + refresh mount; `visibilitychange` + bfcache `pageshow` (`event.persisted`) |
| Tests | **PASS** — unit cover denial matcher, sticky clear, non-membership ignore, late refresh, observer publish, discovery exclude |
| Không weaken Nest | **PASS** — không đổi API/RLS/membership guards; chỉ chrome client |

## Findings

### Blocker

Không có.

### Known gap (không hạ FAIL)

1. **Admin tenant selector mount-once** có thể còn stale đến khi reload trang — ngoài `navCapabilitiesStore` / SiteNav (đã ghi trong PR body). Không để SiteNav Admin/Cổng/Platform sticky sau MEMBERSHIP revoke; follow-up riêng nếu cần clear selector state.
2. **Mọi 401 non-discovery** qua `fetchJson` clear chrome (fail-closed rộng hơn chỉ `MEMBERSHIP_*`) — đúng hướng SEC-CACHE; có thể nhấp nháy guest rồi restore nếu session vẫn hợp lệ sau lỗi tạm — chấp nhận được.

## Merge note

**Coordinator may merge** sau board process khi CI vẫn xanh trên tip. Reviewer **không** merge và **không** comment GitHub (theo dispatch).
