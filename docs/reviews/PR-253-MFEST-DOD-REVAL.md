# DoD + Security revalidation — PR #253 (Fun Fest → MFest)

| Trường | Giá trị |
| --- | --- |
| **Verdict (DoD)** | **FAIL** |
| **Verdict (Security)** | **PASS with known gap** (logic seed OK; CI lint gate chặn merge — xem blocker) |
| Reviewer / session | Cursor · Role `reviewer-dod` + `reviewer-security` · terminal `term_5a3f7b70-b574-4f12-b842-9ba10b6326d3` · task `task_8b718eb4bbdf` · dispatch `ctx_8974535f9865` · **≠** implementer |
| Scope | PR [#253](https://github.com/hangndat/ticket-solution/pull/253) · diff vs `origin/main` (`8519ba8e4f1188714ad88a6aecfaa058e55ca4d5`) · fixture/seed rename + D9 migrate + ADR-19 publish path |
| Commit SHA đã duyệt | `d8487ce9dc17ba5d02af32adc5df3764cef3ee72` |
| Architecture impact | Không (demo rebrand/compatibility) — đối chiếu ADR-19 không regress |
| Artifact trước | `/Users/admin/orca/workspaces/ticket-solution/remaining-review-253/docs/reviews/PR-253-MFEST-DOD.md` (SHA `ec0f74e…` **FAIL** conflict) — **không kế thừa verdict** |
| Ngày | 2026-10-18 |
| Revalidation tiếp | Bắt buộc sau tip mới (fix eslint `preserve-caught-error`) |

## Checklist DoD

| Tiêu chí | Kết quả |
| --- | --- |
| Exact SHA = tip PR | PASS — `head.sha` REST = `d8487ce9dc17ba5d02af32adc5df3764cef3ee72` = local `git rev-parse HEAD` |
| Conflict vs `origin/main` đã hết | PASS — `mergeable=true`; `git merge-tree` không báo conflict; base `8519ba8…` |
| ADR-19 publish path giữ sau merge main | PASS — `ensurePublishedMarketingConfig` + `publishEventConfig` + `DEMO_MARKETING.mfest`; seed loop gọi publish; skip khi đã có `published_config_version` |
| Known fixture migration không overwrite arbitrary tenant | PASS — `D9_LEGACY_TENANT_SLUGS` chỉ `demo-fun` trên UUID D9; slug lạ → throw |
| Unique collision fail-closed | PASS — pre-check `slugOwner` + catch P2002/23505 → refuse overwrite |
| PG transaction / RLS | PASS — `ensureTenant` / event / inventory / publish trong `withTenant(db, tenant.id, …)` |
| Giữ data/codes/idempotency + published config | PASS (source + test design) — stable UUID; code HMAC giữ; 2nd seed `configsSkipped`; CI job `database-isolation (published-events)` **success** trên SHA |
| Web home + events server SoT; archived không public fallback | PASS — `home-tenants` default `mfest-demo`/`demo-studio`; `events.ts` deprecated re-export; routes.integration assert unreachable + không serve fixture brand |
| Default tenant `mfest-demo` consistent web/mobile/seed | PASS |
| CI xanh trên exact SHA | **FAIL** — xem blocker #1 |
| Reviewer độc lập ≠ implementer | PASS |
| Merge / self-merge | N/A — reviewer không merge / không sửa source |

## Checklist Security (scope demo-seed / tenant slug)

| Threat / abuse case | Kết quả |
| --- | --- |
| Re-seed đổi slug arbitrary tenant cùng UUID D9 | Fail-closed — chỉ allowlist `demo-fun` |
| Đổi sang slug đã thuộc tenant khác | Fail-closed — throw `rebrand blocked` / unique |
| Tạo tenant mới khi slug đã tồn tại (race) | Fail-closed — catch unique → refuse overwrite |
| Cross-tenant write ngoài `withTenant` | Không thấy trong diff seed path |
| Secrets / authz / RLS bypass trong PR | Không đụng authn path; chỉ demo seed + fixtures |
| Dependency / lockfile supply | Không đổi lockfile trong scope review |

## Findings

### Blocker

1. **CI `backend` FAIL trên exact SHA `d8487ce…`** — ESLint `preserve-caught-error` tại `packages/backend/src/demo-seed.ts` L345 và L377: `throw new Error(...)` trong `catch` không gắn `{ cause: err }`.
   - Evidence: [Actions run 39092001820](https://github.com/hangndat/ticket-solution/actions/runs/39092001820) · job backend · annotations trên `demo-seed.ts`.
   - Aggregate check `ci` = **failure**; web/mobile/database-isolation (published-events, rls, …) = success.
   - Coordinator đã xác nhận root cause và giao backend fix worker — tip mới cần DoD revalidation; **không** PASS SHA này.

### Should-fix / limitation (không blocker logic)

2. **Không alias URL/deeplink demo cũ** — `/t/sunburst/…`, `/t/demo-fun/…`, `DEMO-FUN-*`, deeplink `demo-fun-fest` không redirect. Chấp nhận **demo-only**; bookmark/QR cũ 404 / miss catalog. Ghi release note nếu còn allowlist/DNS cũ.
3. **Allowlist example** `infra/platform/tenant-host-allowlist.example.json` đổi `sunburst`→`mfest` — chỉ example; prod DNS/allowlist ngoài PR.

### Nit

4. Graph MCP `detect_changes_tool` gắn nhầm worktree/SHA khác (`e8512d0…` / SideProject) → risk score nhiễu; verdict dựa source + CI REST, không graph.
5. Local `pnpm --filter @ticket/backend exec eslint` thiếu binary trong worktree (chưa `install`); dùng CI annotations làm evidence lint.

## Diff review (tóm tắt vs `origin/main`)

- Backend: rename `fun`/`funFest`/`demo-fun` → `mfest`/`mfest-demo`; legacy migrate allowlist; unique fail-closed; ADR-19 publish giữ; test mới `demo-seed-rebrand.test.cjs` (migrate / collision / unknown slug).
- Web: home defaults + fixtures archived → MFest; routes assert old+new fixture paths fail-closed khi Nest down.
- Mobile: `DEMO_PUBLISHED_TENANTS` / demo catalog / links → `mfest-demo`; published-first không thêm fixture fallback.
- Docs/scripts/brand/allowlist example đồng bộ.

## Checks / evidence trên SHA `d8487ce9dc17ba5d02af32adc5df3764cef3ee72`

```text
git rev-parse HEAD
→ d8487ce9dc17ba5d02af32adc5df3764cef3ee72

gh api repos/hangndat/ticket-solution/pulls/253
→ head.sha = d8487ce9… · base = 8519ba8… · mergeable=true · mergeable_state=unstable

CI run https://github.com/hangndat/ticket-solution/actions/runs/39092001820
→ backend FAILURE (preserve-caught-error L345/L377)
→ web SUCCESS · mobile SUCCESS · database-isolation (published-events, rls, …) SUCCESS
→ aggregate ci FAILURE

Source review: packages/backend/src/demo-seed.ts (ensureTenant + ensurePublishedMarketingConfig)
+ packages/backend/test/demo-seed-rebrand.test.cjs
+ apps/web/src/published/home-tenants.ts
+ apps/web/tests/routes.integration.mjs
+ apps/mobile/src/published/events-home.ts
+ docs/ops/ADR-19-EVENT-SERVER-SOURCE.md
```

Không chạy full monorepo / shared DB / EAS / GUI. Không sửa source / commit / push / merge.

## Verdict

**FAIL** trên exact SHA `d8487ce9dc17ba5d02af32adc5df3764cef3ee72`.

Logic rebrand + ADR-19 coexistence + tenant fail-closed **ổn trên source**, nhưng **DoD gate CI xanh không đạt** (eslint). Coordinator không merge SHA này; sau tip fix → spawn DoD/security revalidation mới (không kế thừa FAIL/PASS của artifact này ngoài danh sách findings còn mở).
