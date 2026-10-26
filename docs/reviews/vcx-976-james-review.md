# PR #976 / Issue #939 — James · dod+sec+ux

**Exact SHA:** `53f175d1311565cc6db157feff7e5fb7d4ea6c45` · **base được giao:** `8a2a532d2e45fa5d59aba1f78345f477f3d10ea4`  
**Reviewer:** James (`reviewer-merged`), phiên độc lập với implementer Minh. Architecture impact: Không. Scope: năm tệp `apps/web` thay đổi hành vi/test; chỉ đọc contract tại `apps/api` và `packages/backend`. Không sửa code, DB, Portal hay #928.

**Kết luận:** Security **PASS**: tenant scope được chuyển tới API mà owner authorization vẫn giới hạn theo actor. Các scenario chức năng #939 có evidence local hợp lệ, nhưng DoD và UX hiện **GAP** vì checker evidence UI bắt buộc không đạt trên packet đã bàn giao; do đó **chưa kết luận acceptance complete/chưa merge theo review này**. Không tìm thấy blocker code mới ở SHA trên.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD | **GAP** | Code/checks/CI và runtime scenario đạt; `F-976-01` còn mở ở gate evidence UI. |
| Security | **PASS** | BFF bắt buộc UUID `requestId` và `tenantId`, giữ `forwardWithBearer`; API xác thực user, dùng `withTenant`, query lọc `tenant_id`, `request_id`, `actor_user_id`. |
| UX | **GAP** | Pending/unknown/rejected/issued thể hiện đúng trong ảnh và accessibility snapshot; packet không qua `ui-evidence-check.sh`, chưa có chrome-wrap probe độc lập. |
| Acceptance #939 | **GAP** | Ba AC chức năng được chứng minh trên local fixture; gate reviewer UX/evidence còn mở. Không suy pilot ready, mail thật hay cold-offline web. |

## Revalidation theo diff và invariant

- **F-939-07 — đã xác minh sửa.** Baseline bỏ `tenantId` ở owner GET nên API trả `422 TENANT_REQUIRED` dù staff đã approve; xem `decision-approve-da22c4d4-cfc8-4c5e-b794-59876e405ab8.json`. Tại SHA này, `apps/web/src/redeem/owner-status.ts:56-70` nhận scope; cả `redeem-form.tsx:649` và `claim-form.tsx:345` truyền tenant; BFF `redemptions/[requestId]/route.ts:5-22` kiểm UUID rồi forward scope. Network `rejected-network.json`, `guest-rejected-fixed-network.json`, `email-failed-ticket-issued-network.json` ghi owner GET có `tenantId` và trả 200. Test mới kiểm URL có tenant và thiếu scope không fetch.
- **F-939-08 — đã xác minh sửa.** `claim-form.tsx:115,177,322,345` chốt `pendingTenantId` khi kết quả là pending, giữ qua việc xóa parked intent, reset khi có context lời mời mới. Guest POST `201`, staff deny `201`, sau đó owner GET `200` có tenant và UI rejected: `guest-pending-fixed-*`, `guest-rejected-fixed-*`, `guest-rejected-fixed-network.json`. State chỉ giữ tenant UUID và request ID để refresh, không giữ lại claim token.
- **Owner isolation không nới.** API `apps/api/src/tickets.ts:478-507` vẫn lấy bearer và `tenantId` bắt buộc; service `:268-286` gọi `requireUser` rồi `withTenant`; `packages/backend/src/redemption-status.ts:52-94` lọc cả tenant/request/actor. `withTenant` đặt `app.tenant_id` transaction-local. Test backend hiện có ở `packages/backend/test/form-consent.test.cjs:385-404` xác nhận actor khác nhận `REDEMPTION_NOT_FOUND`. Đây là kiểm code/contract và test hiện có; packet không có live negative probe chéo tenant trên tip.
- **Pending/unknown không thành vé.** `redeem-form.tsx:269-284` xóa ticket ở pending/unknown; chỉ `ISSUED` tạo ticket tại `:654-671`. Network unknown ghi POST `500`, operation lookup `500`, rồi cùng key `dee8e471-1301-47f9-bb51-41b3c75094de` trả `200` pending; `request-counts.json` ghi request này `ticketCount: 0`, `request-uniqueness.json` ghi một request/code. Ảnh `unknown-after-commit-390.png` và `unknown-recovered-pending-1024.png` ghi rõ “chưa phải vé”.
- **Email retry giữ vé.** `email-fail.json` ghi ticket `73894c9c-3b93-421d-bc05-b46f3a499024` ACTIVE khi SMTP `ECONNREFUSED`, notification FAILED và outbox PENDING. `email-recover.json` ghi cùng ticket/outbox/notification, attempt 2 ACCEPTED; `email-recover-noop.json` ghi tick tiếp theo không claim thêm. Ảnh issued/wallet/QR trong packet khớp trạng thái này. Đây là local SMTP fixture, không phải nghiệm thu giao email thật.

