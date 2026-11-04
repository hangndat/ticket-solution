# PR #1176 — backend integration revalidation (DoD + Security)

- Reviewer: James, `reviewer-merged`, session `7168404a-911f-4e1d-b65a-bd70a9be3d4a`; independent of Minh's implementation and Gonic's integration dispatch `ctx_5188ac41a637`.
- Exact HEAD: `10babcc8d808e183c2867b8e2398d56cc95d5d27`; PR base: `9993d354ef1e2dda8835175ceee24e5b28389466`; current main checked: `fa96e7db`. Scope: `packages/backend/package.json`, `src/{import-csv,import-jobs,outbox-fence,outbox}.ts`, `test/import-csv.test.cjs` (all under `packages/backend`). UI: N/A.
- Architecture impact: **Có** — CSV parsing and fenced outbox persistence are new internal module boundaries. Compared with `docs/TECHNICAL-DESIGN.md` §11, ADR-12/17, and the two independent root reports `GOD-CLASS-BACKEND-{IMPORT,OUTBOX}-2026-11-03.md` at SHAs `1175c090` and `29c43b35`; their PASS verdicts were treated as baseline evidence, not inherited.

## Verdict

- **DoD review: PASS on this SHA.** The six-file diff implements two extractions without observed contract change. **PR completion remains pending** coordinator confirmation of CI on the integrated SHA and merge/main integration.
- **Security: PASS on this SHA.** No new tenant, RLS, sensitive CSV, lease-fence, or provider-delivery regression found in the changed scope.

## Checks and reasoning

- `git rev-parse HEAD`, `git diff --name-only/--stat base..HEAD`, full six-file diff, and `git diff --check base..HEAD`: correct SHA/scope; diff check clean. `git diff base..main -- packages/backend` returns only `test/worker-db-cancel.test.cjs`; no intervening production backend path. This test still needs the coordinator's normal integrated CI gate.
- CRG `list_graph_stats_tool` was empty for this exact worktree; built locally with minimal postprocessing, then verified `head_matches_build: true` at `10babcc8` (1,621 indexed files). `detect_changes_tool(base=9993d354...)` found six files/18 changed symbols, risk 0.75 and 18 test gaps; its `TESTED_BY` resolution misses CJS tests of `dist`, so these are graph coverage hints rather than proof of absent tests. `importers_of(outbox-fence.ts)` found one importer, `outbox.ts`.
- Import extraction: `import-jobs.ts` removes the parser block and imports `assertUtf8Csv`, `normalizeMapping`, `parsePayload`, and `ValidParsedRow`; the remaining upload/create/preview/commit call sites retain `withTenant`, permission check, event lock, tenant row cap, event quota, and idempotency/stale-preview checks. New `import-csv.ts` retains UTF-16 BOM and malformed UTF-8 rejection, quoted CSV parsing, kind-specific mapping, canonicalized duplicate detection, max-row check, and error CSV masking. The new four CJS tests assert these boundaries, including no raw duplicate email/code in the report.
- Outbox extraction: six fenced persistence helpers move to `outbox-fence.ts`; `outbox.ts` is their only runtime importer, while its reciprocal `ClaimedOutboxRow` import is type-only. SQL statements retain `tenant_id` filters and parameterized raw templates; lease ownership/token/expiry checks guard processing, completion, dead marking, retry and push acknowledgments. `appendAttempt` keeps `(tenant_id, notification_id, ordinal)` conflict handling; retry increments ordinal only after a provider attempt. Email and APNs provider I/O remain outside tenant transactions, with subsequent fenced ack. `ACCEPTED` remains the provider acceptance state, not `DELIVERED`; at-least-once crash window and documented ADR-12 limitation remain unchanged.
- Worker-reported same-SHA evidence reused: backend unit 61/61, import-list 1/1, job04 7/7, architecture-recovery 28/28, typecheck/build/lint PASS. I inspected the relevant assertions and source paths but did not independently rerun these suites. No focused rerun was warranted by a concrete untested change in this integration diff.
- Prettier check was attempted on current files and base `outbox.ts`, but this checkout's `pnpm exec prettier` returned `Command "prettier" not found`; it provides no formatting verdict. The reported `outbox.ts` drift is pre-existing; retained-line diff has only the new import and moved helper deletion, so this review did not edit it.

## Findings, limits, next owner

- No open blocker, should-fix, or security finding in the reviewed six files. No finding closure from the prior reports was assumed without checking the integrated diff and contract paths.
- Scope is code review of PR #1176 at the pinned SHA, not live provider delivery or production UAT. The earlier report's APNs retry limitation is an existing documented contract limit, not introduced here.
- Coordinator: confirm CI result on `10babcc8`, integrate current main (including `worker-db-cancel.test.cjs`), revalidate any resulting diff, and own merge gate. Do not infer CI green or PR completion from this review.
