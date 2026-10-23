# Benchmark review — PR #850 / readiness Issue #846

| Trường | Giá trị |
| --- | --- |
| Reviewer | Codex `gpt-6-sol`, effort `medium`; Orca session `orca_session_id:152baf92-b678-4d3f-8ba0-da4934d11950`, dispatch `ctx_5aa5c9cd7f1e` |
| Bắt đầu (UTC) | 2026-10-23 05:12:11 |
| Kết thúc (UTC) | 2026-10-23 05:13:50 |
| Allowance / token budget | Không rõ; không đo |
| Scope | PR #850, Issue #844, điều kiện mở Issue #846; chỉ đọc mã tại `6f700d9e278bd346cdb56326304d6385c6701f41` và GitHub bằng `gh` |
| Independence | Session reviewer khác implementer được ghi trên Issue #844 (`ctx_f1aacf06b686`); không sửa source |
| Decision IDs | O16 / ADR-20 §3.2, §8–9; ADR-22 D-7; ROADMAP §1.1, §2 |

## Kết luận

| Gate | Verdict tại SHA đã ghim | Căn cứ |
| --- | --- | --- |
| Code parity PR #850 | **FAIL** cho AC idempotency grant; các route provision/detail/status/limits và UI tương ứng hiện diện | F01; BFF dùng CSRF/Origin và platform bearer riêng nhưng grant create chưa idempotent end-to-end |
| Security | **FAIL** | F01: retry grant có thể tạo nhiều quyền `cs.read`; không thấy bypass auth/CSRF/tenant qua các route mới |
| DoD Issue #844 | **FAIL / acceptance chưa hoàn thành** | F01–F03; CI `portal` xanh không thay UAT Operator hoặc test BFF yêu cầu |
| Readiness Issue #846 | **Chưa sẵn sàng thực thi cutover / FAIL điều kiện đầu vào** | #844 còn OPEN và PR #850 còn OPEN; F02; ADR-20 yêu cầu parity evidence và dual-run/rollback trước khi xóa legacy |

**Code complete ≠ acceptance complete ≠ pilot ready.** PR #850 có implementation và CI trên SHA ghim, chưa merge `main`; #844 thiếu UAT Operator và finding security còn mở. #846 chưa có code cutover trong PR này; đây là đánh giá readiness, không phải nghiệm thu implementation #846 hoặc pilot/prod.

## Findings (SHA `6f700d9e278bd346cdb56326304d6385c6701f41`)

