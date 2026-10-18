# DoD + Security final revalidation — PR #253 (Fun Fest → MFest)

| Trường | Giá trị |
| --- | --- |
| **Verdict (DoD)** | **PASS** |
| **Verdict (Security)** | **PASS** |
| Reviewer / session | Cursor · Role `reviewer-dod` + `reviewer-security` · terminal `term_04f989d7-ec47-4b76-9557-0e17aec9b5da` · task `task_c43d96140ea8` · dispatch `ctx_616f01f87c05` · **≠** implementer |
| Scope | PR [#253](https://github.com/hangndat/ticket-solution/pull/253) · branch `hangndat/rename-funfest-to-mfest` · diff vs `origin/main` (`8519ba8e4f1188714ad88a6aecfaa058e55ca4d5`) · fixture/seed rename + D9 migrate + ADR-19 publish path |
| Commit SHA đã duyệt | `56a19dea29526ed0335cf3c833eefe8e4ba1d193` |
| Architecture impact | Không (revalidation thay đổi đã thiết kế) — đối chiếu ADR-19 / tenant fail-closed không regress |
| Artifact trước | `/Users/admin/orca/workspaces/ticket-solution/remaining-review-253-reval/docs/reviews/PR-253-MFEST-DOD-REVAL.md` (SHA `d8487ce…` **FAIL** lint `preserve-caught-error`) — **không kế thừa verdict** |
| Ngày | 2026-10-18 |

## Delta so với tip `d8487ce…`

Commit `56a19de…` chỉ thêm `{ cause: err }` tại hai `catch` unique-violation trong `packages/backend/src/demo-seed.ts` (`ensureTenant` rebrand update L345–348 và create L377–381). Không đổi logic fail-closed / ADR-19 / consumer published-first.

## Checklist DoD

| Tiêu chí | Kết quả |
| --- | --- |
| Exact SHA = tip PR | PASS — REST `pulls/253` `head.sha` = `56a19dea29526ed0335cf3c833eefe8e4ba1d193` = local detached `git rev-parse HEAD` |
| Conflict vs `origin/main` | PASS — `mergeable=true`, `mergeable_state=clean` |
| Lint blocker trước đã đóng | PASS — `{ cause: err }` gắn đúng hai catch; CI job `backend` **success**, annotations `[]` |
| ADR-19 publish path | PASS — `ensurePublishedMarketingConfig` → `saveEventConfigVersion` + `publishEventConfig`; skip khi đã có `published_config_version`; seed loop gọi trong `withTenant` |
| Known fixture migration không overwrite arbitrary tenant | PASS — `D9_LEGACY_TENANT_SLUGS` chỉ `demo-fun` trên UUID D9; slug lạ → throw |
| Unique collision fail-closed | PASS — pre-check `slugOwner` + catch P2002/23505 → refuse overwrite (giữ message + `cause`) |
| PG transaction / RLS | PASS — tenant/event/inventory/publish trong `withTenant(db, tenant.id, …)` |
| Giữ data/codes/idempotency + published config | PASS (source + `demo-seed-rebrand.test.cjs` design) — stable UUID; code HMAC giữ; 2nd seed `configsSkipped`; CI `database-isolation (published-events)` **success** |
| Web home + events server SoT; archived không public fallback | PASS — `home-tenants` default `mfest-demo`/`demo-studio`; `routes.integration` assert old+new fixture paths fail-closed |
| Default tenant `mfest-demo` consistent web/mobile/seed | PASS — `DEMO_PUBLISHED_TENANTS` / `DEFAULT_HOME_TENANT_SLUGS` / `D9_DEMO.tenants.mfest.slug` |
| CI xanh trên exact SHA | PASS — xem evidence |
| Reviewer độc lập ≠ implementer | PASS |
| Full local native iOS build | N/A / waived — Task236 riêng; spec không yêu cầu |
| Merge / self-merge | N/A — reviewer không merge / không sửa feature source |

## Checklist Security (scope demo-seed / tenant slug)

| Threat / abuse case | Kết quả |
| --- | --- |
| Re-seed đổi slug arbitrary tenant cùng UUID D9 | Fail-closed — chỉ allowlist `demo-fun` |
| Đổi sang slug đã thuộc tenant khác | Fail-closed — throw `rebrand blocked` / unique |
| Tạo tenant mới khi slug đã tồn tại (race) | Fail-closed — catch unique → refuse overwrite (+ `cause` không đổi semantics) |
| Cross-tenant write ngoài `withTenant` | Không thấy trong seed path |
| CSRF / authn / session regression | Không đụng auth/csrf/guard/middleware trong diff PR |
| Secrets / RLS bypass trong PR | Không đụng authn path; chỉ demo seed + fixtures + docs/scripts |
| Dependency / lockfile supply | Không đổi root lockfile trong scope review |

## Findings

### Blocker

Không còn. Blocker lint `preserve-caught-error` trên `d8487ce…` đã được đóng bởi `56a19de…` và xác nhận CI.

### Known gap (không chặn PASS — demo-only, khớp prior)

1. **Không alias URL/deeplink demo cũ** — `/t/sunburst/…`, `/t/demo-fun/…`, `DEMO-FUN-*`, deeplink cũ không redirect. Bookmark/QR cũ 404 / miss catalog. Chấp nhận demo rebrand.
2. **Allowlist example** `infra/platform/tenant-host-allowlist.example.json` đổi `sunburst`→`mfest` — chỉ example; prod DNS/allowlist ngoài PR.

### Nit / limitation evidence

3. Graph MCP `detect_changes_tool` gắn nhầm worktree/SHA (`e8512d0…`) → risk score nhiễu; verdict dựa source + CI REST check-runs, không graph.
4. Không chạy full monorepo local / shared DB / EAS / GUI / native archive (Task236).

## Checks / evidence trên SHA `56a19dea29526ed0335cf3c833eefe8e4ba1d193`

```text
git checkout --detach 56a19dea29526ed0335cf3c833eefe8e4ba1d193
git rev-parse HEAD
→ 56a19dea29526ed0335cf3c833eefe8e4ba1d193

gh api repos/hangndat/ticket-solution/pulls/253
→ head.sha = 56a19dea… · base = 8519ba8… · mergeable=true · mergeable_state=clean

CI run https://github.com/hangndat/ticket-solution/actions/runs/39092226092
→ head_sha = 56a19dea… · conclusion = success
→ ALL check-runs success (16/16), gồm:
   backend, web, mobile, ci, turbo-persist,
   database-isolation (published-events, rls, issue-gate, membership-report,
     branding, n1-email, approval-config-lifecycle),
   d5-drills, d5-observability, d5-rint, changes
→ backend annotations = [] (không còn preserve-caught-error)

Source review:
  packages/backend/src/demo-seed.ts (cause fix + ensureTenant + ensurePublishedMarketingConfig)
  packages/backend/test/demo-seed-rebrand.test.cjs
  apps/web/src/published/home-tenants.ts
  apps/web/tests/routes.integration.mjs
  apps/mobile/src/published/events-home.ts
```

Không sửa feature source / không commit / không push / không merge / không deploy / không cloud build / không store.

## Verdict

**PASS** (DoD) và **PASS** (Security) trên exact SHA `56a19dea29526ed0335cf3c833eefe8e4ba1d193`.

Coordinator có thể merge khi được ủy quyền integration; tip mới sau review này → bắt buộc revalidation SHA mới.
