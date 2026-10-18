# D12 — DoD revalidation · O02 MeEvents BE (PR #377 / #369)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_3c780b10-fae5-433b-a63f-4293d6802f7f` · Task `task_1815af4e6c50` · Dispatch `ctx_46d6380f16d5` · **≠** fix implementer `ctx_db9a9857fec4` · **≠** prior FAIL reviewer `ctx_1d05397a3587` |
| Scope | PR [#377](https://github.com/hangndat/ticket-solution/pull/377) · Issue [#369](https://github.com/hangndat/ticket-solution/issues/369) · ownership BE (`apps/api`, `packages/backend`, `packages/contracts`) · revalidation sau FAIL catalog allowlist |
| Commit SHA | `71bfbeee4d87227a02ad911566029931938fedac` (exact tip `gh pr view 377` / CI run head) |
| Prior FAIL | Blocker `DEFINER_OWNER_TABLES` thiếu `event_assignments` sau policy `event_assignments_owner` — ghi trên Issue [#369](https://github.com/hangndat/ticket-solution/issues/369) (artifact path `docs/reviews/D12-PR-377-O02-BE-DOD.md` chưa có trong tree tip; evidence FAIL = comment board + CI đỏ trên tip cũ `3856824…`) |
| Architecture impact | **Có** (shared discovery contract) — đối chiếu handoff `docs/design/o02-permission-nav/be-handoff.md`; tip fix **không** đổi semantics authz |
| Merge | **Không** — reviewer không merge |

## Revalidation checklist (từ FAIL trước)

| Mục | Kết luận |
| --- | --- |
| Catalog allowlist: `event_assignments` ∈ `DEFINER_OWNER_TABLES` | **Met** — commit `71bfbee` chỉ thêm 2 dòng comment + `'event_assignments'` trong `packages/backend/test/rls-catalog.test.cjs` |
| CI `database-isolation (rls)` xanh trên SHA mới | **Met** — [run 39117611311](https://github.com/hangndat/ticket-solution/actions/runs/39117611311) `head_sha=71bfbeee4d87227a02ad911566029931938fedac` · job `database-isolation (rls, test/rls.test.cjs test/rls-catalog.test.cjs)` **success** (39s) |
| Handoff MeEvents vẫn đúng; không regressions | **Met** — xem § Handoff + § Source |
| Reviewer độc lập ≠ implementer trên exact SHA mới | **Met** — `ctx_46d6380f16d5` ≠ `ctx_db9a9857fec4` |

## CI evidence (exact SHA)

Run: https://github.com/hangndat/ticket-solution/actions/runs/39117611311  
`headSha`: `71bfbeee4d87227a02ad911566029931938fedac`

| Check | Kết luận |
| --- | --- |
| `database-isolation (rls, …)` | **pass** (blocker đóng) |
| `database-isolation (account-deletion, … platform.test.cjs …)` | **pass** (O02 discovery test trong shard này) |
| `backend` | **pass** |
| `web` / `mobile` / other DB shards / `changes` / `ci` | **pass** (d5-* skipped) |
| `turbo-persist` | pending lúc review (không phải gate RLS/catalog) |

## Root cause đã đóng (verify source)

Migration O02 thêm `CREATE POLICY event_assignments_owner ON event_assignments TO migration_owner USING (true) WITH CHECK (true)` (FORCE RLS + SECURITY DEFINER). Catalog test bắt buộc mọi bảng có `*_owner` policy nằm trong `DEFINER_OWNER_TABLES`. Tip `3856824…` thiếu allowlist → CI rls FAIL. Tip `71bfbee…` bổ sung `event_assignments` — **catalog-only**, không đụng SQL functions / Nest route / contracts.

Diff tip vs prior tip:

```text
packages/backend/test/rls-catalog.test.cjs | +2 (comment + 'event_assignments')
```

## Handoff MeEvents (be-handoff.md) — không regress

| Acceptance handoff | Tip `71bfbee…` |
| --- | --- |
| Contracts: `MeEventItem.tenantId` + `MeEventsResponse.staffEligible` | **OK** — `packages/contracts/src/index.ts` |
| `GET /v1/me/events` + OpenAPI + health path | **OK** — `@Get('me/events')`, `MeEventsDto`, `openapi.json`, health allowlist |
| Không mở rộng `GET /v1/me` / `MeResponse` | **OK** |
| `selfActor` (identity OIDC, không MFA platform) | **OK** — `PlatformService.myEvents` → `selfActor` → `listMyEvents` |
| `list_my_events` / `my_staff_eligible` SECURITY DEFINER + `app.actor_id` | **OK** — migration + `membership-invite.ts` |
| `staffEligible` = active membership **OR** active assignment | **OK** — `my_staff_eligible()` |
| Tests revoke assignment/membership + attendee deny-by-default | **OK** — `platform.test.cjs` «O02 MeEvents staffEligible + revoke fail-closed discovery»; CI account-deletion shard xanh |
| Ownership: không đụng web/mobile | **OK** — diff PR chỉ BE/contracts/OpenAPI |

## Security / authz note

- Fix tip là **catalog-only** — không đổi policy SQL semantics, không đổi `staffEligible` / actor GUC / grant `ticket_runtime`.
- **Không kế thừa mù** security PASS cũ như gate DoD; ghi nhận: hành vi authz **không** đổi giữa `3856824…` và `71bfbee…`, nên không yêu cầu re-run `reviewer-security` cho delta này.
- Prior security artifact được Issue #369 nhắc là `D12-PR-377-O02-BE-SECURITY.md` (PASS trên tip cũ); ngoài scope reval DoD này nếu file chưa có trong worktree.

## Findings

### Blocker

Không còn.

### Nit

1. Prior FAIL path `docs/reviews/D12-PR-377-O02-BE-DOD.md` chưa có trong git tip — evidence FAIL vẫn đủ qua Issue #369 + CI lịch sử tip `3856824…`. Coordinator có thể commit prior FAIL artifact riêng nếu muốn audit trail đầy đủ.

## Verdict rationale

Blocker catalog/`database-isolation (rls)` đã đóng trên exact SHA `71bfbeee4d87227a02ad911566029931938fedac` với CI rls + platform shard xanh. MeEvents handoff và discovery semantics không regress. **PASS**. Reviewer **không merge**.
