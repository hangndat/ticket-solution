# Pilot 2 — EventAdminService / event catalog

Base `de3c799ea24c3b31fa1192ae820648d6b5673220` sau pilot 1; chỉ sửa slice `apps/api`. CRG trên base: `EventAdminService` có 12 method công khai, xử lý cả vòng đời event (`create/list/get/patch/clone/archive/cancel/impactPreview`) và catalog (`ticketType/listTicketTypes/source/listSources`). File `events.ts` là importer duy nhất từ `app.ts` theo CRG; test API hiện có chỉ kiểm path catalog trong OpenAPI, nên cần HTTP regression cho wiring/auth/validation. `PlatformService` có nhiều method nhưng đã phân quyền cho các service con, không chọn chỉ vì số method.

## Boundary và contract

- `EventAdminService` giữ tám thao tác vòng đời event. `EventCatalogService` mới nhận bốn thao tác ticket type/source và bốn backend calls tương ứng. `EventAdminController` giữ route, method, DTO decorator, `requireUuid`, error mapping và operationId; inject hai service. `app.ts` đăng ký provider mới.
- Với mỗi catalog call, `actor()` giữ bootError/config guard → verify bearer → upsert user; backend call vẫn nằm trong `withTenant(db, tenantId, tx => …)` và truyền `tenantId/eventId/actorUserId`, cursor/limit/body như cũ. PRD M05 và Technical Design §5.2/§6.2 là invariant áp dụng. Không đổi backend, database, quota rule hoặc contract.
- Auth helper hiện được lặp ở hai service để tránh đổi thứ tự/failure path trong pilot; đây là nợ nhỏ cần giữ đồng bộ nếu sau này sửa auth. Không mở shared framework trong Run này.

## Checks và workflow evidence

Worker báo trước sửa API suite 56/56; sau sửa 58/58, typecheck/lint đạt, OpenAPI byte-stable và `git diff --check` sạch. Test HTTP mới kiểm bốn route, UUID 422 trước identity và OIDC misconfigured 503 fail closed. Test chưa chứng minh success path có DB hoặc race/quota; backend behavior được giữ nguyên trong diff nhưng reviewer cần kiểm tenant call boundary.

Run `run_74a66c963efc`, Task `task_cbeb96a055e5`, Dispatch `ctx_ee1f28d652c6` đúng một lần. Start manifest/result/handoff ở `.orca-metrics/lifecycle/1793679732883-4f8a6804-2099-4081-94eb-5fed762a76f2/`; requested `opencode-go/deepseek-v4-pro`, effective `unknown` vì start receipt thiếu `launch.effective`. Settlement ở `.orca-metrics/lifecycle/1793680472638-24b4c4b3-3d50-4319-8a7f-be78cc7dd73c/`: execution complete, telemetry collected, released. `join_reason=exact_dispatch_run_task_workspace`, `token_delta_reason=provider_usage_not_supplied`, token delta `null`; transcript ghi `source_changed`, chưa suy chi phí. Reviewer độc lập phải kết luận trên exact product SHA; `worker_done` không tự là acceptance PASS.
