# DoD — PR #350 (CI shard account-deletion)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca terminal `term_7e2a6c52-f65b-41d6-9dc6-7dca2448ef7d` · task `task_a924c2bb513a` · dispatch `ctx_e76d50724a85` · **≠** implementer / coordinator root `codex_e4d5db07_a531_4587_a319_3f80d3ac690a` |
| Scope | Coordinator-owned · PR [#350](https://github.com/hangndat/ticket-solution/pull/350) · path `.github/workflows/ci.yml` (+2 dòng matrix) |
| Architecture impact | **Không** — chỉ wiring CI; không đổi runtime/API/contracts |
| Commit SHA (exact) | `0b0f49430394365138164c549a648c1e44297cd7` |
| Worktree | `/Users/admin/orca/workspaces/ticket-solution/d13-coord-release` · tip = reviewed SHA |
| Ngày review | 2026-10-18 |
| Verdict | **PASS** |

Artifact reviewer (untracked). Giữ nguyên untracked `docs/reviews/D13-PR304-DOD.md` — ngoài scope. Không merge / không đổi Project / không deploy.

---

## Diff đã duyệt

```diff
+          - shard: account-deletion
+            files: test/platform.test.cjs test/account-session-revoke.test.cjs
```

- `git show 0b0f494… --stat` → 1 file, +2 dòng.
- Suite tồn tại: `packages/backend/test/platform.test.cjs`, `packages/backend/test/account-session-revoke.test.cjs`.

---

## Checklist DoD

| Hạng mục | Kết quả |
| -------- | ------- |
| Tên suite trong matrix khớp file có sẵn | **PASS** |
| Harness cô lập (tên container + port động) | **PASS** — `ticket-platform-<rand>` / `ticket-d13-sess-rev-<rand>`; `-p 127.0.0.1::5432` rồi `docker port` |
| Matrix chạy shard `account-deletion` | **PASS** — job riêng trên run dưới |
| Aggregate job `ci` gồm `database-isolation` | **PASS** — `needs` + log `job database-isolation=success` |
| Label `ci:docker` bật Docker jobs | **PASS** — PR có label; changes log `force_docker=ci:docker label`, `db=true hardening=true` |
| CI xanh trên exact SHA | **PASS** — run [`39110182797`](https://github.com/hangndat/ticket-solution/actions/runs/39110182797) · `headSha=0b0f494…` · conclusion `success` (kể cả `turbo-persist` + `ci`) |
| Không chạy lại DB test local thừa | **PASS** — dùng log suite GitHub (xem dưới) |
| Architecture impact | **Không** — đúng scope CI |

---

## Checks (exact SHA `0b0f49430394365138164c549a648c1e44297cd7`)

```text
git rev-parse HEAD
# → 0b0f49430394365138164c549a648c1e44297cd7

gh pr view 350 → headRefOid = 0b0f49430394365138164c549a648c1e44297cd7
labels: [ci:docker]

Run 39110182797 (headSha khớp):
  database-isolation (account-deletion, test/platform.test.cjs test/account-session-revoke.test.cjs) → success
  job log:
    node --test … test/platform.test.cjs test/account-session-revoke.test.cjs
    ✔ SEC-1: anonymize revokes staff sessions; …
    ✔ platform provision/invite/suspend/support/deletion acceptance
    ℹ tests 2 · pass 2 · fail 0 · duration_ms ~6221
  changes: force_docker=ci:docker label · scope … db=true hardening=true
  ci aggregate: database-isolation=success · CI scopes OK (db=true)
  turbo-persist: success
```

CRG: `list_graph_stats_tool` OK; `detect_changes_tool` trên `.github/workflows/ci.yml` (risk noise do graph build SHA lệch worktree) → **source + `gh` CI logs thắng**.

---

## Findings

- Không blocker / should-fix trong scope +2 dòng matrix.
- Nit (không FAIL): CRG `detect_changes` gợi ý symbol account UI — nhiễu; diff YAML không đụng runtime.
- Limitation: không re-run Docker suite local (đủ evidence job GitHub trên exact SHA). Không review lại logic nghiệp vụ trong hai file test (đã có; PR chỉ wire CI).

---

## Verdict

**PASS**

Revalidate nếu tip PR #350 đổi sau `0b0f49430394365138164c549a648c1e44297cd7`. Coordinator quyết định merge/Project sau gate này; reviewer không merge.
