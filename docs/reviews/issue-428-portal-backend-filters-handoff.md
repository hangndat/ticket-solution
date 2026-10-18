# Handoff — Issue #428 / PR #457 (T-BE-FILTERS)

| Trường | Giá trị |
| --- | --- |
| Implementer | Cursor worker `term_6d4159d9-703a-4b7e-be4c-a9505d545fd2` / dispatch `ctx_c2a55cfd5861` |
| Scope | `apps/api`, `packages/backend` — G-R1/G-N1/G-E1 |
| Commit SHA (behavior) | `6b5a24bba9d518b992a7dff787325638cc11a3d2` (`feat(api): portal pending/notify/export history filters`) |
| Branch tip | `git rev-parse origin/hangndat/portal-backend-filters` (docs-only commits after behavior SHA) |
| Checks | `node --test test/portal-filters.test.cjs` PASS on behavior SHA lineage; backend+api build; openapi regen |
| Findings / limitations | Implementer handoff — **chờ DoD reviewer độc lập** ghi verdict PASS/FAIL trên exact tip SHA lúc review |
| Revalidation | Bắt buộc nếu có commit hành vi mới sau review |

Architecture impact: Có (ADR-20 additive filters). Contract #427 đã landed trên main.