| ID / loại | Mức độ · chặn merge | Căn cứ và bằng chứng | Điều kiện đóng / owner |
| --- | --- | --- | --- |
| **F01 — lỗi security/idempotency, contract backend** | **blocker · Có** | Portal route gửi `Idempotency-Key` tại `apps/portal/app/api/bff/platform/support-grants/route.ts:58-70`, nhưng API controller `apps/api/src/platform/platform-operator.controller.ts:140-146` chỉ nhận bearer + body; service `apps/api/src/platform/platform-operator.service.ts:161-175` không nhận key; backend `packages/backend/src/support-grant.ts:47-72` luôn `randomUUID()` rồi `INSERT` grant mới. UI `apps/portal/src/ops/platform-mutate-panels.tsx:438-460` sinh UUID mới cho mỗi lần bấm, cả sau timeout mà `portalMutate` trả `networkError` (`src/client/portal-fetch.ts:58-91`). Hai lần submit cùng payload có thể tạo hai grant `cs.read` còn hiệu lực. Đây là gap backend có trước PR nhưng route/UI mới phơi bày và PR/Issue yêu cầu idempotency; header hiện không bảo đảm điều đó. | Coordinator cấp contract cho backend owner: consume/dedupe key theo actor + command + request hash trong PG, kiểm replay/concurrency và response; portal giữ cùng key khi retry kết quả không rõ. Test hai request cùng key và timeout/retry: một grant/audit, cùng kết quả; khác payload trả conflict. Revalidate PR #850 + backend SHA tích hợp. |
| **F02 — thiếu evidence acceptance / môi trường** | **blocker · Có** | `docs/reviews/PR844-EVIDENCE.md:27-35` ghi Keycloak `ticket-platform-web` lỗi trước login, chỉ có ảnh unsigned. Issue #844 DoD yêu cầu UAT headless Operator, ảnh hành động và axe serious/critical = 0; chưa có bằng chứng trên SHA ghim. PR #850 comment xác nhận UAT đang chạy song song, không phải PASS. | Owner môi trường/Operator UAT khôi phục Keycloak flow + MFA, chạy script `apps/portal/scripts/pr844-platform-uat.mjs` trên exact SHA hoặc SHA revalidated, lưu ảnh từng mutate action, axe kết quả 0 và log có thể kiểm. Không xóa legacy theo #846 trước khi parity này đạt. |
| **F03 — thiếu test theo AC** | **should-fix · Có cho DoD #844** | Issue #844 yêu cầu “Test BFF + UI tối thiểu”. Diff PR #850 chỉ thêm `apps/portal/tests/platform-mutate-zone.test.ts:33-85` (interpreter) và `ops-paths.test.ts`; không có test route mới cho CSRF/Origin, 422, forward platform bearer hay replay. CI `portal` xanh chỉ chạy suite hiện có. | Thêm test BFF route/contract có ý nghĩa cho deny CSRF/Origin, platform-only bearer, payload/key validation và replay grant sau contract fix; CI xanh trên SHA cuối. |

Không mở finding cho grant-create thiếu modal: Issue #844 chỉ yêu cầu xác nhận trước suspend/activate; `platform-mutate-panels.tsx:286-294` đã có `Modal.confirm` cho hai thao tác đó. Label tiếng Anh trên UI là polish, không dùng để chặn AC trong benchmark này.

## Kiểm tra và giới hạn

- Đã đọc `docs/PRD.md`, `docs/TECHNICAL-DESIGN.md`, `docs/DECISION-LOG.md`, `docs/ROADMAP.md`, ADR-20/22, role `reviewer-merged`, DoD/security role và convergence rule; xem tree tại exact SHA bằng `git show`, `git grep`, không checkout.
- `gh pr view 850`: head `6f700d9e278bd346cdb56326304d6385c6701f41`, OPEN; checks `changes`, `portal`, `turbo-persist`, `ci` SUCCESS trên SHA; `backend`/`database-isolation` SKIPPED vì PR portal. `gh issue view`: #843 và #845 CLOSED, #844 và #846 OPEN; PR #848/#849 MERGED. Không coi skipped checks là pass backend.
- Không chạy test local vì review chỉ đọc và worktree hiện tại ở branch khác, không checkout; CI ghim SHA là evidence tự động hóa. Không chạy UAT/can thiệp Keycloak; evidence hiện có ghi blocked. Chưa có merged integrated commit cho #850/#846 để kiểm CI trên `main`.
- #846 còn cần các gate riêng trong Issue: xóa route/BFF web và CSS legacy, redirect/410, nav/capabilities/email, ADR-22 Done + SHA, `node scripts/ui-budget.mjs`, web typecheck/lint/test/build/routes, UAT headless staff notify + Operator trên SHA tích hợp, review DoD/security độc lập. ADR-20 §8 còn yêu cầu cửa sổ dual-run/rollback đã thống nhất; coordinator xác nhận trước khi xóa legacy. Không có production deploy/realm prod trong scope.

Trạng thái findings: F01–F03 **Mở**, phát hiện tại SHA trên; chủ xử lý F01 = coordinator + backend/portal owner, F02 = coordinator + môi trường/UAT, F03 = portal owner. Đây là review đầu của benchmark; không tự suy ra số lượt sửa đã dùng từ lịch sử khác.