## Checks và provenance

- Code cuối `1f4ce0be70edfe864e399007bff2cf392285b086`: log packet ghi `@ticket/web` test **296/296**, lint, typecheck, build **PASS**; build provenance có manifest HTTP khớp disk. `git diff --quiet 1f4ce0be..53f175d1 -- apps/web apps/api packages/backend package.json pnpm-lock.yaml turbo.json` **PASS**: phần sau chỉ evidence/docs. Không gán log local của SHA cũ thành test chạy trên tip.
- Tip PR được `gh pr view` xác nhận là `53f175d1…`; `gh pr checks 976` trả **ci/web/changes/turbo-persist PASS** trên PR hiện tại. [CI receipt](https://github.com/hangndat/ticket-solution/pull/976#issuecomment-6414189850) ghi exact tip và các job skip theo scope. Remote `baseRefOid` lúc review là `ddb7428b6e266d4ea406ff74478cc71cf30c5055`, khác baseline diff được giao; merge/integrated SHA vẫn cần gate riêng.
- Evidence canonical: [UAT #939](./vcx-939-leader-uat-20261026.md) và [packet](./evidence/vcx-939/leader-20261026/). Runtime owner ở source `ea2fbaae`, guest cuối ở build `1f4ce0be`; diff lên tip không đổi hành vi. Ảnh đã mở kiểm tại 390/1024/1440; PNG guest pending có kích thước thực 390×844, 1024×900, 1440×900, hash khác nhau; toàn packet có **32 PNG, 0 hash trùng**. `browser-cleanup.json` ghi các tab agent đã đóng.
- Review UX dùng checklist `impeccable` critique theo phạm vi state trong một context vì task cấm subagents, cùng `web-design-guidelines` và `vercel-react-best-practices`. Đối chiếu ảnh, accessibility snapshot, source và detector cũ `ui-detector.json: []`; không mở browser mới hoặc lặp UAT. Chưa kiểm thủ công keyboard/focus/screen reader hay chrome-wrap probe trên mỗi viewport; không suy các phần đó PASS.

## Finding chặn

### F-976-01 — thiếu gate evidence UI hợp lệ

- **Loại/mức độ:** evidence, blocker cho UX/DoD acceptance; **chặn merge: Có** theo `reviewer-uiux.md` §Cách review 3, 7. Owner: coordinator/evidence owner. Trạng thái: **Mở**, phát hiện trên `53f175d1…`.
- **Repro:** `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/evidence/vcx-939/leader-20261026` trả exit 1. Có 11 cặp `*.snapshot.json` 1024/1440 trùng byte (ví dụ `guest-pending-fixed`, `guest-rejected-fixed`, `unknown-after-commit`); packet cũng chưa lưu kết quả `ui-chrome-wrap-probe.js` theo viewport × persona. Checker đang coi accessibility tree giống nhau ở hai bề rộng là duplicate; 32 PNG thực tế khác hash, nên đây **không phải bằng chứng UI render trùng hoặc bug sản phẩm**.
- **Điều kiện đóng:** cung cấp validation UI đủ scope ở 390/1024/1440 với viewport/provenance và chrome-wrap probe, đồng thời làm cho checker evidence chạy **OK** trên bộ asset dùng để nghiệm thu (hoặc có quyết định điều chỉnh checker có căn cứ cho snapshot giống nhau nhưng PNG khác). Reviewer chỉ cần revalidate artifact và diff evidence, không chạy lại full matrix chức năng.

**Giới hạn khác không chặn:** thời điểm hết hạn pending hiện được hiển thị dạng ISO UTC trong `apps/web/src/redeem/messages.ts`; đây là copy/locale có thể cải thiện sau scope này. Không dùng quan sát đó để đổi AC #939 hoặc mở feature mới.
