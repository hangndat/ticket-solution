# DoD + Security revalidation — PR #588 (post–merge `main`, lockfile)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | James · `reviewer-dod` + `reviewer-security` · Persona James · `task_5e48322fdef4` / `ctx_8288b85e0223` |
| Implementer (≠ reviewer) | Higo (merge `main` + lockfile resolve) |
| Prior artifact | [`PORTAL-PRO-PR588-DOD-2026-10-20.md`](./PORTAL-PRO-PR588-DOD-2026-10-20.md) @ `d926669` |
| Scope | PR [#588](https://github.com/hangndat/ticket-solution/pull/588) · `hangndat/d1-portal-pro` |
| Commit SHA (exact) | `92f06a694f4dee16b2d354b9b4f8ab167a2ac4ed` (`git rev-parse HEAD` on review worktree) |
| Architecture | **Có** — [`ADR-PORTAL-PRO-COMPONENTS.md`](../architecture/ADR-PORTAL-PRO-COMPONENTS.md) |
| Verdict (DoD) | **PASS** |
| Verdict (security) | **PASS** |

## Revalidation gates (coordinator AC)

| Gate | Kết quả |
| --- | --- |
| Conflict chỉ lockfile đã hết | **PASS** — `gh pr view 588` → `mergeable: MERGEABLE`; tip sau merge `main` + `pnpm-lock.yaml` resolve (`92f06a6`). |
| Diff vs `main` chỉ portal + docs + lockfile | **PASS** — `git diff origin/main...HEAD --name-only`: `apps/portal/**`, `docs/**`, `pnpm-lock.yaml` only; **0** lines under `apps/web`, `apps/mobile`, `apps/api`, `packages/*`. |
| `@ant-design/pro-components@3.1.15-7` exact pin | **PASS** — `apps/portal/package.json` |
| Không Umi / `@umijs` | **PASS** — 0 matches trong `apps/portal` |
| OIDC/BFF không nới | **PASS** — `git diff origin/main...HEAD` **empty** cho `apps/portal/app/api/auth/**`, `src/oidc/**`, `src/session/**` |
| CI trên SHA mới | **PASS** — `./scripts/gh-dod-evidence.sh 588` @ `92f06a6`: `ci`, `portal`, `backend`, `web`, `mobile`, `changes`, `turbo-persist` **success** (d5/database-isolation skipped per scope). Run: https://github.com/hangndat/ticket-solution/actions/runs/39353570665 |

## Delta vs prior DoD (`d926669`)

| Item | Prior | Reval |
| --- | --- | --- |
| Branch diff hygiene | **Known gap** — MPR BE/contracts on branch | **Closed** — BE/contracts no longer in PR diff after merge `main`. |
| `turbo-persist` | Lagging while aggregate green | **Green** on `92f06a6`. |
| Portal AC (#583 #584) / ADR stack | PASS (logic unchanged) | **Inherited PASS** — portal file set unchanged in intent; only lockfile merge + docs/review artifacts on branch. |

## Security (unchanged blast radius)

Auth/session routes, OIDC, session modules: no diff vs `main`. Supply chain: exact Pro pin + lockfile-only infra delta outside portal sources. No new client-side permission grants in diff scope. **Security verdict: PASS** (no fix-before-merge items).

## Checks (exact SHA)

```text
git rev-parse HEAD
→ 92f06a694f4dee16b2d354b9b4f8ab167a2ac4ed

gh pr view 588 --json mergeable,headRefOid
→ mergeable=MERGEABLE headRefOid=92f06a694f4dee16b2d354b9b4f8ab167a2ac4ed

./scripts/gh-dod-evidence.sh 588
→ head.sha=92f06a694f4dee16b2d354b9b4f8ab167a2ac4ed mergeable=true
→ ci success; portal success; backend success; web success; mobile success; changes success; turbo-persist success
```

## Verdict

**DoD: PASS** · **Security: PASS** on exact SHA `92f06a694f4dee16b2d354b9b4f8ab167a2ac4ed`.

Prior **PASS with known gap** (MPR cross-branch diff, `turbo-persist` lag) is **closed** on this tip; PR is merge-ready from Orca DoD perspective pending coordinator merge policy.
