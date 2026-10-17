# Spec — D11-A3 Epic planner

## Tracking

- Epic: [#222](https://github.com/hangndat/ticket-solution/issues/222)
- Story: [#223](https://github.com/hangndat/ticket-solution/issues/223)
- Task Issue: [#226](https://github.com/hangndat/ticket-solution/issues/226)

## Vai trò

- Epic planner theo `.cursor/rules/orca-epic-orchestrator.mdc`
- **Không** gắn Role coding catalog (`product-ba` / `web` / …)
- Agent: cursor
- **Không** spawn worker con; không commit/push/PR/merge; không sửa ngoài ownership

## Ownership

- `docs/plans/D11-UX-PRODUCTION-PLAN.md`
- `docs/tasks/d11/**`

## Mục tiêu

Chuẩn bị hierarchy Epic→Story→Task, Role ID+path, AC, deps thật, wave max, specs pha B, production readiness gaps; reconcile BA/PD khi xuất hiện.

## Acceptance criteria

- [ ] Plan ghi Issue #222–#226; O11; pha A vs B
- [ ] Phân biệt observed / inferred / hypothesis
- [ ] Production ≠ UI: O06, unmeasured metrics, release, runbook/rollback, device UAT, no self-authorize deploy/store
- [ ] Task specs `docs/tasks/d11/*` đủ để coordinator dispatch **sau** user review
- [ ] Wave: BA ∥ PD; pha B fan-out ghi rõ
- [ ] Nhật ký reconcile cập nhật khi BA/PD land
- [ ] Không tuyên bố pilot/production ready

## Checkpoint

Gửi mailbox khi draft xong; trước `worker_done` đọc BA/PD incorporate hoặc `ask` nếu cần chờ.
