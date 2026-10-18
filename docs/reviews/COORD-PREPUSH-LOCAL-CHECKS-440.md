# DoD review — PR #440 (pre-push local checks)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_4ce5c098-eeee-475e-a4c1-b0ae283498f3` · task `task_a6943c709e91` · dispatch `ctx_842efcad8625` (≠ implementer dispatch `ctx_110590f25ee0`) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` |
| Scope | PR [#440](https://github.com/hangndat/ticket-solution/pull/440) · tooling / coordinator · `.githooks/pre-push`, `scripts/pre-push-check.sh`, `scripts/hooks-install.sh`, root `package.json`, `README.md` |
| Commit SHA reviewed | `aadcfc4f35183e0a7f7e4c927701c9bf8189b13d` (confirmed `git rev-parse` + `gh pr view 440 --json headRefOid`) |
| Architecture impact | Không |
| Checks | CI run [39133226527](https://github.com/hangndat/ticket-solution/actions/runs/39133226527) on tip: **changes** SUCCESS · **web** SUCCESS · **mobile** SUCCESS · **backend** SUCCESS · **ci** SUCCESS · **turbo-persist** SUCCESS · **database-isolation** SKIPPED · d5-* SKIPPED. Local: `PREPUSH_DRY_RUN=1` smoke for docs-only / web / mobile / backend scopes; `SKIP_PREPUSH=1` escape; path/command parity vs `.github/workflows/ci.yml`. |
| Verdict | **PASS** |

## Checklist

| # | Gate | Result |
| --- | --- | --- |
| 1 | Path filters khớp tinh thần CI web/mobile/backend; **không** chạy database-isolation/Docker trên pre-push | **PASS** — `path_is_web|mobile|backend` mirrors `ci.yml` filters; no `db`/`hardening` scopes; only log mentions `database-isolation` (skip by design) |
| 2 | Commands parity với `ci.yml` (typegen + turbo lint/typecheck/test/build + test:routes; mobile turbo; backend turbo + openapi drift) | **PASS** — exact same command strings as web/mobile/backend jobs |
| 3 | Docs-only skip; escape hatch documented; hooks:install / core.hooksPath rõ | **PASS** — docs/tooling-only → exit 0; README + script document `SKIP_PREPUSH` / `TICKET_SKIP_PREPUSH`; `pnpm hooks:install` → `core.hooksPath=.githooks` |
| 4 | Không secrets; ownership coordinator-only | **PASS** — shell/docs/package scripts only; no credentials; root tooling ownership |
| 5 | CI trên SHA tip xanh (web/mobile/backend; db skipped OK) | **PASS** — see Checks above |
| 6–8 | Artifact + PR comment + commit trên branch review | This file · comment on #440 · branch `hangndat/coord-prepush-dod-440` |

## Findings

- Scope đúng: 5 files, +224/−1; thin `.githooks/pre-push` delegates to `scripts/pre-push-check.sh`.
- Path globs (`apps/web/*` etc.) match nested paths under bash `case` (same intent as CI `**`).
- Explicitly leaves Docker Postgres / `database-isolation` / d5 drills to remote CI — matches AC.
- Escape hatch and dry-run (`PREPUSH_DRY_RUN=1`) verified locally.
- Nit (non-blocking): `run_cmd` uses `eval` on hardcoded command strings only — acceptable for this hook.

## Limitations

- Review did not execute full turbo lint/test/build locally (CI on tip already green for web/mobile/backend).
- CRG incremental build in this worktree stayed on an older graph SHA; review based on full source diff + CI + dry-run smoke.

## Merge note

**Coordinator may merge PR #440** after board process. Reviewer did **not** merge.
