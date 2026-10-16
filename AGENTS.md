# Agent working agreement

Read docs/PRD.md, docs/TECHNICAL-DESIGN.md and your task spec. Work only in assigned scope. Current milestone is W0 foundation, not production ticketing.

## Ownership
- Coordinator owns root tooling, lockfile, CI, shared contracts and integration.
- Backend worker: apps/api, apps/worker, packages/backend and database tests/migrations.
- Web worker: apps/web only.
- iOS worker: apps/mobile only. Read Expo overview and React Native skills before coding.
- Do not edit another scope to make your build pass. Ask the coordinator for contract/dependency changes.

## Safety and correctness
- Never add real secrets, credentials or user data. .env.example is documentation only.
- Do not silently add mock authentication to production paths. Mark fixture/demo data explicitly.
- Database business state belongs in PostgreSQL. Redis is not the source of truth for quota or check-in.
- Tenant context must be transaction-local and queries parameterized. Runtime role must not own tables or bypass RLS.
- Do not create cloud resources, publish production, submit stores or push remote branches unless task explicitly authorizes it.
- Do not control another worker's simulator or database. Use task-specific ports/project names.

## Workflow
- pnpm workspaces; install exact versions. Root lockfile belongs to coordinator.
- Generated code is regenerated, not edited manually. API contract changes require coordinator agreement.
- Report commit SHA, changed files, exact checks and limitations. A successful build does not prove security/concurrency behavior.
- Use Orca lifecycle commands from your live dispatch preamble. Check follow-ups at checkpoints and before worker_done.
- No delegation without task authorization.
