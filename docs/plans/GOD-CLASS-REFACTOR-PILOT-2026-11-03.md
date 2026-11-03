# Pilot refactor god class/module — 03/11/2026

Base `0884d17d985c80b3aa3e0a5dd831f64e3e806aec`, worktree `hangndat/god-class-refactor`. Khảo sát CRG trên đúng worktree (1.616 files, 9.930 nodes, 98.896 edges trước sửa), rồi đối chiếu map/source. Graph không resolve đầy đủ npm alias/callback; số caller/test dưới đây là bằng chứng định hướng, không phải coverage toàn phần. Không có worker live cùng slice lúc chọn.

## Ứng viên và quyết định

| Ưu tiên | Ứng viên | Evidence về trách nhiệm/coupling/khó test | Quyết định |
| --- | --- | --- | --- |
| 1 | `apps/api/src/inventory.ts::InventoryService` | Cùng class phục vụ import mã/job, invitation claim/dispatch/list, quota và liệt kê mã; 14 method công khai trước sửa. Nó trộn OIDC actor, rate limit, object store, idempotency, logging và backend tenant calls. CRG không tìm thấy test gắn trực tiếp vào class; `invitation-list.test.cjs` kiểm qua HTTP. | **Pilot**: cụm invitation có ranh giới API rõ và kiểm thử hành vi HTTP sẵn. |
| 2 | `packages/backend/src/outbox.ts::processClaimedOutbox` | Một hàm ~655 dòng, cyclomatic complexity 144 theo LeanCTX; email budget/SMTP, APNs, retry/lease fencing, notification attempt và metrics cùng một luồng. Nhiều failure mode, dễ đổi race semantics khi tách. | Backlog: cần test lease/retry theo case trước khi sửa. |
| 3 | `apps/mobile/src/gate/staff-gate-workspace-context.tsx::StaffGateWorkspaceProvider` | Provider từ dòng 224–1448 gom authz/chrome, replay/receipt guards, offline queue và nhiều state/side effects; khó test một nhánh mà không dựng cả provider. | Backlog iOS: chọn một effect/state boundary, cần local device/simulator evidence theo scope. |
| 4 | `packages/backend/src/import-jobs.ts` | Module 37 graph nodes: cursor HMAC, CSV parse/mapping, object-store upload, job CRUD/preview/commit, cleanup, quota/authz/tenant. `parseCsvRows` cc 25, `parsePayload` cc 18. API alias làm graph báo 0 importers thiếu tin cậy. | Backlog backend: tách parser hoặc storage sau khi chốt contract test. |
| 5 | `apps/portal/src/ops/notifications.ts` | Module 50 graph nodes, 6 importers theo CRG; endpoint paths, response interpretation, locale labels, idempotency fingerprint và request bodies trong một file. | Backlog portal: tách pure interpretation trước, sau test caller. |

Thứ tự ưu tiên tính cả khả năng giữ hành vi và phạm vi test, không xếp theo số dòng đơn thuần. Không mở Task mới cho backlog trong Run này.

## Boundary pilot

- `InventoryService` và `InventoryController` giữ import job, mã/quota. Cụm invitation chuyển sang `InvitationService`/`InvitationController` cùng slice `apps/api`; `app.ts` đăng ký cả hai. Không sửa `packages/backend`, DB, route hay business contract.
- Auth phải verify/upsert trước list rate limit và trước backend call. Danh sách giữ bucket/Retry-After/log fields. Dispatch/claim giữ idempotency key, credential-key guard, mã lỗi và HTTP status. Tenant/event/user context và backend RLS flow giữ nguyên.
- OpenAPI giữ path và operationId cũ; `openapi-document.ts` map tên controller mới về operationId tương thích. Test HTTP kiểm email verified và thiếu idempotency; suite/API typecheck/lint và OpenAPI diff kiểm regression.
- Reviewer độc lập đối chiếu diff, test, route/OpenAPI, error body/logging và tenant/race boundary. Không suy acceptance PASS từ `worker_done` hay exit 0.

Workflow evidence: Run `run_1956cbea78d4`, Task `task_ef450a742260`, Dispatch `ctx_8b97e037a505` đúng một lần. Manifest/result/handoff nằm ở `.orca-metrics/lifecycle/1793677773348-eb5afe4d-cda7-4a9b-91f1-a0e44f223800/`; `requested` OpenCode Go `opencode-go/deepseek-v4-pro`, `effective` không có trong start receipt nên routing status `unknown`. Worker báo model effective nhưng chưa thay thế receipt. Settlement ở `.orca-metrics/lifecycle/1793678897968-fcad07e6-572e-48f6-8b31-40f483cd6a76/`; execution succeeded, telemetry collected, release receipt có `released`, acceptance còn chờ review. Không có baseline tiền/token để kết luận tiết kiệm.
