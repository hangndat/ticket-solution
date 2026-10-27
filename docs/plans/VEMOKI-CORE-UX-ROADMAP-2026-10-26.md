# Vemoki — Kế hoạch hoàn thiện sản phẩm cốt lõi và UX tự phục vụ (S0)

Ngày: 26/10/2026 · Chủ trì: coordinator gốc Minh · Epic [#914](https://github.com/hangndat/ticket-solution/issues/914).

**Đây là roadmap thực thi canonical của Epic #914.** [`docs/vemoki-core-roadmap-agents.md`](../vemoki-core-roadmap-agents.md) là tài liệu đầu vào (reference) do user cung cấp; khi hai tài liệu khác nhau, file này và [O25](../DECISION-LOG.md) thắng. Trạng thái động: Project #3.

Trạng thái: user đã duyệt định hướng/phạm vi ngày 26/10/2026 kèm điều chỉnh bắt buộc (đã áp dụng vào file này). Feature coding chỉ bắt đầu sau khi PR planning qua review độc lập + CI và được tích hợp. Không thay đổi production/store/cloud. Mã `S0–S6/Txx` là mã planning cục bộ; số Issue thật nằm ở §7.

## 1. Baseline và evidence đã đọc

| Mục | Giá trị / nguồn |
| --- | --- |
| `origin/main` pin | `ac579482b4f8766ff24928112bbba852f3b53b05` (merge PR #913). Chứa PR #911 (`a1efcc64`) — chỉ là merge release tooling, **không** chứng minh đã deploy/rehearsal production. |
| PR mở | 0 |
| Run/worker live | 0 worker live; 100 dispatch đã settle. Một resource `owned` (run `run_f78e3c75f3ee`, task `task_ee5156fc75fa`, `completed`) trỏ tới worktree `pp1-pilot-ready` không còn trên đĩa — ghi nhận, không động tới; không ảnh hưởng ownership `apps/portal`/`apps/web`/`apps/mobile`. |
| Project #3 | 352 items: 319 Hoàn thành, 25 Bị chặn, 3 Đang làm, 2 Chờ duyệt, 1 Sẵn sàng, 2 Chưa lên lịch (đọc 26/10 qua `gh project item-list`). |
| Nợ hoãn | [Comment #901](https://github.com/hangndat/ticket-solution/issues/901#issuecomment-6399232008) xác nhận #901, #903, #904, AR891-INT-F01 hoãn theo quyết định user. Giữ nguyên, không có task mới cùng việc. |
| Epic liên quan còn mở | #874 (VD O23, Bị chặn acceptance), #889 (VD-08 UAT, Đang làm), #880/#881/#879/#882/#878 (Bị chặn acceptance runtime), #867/#868/#869 (UI867, Chờ duyệt), #891 (Atlas, hoãn), #301 D13 store (ngoài phạm vi). |
| Tài liệu | `AGENTS.md`, `apps/portal/AGENTS.md`, `docs/ROADMAP.md`, `docs/plans/PORTAL-ROADMAP.md`, `docs/DECISION-LOG.md` (O16–O23), `docs/agents/{README,ui-workflow,cost-catalog}.md`, `company/{README.md,employees.json}`, `docs/reviews/VD08-VEMOKI-INTEGRATION-2026-10-25.md`, `docs/reviews/PORTAL-AUDIT-2026-10-23.md`, `docs/reviews/PORTAL-UX-UI-AUDIT-2026-10-23.md`. |
| Code đã đối chiếu trên HEAD | `apps/portal/{app,src}` (access hooks, trang event/events/new/config, context strip, ops panels, BFF routes), `apps/api/src/{inventory,approval,cs,exports,reporting}.ts`, `packages/contracts/src/index.ts`. |

## 2. Gap matrix (tái kiểm trên `ac579482`)

Cột "Tái hiện": **Có (code)** = kết luận xác định từ luồng code, chưa chạy runtime; **Nghi vấn** = cần test tái hiện trước khi sửa; **Không** = không còn lỗi.

| ID | Yêu cầu | Code/API/UI hiện tại | Test/evidence | Issue/PR hiện hữu | Gap | Tái hiện | Xử lý |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-01 | Denied/error không kẹt spinner | `app/t/[tenantId]/e/[eventId]/page.tsx:258` và `app/t/[tenantId]/events/page.tsx:100` kiểm `loadKind/list.kind === 'loading'` **trước** error/denied; state dữ liệu chỉ rời `loading` khi access `ready` → spinner vô hạn khi bị từ chối/lỗi | Chỉ unit test thuần (`apps/portal/tests`), không test gate theo trang | #838/#850 đã đóng (finding khác) | Thứ tự gate sai ở 2 trang | Có (code) | Cần sửa → S1-T01 |
| G-02 | Quyền event không đồng nhất tenant-admin | `src/prep/use-event-access.ts` bắt `tenantHasAdminChrome` cho **mọi** trang event; staff chỉ được gán event (`cs.lookup`, `report.read`) bị denied dù `buildEventMenuItems` cấp menu | Không có test | — | Route guard lệch capability menu | Có (code) | Cần sửa → S1-T01 |
| G-03 | Đổi tenant/event an toàn | `src/components/portal-context-strip.tsx:53` luôn về `/t/<id>` (mất màn tương ứng); không có guard form chưa lưu (không `beforeunload`/dirty); `load()` không abort/so khớp context khi param đổi | Không có | PFE-005 (audit 23/10, chưa chốt) | Thiếu giữ màn, unsaved guard, chặn response muộn | Có (switch/unsaved); Nghi vấn (response muộn) | Cần bổ sung → S1-T03 |
| G-04 | Retry cùng ý định dùng cùng idempotency context | `crypto.randomUUID()` sinh **mỗi lần bấm** ở ≥15 mutation (events/new, setup, members, pending approve/deny, import, export, CS resend, notifications retry, onboarding) | BFF nhận `idempotencyKey`; không test client | — | Retry sau timeout/unknown thành operation mới | Có (code) | Cần sửa → S1-T04 (pattern chung) + consumer theo slice |
| G-05 | Wizard tạo event gửi payload đầy đủ, bước cuối hiện dữ liệu thật, gợi ý slug | `app/t/[tenantId]/events/new/page.tsx`: `submit()` gọi `form.validateFields()` ở bước 3 khi Form.Item bước 1–2 đã unmount; bước cuối chỉ là Alert tĩnh; không gợi ý slug | Không có | #229/#406 đã đóng | Payload có thể thiếu `name/slug`; review step không có dữ liệu | Nghi vấn (cao) | Cần sửa sau khi test tái hiện → S2-T01 |
| G-06 | Lưu nội dung không ghi đè phần không chỉnh | `app/t/[tenantId]/e/[eventId]/config/page.tsx:163` dựng `buildMinimalConfigPayload` (hero + terms) rồi POST `config-versions` | Không có | — | Sections/brand khác trong version trước bị thay bằng cấu hình tối giản | Có (code) | Cần sửa → S2-T03 |
| G-07 | Draft/preview/publish có revision, conflict không ghi đè im lặng; readiness không biến 403/lỗi mạng thành "thiếu cấu hình" | `expectedRevision`/`expectedVersion`/`expectedPublishedVersion` đã có ở setup/config/publish | Chưa có test conflict UX | — | UX conflict và phân loại lỗi readiness chưa chứng minh | Nghi vấn | Cần bổ sung (verify-first) → S2-T04 |
| G-08 | Danh sách Khách & vé server paging/filter, tách invitation/request/ticket | API có `GET tickets` (q, cursor, limit), `GET redemptions` (PENDING_REVIEW, cursor, sourceId, ticketTypeId, q), `GET invitations` (cursor, limit, state — **không có q**) | `tests/ops-*.test.ts` cho shape | #421 (đã đóng) | Chưa có workspace trung tâm; invitations thiếu search server | Có (API) | Cần bổ sung → S3-T02 (UI theo từng nguồn, không ghép trang) + S3-T01 nếu contract duyệt `q` |
| G-09 | Import tìm lại job sau reload, không bắt nhớ UUID | API chỉ có `GET imports/:importId`, **không có list**; panel giữ `importId` trong `useState` và có ô nhập "Import ID" | `tests/ops-import.test.ts` | #422/#423 (đã đóng) | Reload mất job; UI yêu cầu UUID | Có (code) | Cần bổ sung → S0-T03 contract → S3-T01 BE → S3-T03 UI |
| G-10 | Hiển thị hạn mức/hành động khi chạm cap; không tự đổi policy | `TenantLimitsDto`/usage chỉ có trên API Platform Operator; portal tenant không đọc được; không map `TENANT_LIMIT_REACHED`/`RATE_LIMITED`/`RESEND_LIMIT`/`PENDING_LIMIT` | — | #520/#521 (onboarding, đã đóng) | Thiếu read contract phía tenant và copy lỗi | Có (contract) | S0-T03 contract → S5-T02 |
| G-11 | Persona OIDC theo role cho UAT runtime | D9 seed có owner demo; chưa có Manager/CS/Supervisor/Scanner/report-only cô lập | — | #889, #880, #879 Bị chặn vì thiếu fixture | Gate runtime cho S1–S6 bị chặn | Có | Cần bổ sung → S0-T04 (tooling, dữ liệu giả) |
| G-12 | Attendee web: pending/rejected/issued/unknown, khôi phục, không bắt cài app | VD-04 đã merge (#888); thiếu UAT OIDC owner; cold offline deeplink cần mạng SSR lần đầu | CI web PASS | #881, #889 | State runtime chưa chứng minh; cold-offline web **ngoài scope** theo O25 | Chưa tái kiểm lượt này | S4-T01 verify-first, giữ #881 cho acceptance visual |
| G-13 | iOS Staff: tenant/event rõ, pending/conflict/unknown, logout/revoke, offline/retry | VD-06 đã merge (#884); build local PASS; thiếu Staff OIDC fixture và thiết bị thật | Simulator build | #879, #889 | Runtime + thiết bị | Chưa tái kiểm lượt này | S4-T02/T03 sau S0-T04 |
| G-14 | Portal không có admission (O23) | Trang Gate portal chỉ báo cáo theo `report.read` (#885 review PASS) | CI + review #885 | #880 | Chỉ còn acceptance runtime | Không (code) | Giữ #880; evidence ở S6 |
| G-15 | Evidence production-like cho public/platform | AR891-INT-F01: `ticket_app` không `SET LOCAL ROLE ticket_platform_runtime` → public endpoint 500 trong rehearsal | [#899 comment](https://github.com/hangndat/ticket-solution/issues/899#issuecomment-6398895858) | #901/#903/#904 hoãn | Đã hoãn | Chưa tái hiện ở stack local | **Deferred** — giữ hoãn. Chưa biết phạm vi ảnh hưởng ở local; nếu tái hiện và chặn bất kỳ task nào → `Bị chặn` theo B-02, không sửa vòng, không bypass DB/RLS |

## 3. Phạm vi, deferred, blocker

- **Trong phạm vi:** S0–S6 theo roadmap user; mọi task bám contract/API hiện có, chỉ thêm endpoint khi S0-T03 chốt contract.
- **Deferred / On request (không estimate, không dispatch):** payment/refund, kiosk, in thẻ, quay số, quiz, marketplace, editor kéo-thả tổng quát.
- **Non-goal giữ nguyên:** Android native, Web Gate admission, transfer, seat map, Wallet; không Zalo/ZNS, custom-domain/sender, CRM, SSO; không billing/paywall/pricing tiers, không claim unlimited/trọn đời/SLA.
- **Nợ hoãn giữ tách biệt:** #901, #903, #904, AR891-INT-F01 — không tạo task cùng việc.

| Blocker | Chặn gì | Owner | Điều kiện mở |
| --- | --- | --- | --- |
| B-01 Persona fixture (G-11) | Runtime acceptance S1–S6, #880/#889 | Noah (S0-T04), Minh điều phối | S0-T04 merge + reviewer PASS |
| B-02 AR891-INT-F01 (hoãn) | Evidence production-like cho public/platform; và **bất kỳ task nào** nếu lỗi tái hiện trên stack local (vd. public event pages, onboarding/platform) | Minh | Nợ giữ hoãn. Khi tái hiện: ghi task `Bị chặn` + bằng chứng (route, role DB, SHA) + owner Minh; resume chỉ khi user ưu tiên lại #901/#904/INT-F01. Không sửa vòng, không cấp thêm role, không owner/BYPASSRLS |
| B-03 Thiết bị thật | Camera/QR/offline/VoiceOver S4/S6 | User cầm máy + Zico | Có phiên thiết bị; simulator không thay evidence |
| B-04 Kênh email thật | Evidence inbox S5 | Minh | Task ủy quyền riêng; Mailpit chỉ là evidence local |

## 4. Roadmap, AC và ownership

Portal = `apps/portal/**` (role `web`, Higo cố định để giữ một feature worker/slice). Attendee web = `apps/web/**` (Linh). iOS = `apps/mobile/**` (Zico). Backend = `apps/api`, `apps/worker`, `packages/backend` (Gonic). Contracts `packages/contracts`, root scripts/lockfile: coordinator (Minh; Noah khi được giao tooling).

> **Ownership/WIP theo [O25](../DECISION-LOG.md):** `apps/portal` và `apps/web` là **hai slice riêng**, mỗi slice tối đa **một** feature coding worker cùng lúc. O25 thay quy định "cùng slice web" trong `PORTAL-ROADMAP.md` §4 và `PORTAL-IMPLEMENTATION-RUN.md`. Shared contracts (`packages/contracts`), root tooling, lockfile và CI thuộc coordinator. Giữ nguyên caps (≤5 non-review, ≤3 reviewer, ≤1 Codex worker), employee identity và backpressure; không giao một employee hai dispatch chồng nhau.
>
> **Phạm vi offline theo O25:** attendee web cần mạng để tải vé lần đầu; Epic #914 **không** thêm cold-offline web/PWA/cache. iOS offline chỉ áp dụng dữ liệu đã tải theo contract hiện hành (ADR-18). Tiêu chí cold-offline web trong #889/#881 là **ngoài scope**, không ghi PASS.

### S0 — Đối chiếu, handoff, kế hoạch

- **T01** (Minh, coordinator): baseline, gap matrix, Project, PR planning — tài liệu này. AC: mọi task có nguồn/owner/dependency/evidence; nợ hoãn không vào ready queue; PR planning qua review độc lập exact SHA + CI và được tích hợp. Không đóng chỉ vì user duyệt trong chat.
- **T02** (Liv, `product-design`): handoff tối thiểu trên hệ thiết kế đã duyệt (Ant Design/ProComponents + Live Pulse scoped, O18/O23) cho: workspace Khách & vé (tabs nguồn, drawer timeline, PII mask), import 4 bước + phục hồi job, bước review của wizard tạo event, trạng thái conflict/limit. Không redesign/brand mới.
- **T03** (Dexter, `architect`): contract cho G-09 (list import jobs), G-08 (`q` cho invitations — chỉ nếu cần), G-10 (chọn: endpoint read-only hạn mức/usage phía tenant **hoặc** chỉ map error code hiện có), pattern idempotency-per-intent phía client (G-04). Có **security checklist** (tenant scope, RLS, permission, PII, enumeration, rate limit). Không thay invariant transaction/RLS.
- **T04** (Noah, root tooling): fixture local. **Nghiệm thu ở mức fixture**: OIDC identity, membership, event assignment, permissions và seed/reset dữ liệu giả lặp lại an toàn; mỗi persona có expected result cho truy cập hợp lệ **và** negative access. Không phụ thuộc các màn đang có bug #926 hoạt động đúng. Reset/cleanup chỉ trong stack + namespace test đã xác minh. Không cấp thêm quyền, không đổi role DB/BYPASSRLS.

**Chuỗi contract bắt buộc (G-08/G-09/G-10):** S0-T03 contract → coordinator áp shared types `packages/contracts` → backend implementation (S3-T01, và task backend limits nếu chọn endpoint mới) → Portal/BFF consumer → runtime evidence. Tài liệu contract không thay endpoint. Nếu S0-T03 chọn endpoint limits/usage mới, coordinator tạo task backend riêng có reviewer `dod+sec` trước S5-T02. Nếu chỉ map error code, S5-T02 ghi rõ giới hạn sản phẩm: **chưa** cung cấp màn xem hạn mức/usage; không claim đã đóng khả năng này.

### S1 — Quyền, context, state (portal)

- **T01** sửa G-01 + G-02: tách resolver access thuần (test được bằng `node --test`), event route theo assignment/permission của event; trang gate thứ tự loading/error/denied đúng. Regression tests + fix chạy được ngay; runtime acceptance chờ S0-T04.
- **T02** ma trận capability menu ↔ route ↔ action ↔ BFF; direct-route test; revoke membership/assignment → request mới bị chặn và UI về denied (backend là authority; nếu server không chặn → task backend riêng).
- **T03** chuyển tenant/event: giữ màn tương ứng khi đủ quyền, fallback rõ; chặn response muộn; guard form chưa lưu.
- **T04** state thống nhất + idempotency theo ý định. Làm helper/pattern trước, rồi áp dụng **theo nhóm mutation nhỏ** (mỗi nhóm một commit/test riêng). Tests bắt buộc: server commit nhưng mất response, double-click, đổi context giữa chừng, reload/recovery, key expiry, payload mismatch. Cùng ý định retry giữ key **và** payload theo contract; nếu input đổi khi operation trước còn unknown thì **không** âm thầm sinh thao tác mới — phải đối soát trạng thái hoặc người dùng xác nhận rõ. Không đổi backend contract ngầm.

AC chung S1: role matrix + direct-route tests pass; request chéo tenant bị chặn; không spinner vô hạn, không lẫn dữ liệu, không false success; không cấp thêm quyền/BYPASSRLS để test pass.

### S2 — Chuẩn bị sự kiện đến publish (portal)

- **T03 (ưu tiên sớm, correctness/data preservation)** nội dung/branding/template (G-06): sửa trên payload version mới nhất, giữ phần không chỉnh, xử lý revision conflict, preview đúng bản lưu; không editor tổng quát. Không phụ thuộc kỹ thuật vào T01/T02; chỉ chờ #926 (gate trang event đúng).
- **T01** wizard tạo/sửa metadata (G-05): payload đầy đủ, timezone/venue/contact/visibility, gợi ý slug, bước review hiển thị dữ liệu thật, retry cùng key (helper S1-T04).
- **T02** loại vé/nguồn/quota: nhãn nghiệp vụ, đường đi, trạng thái sử dụng; không gộp ba mô hình dữ liệu.
- **T04** draft/save/preview/publish (G-07): conflict revision có UX rõ; publish ≠ mở nhận vé ≠ mở Gate; readiness phân biệt 403/lỗi mạng.

AC: Manager tạo → sửa → lưu nháp → preview → publish đúng bản đã lưu; retry không tạo bản ghi trùng; không cần nhớ UUID/revision.

### S3 — Workspace Khách & vé

- **T01** (Gonic, backend) endpoint theo contract S0-T03 sau khi shared types được áp: list import jobs (tenant/event scoped, cursor), `q` invitations nếu contract duyệt.
- **T02** (portal) danh sách trung tâm theo từng nguồn (invitation/request/ticket) với server paging/filter/search + drawer chi tiết/timeline; trạng thái request/ticket/notification/check-in tách trường; PII mask theo capability. Nếu dùng filter invitations mới → phụ thuộc S3-T01.
- **T03** (portal) import Chọn file → Ghép cột → Preview → Commit; lỗi theo dòng, tải lỗi; job tìm lại sau reload; tách import / gửi invitation / cấp vé.
- **T04** (portal) pending approve/reject có lý do + kiểm quota; bulk chỉ khi contract có, kết quả từng mục.
- **T05** (portal) CS search/detail/resend có cooldown, delivery trung thực; export filter server-side, job state, quyền, link hết hạn.

AC: fixture vượt một trang vẫn tìm/duyệt/xuất đúng phạm vi; reload không mất job; retry cùng ý định cùng idempotency; resend không tạo vé mới; email lỗi không mất vé.

### S4 — Attendee và iOS Staff

- **T01** (Linh, `apps/web`) **verify-first**: chạy sớm chỉ phần kiểm chứng độc lập có deliverable rõ (ma trận state × route từ code/test, gap tái hiện được); không sửa theo suy đoán, không giữ worker chờ fixture. Phần runtime/fix đầy đủ mở khi S0-T04 sẵn sàng. Không cold-offline web/PWA/cache (O25).
- **T02** (Zico, `apps/mobile`) Staff: tenant/event rõ, kết quả quét, confirm, pending/conflict/unknown, logout/revoke theo policy.
- **T03** (Zico) regression retry/restart/offline queue/sync/receipt theo contract; offline chỉ dữ liệu đã tải (ADR-18); Portal chỉ báo cáo.

AC: Manager phát vé → attendee thấy vé → Staff xác nhận → Portal phản ánh; có scenario retry/quét trùng/mất mạng; build local (không EAS); không claim offline multi-device chống trùng; không đổi ADR-18.

### S5 — Miễn phí có kiểm soát (portal)

- **T01** onboarding tổ chức, mời thành viên, gán event theo policy hiện hành (tái dùng #520/#521). Review có security (mời/gán quyền).
- **T02** hạn mức/cooldown/rate limit: map error code; hiển thị read-only **chỉ khi** endpoint backend đã có (xem chuỗi contract S0). Không đặt/nâng/tắt cap.
- **T03** overview theo giai đoạn, metric/endpoint thật. `asOf` là **timestamp snapshot từ server**; timer phía client chỉ tính tuổi dữ liệu/stale, không đẩy `asOf` về hiện tại khi chưa fetch dữ liệu mới. Deep link giữ context/quyền.
- **T04** trợ giúp trong ngữ cảnh, copy chỉ mô tả năng lực đã kiểm chứng; không upsell/unlimited/SLA.

### S6 — Nghiệm thu phạm vi mới

- **T01** (James, `dod+sec`) functional/security/recovery trên exact SHA tích hợp: fixture S0-T04, role matrix, pagination, timeout/retry/recovery, stale, permissions, cross-tenant.
- **T02** (Mira, `ux`) a11y/responsive/interaction trong browser: keyboard, focus, label, contrast, zoom, 320–1440, empty/error/unknown.
- **T03** (Minh) đóng finding theo review-convergence, CI, docs/runbook/demo script, kết luận code complete / acceptance complete trong scope / release blockers / pilot readiness.

T01 và T02 dùng **chung một evidence matrix** (route × persona × state × viewport/locale × SHA), mỗi bên chỉ kết luận checklist của mình. Evidence chuyển sang Issue cũ (#880/#881/#879/#882/#889) chỉ khi khớp đúng SHA, môi trường, persona, viewport/locale và AC của Issue đó; tiêu chí ngoài scope (vd. cold-offline web) ghi "ngoài scope theo O25", không PASS. S6 không thay #901/#903/#904; nghiệm thu local không là giấy phép pilot.

**Snapshot giấy 27/10/2026 (không thay Project #3):** SHA `2645999f0ad535276b63a95c6c96bace9cff025e`; CI 29/29. Portal/web findings đã merge (#1000–#1003). Staff iOS thiết bị thật (16 Pro `00008140-000605803C01801C`): admit/dup/unknown/logout/pending/conflict/offline **PASS**. VoiceOver skip theo owner. TF 1.0.0 (28) catalog **PASS**, login OIDC fail-closed (không chờ). Prod cutover live cùng SHA. Bốn mức: code complete **có**; acceptance S6 **có** (known gap VO/revoke/TF login); Epic #914 **Đang làm** (KEYRING/TF login); pilot **không**.

## 5. DAG và waves

```text
S0-T01 PR planning → review độc lập + CI → tích hợp  (gate trước mọi feature coding)
   └─ W1: S0-T02 Liv ∥ S0-T03 Dexter ∥ S0-T04 Noah ∥ S1-T01 Higo ∥ S4-T01 Linh (chỉ verify-first)

Portal (serial, Higo, ưu tiên correctness):
   S1-T01 → S2-T03 → S1-T02 → S1-T03 → S1-T04 → S2-T01 → S2-T04 → S2-T02
          → S3-T02 → S3-T03 → S3-T04 → S3-T05 → S5-T01 → S5-T02 → S5-T03 → S5-T04
   (thứ tự trong hàng portal là xếp lịch worker, không phải dependency kỹ thuật)

Dependency kỹ thuật thật:
   S1-T01 → S2-T03 (gate trang event)        S1-T04 → S2-T01, S3-T03, S3-T04 (helper idempotency)
   S0-T02 → S2-T01 (review step), S3-T02, S3-T03, S5-T02 (copy limit)
   S0-T03 → shared types (coordinator) → S1-T04 (pattern), S3-T01 → S3-T03; S3-T01 → S3-T02 nếu dùng filter mới
   S0-T03 → [task backend limits nếu chọn endpoint] → S5-T02
   S0-T04 → runtime acceptance mọi task UI, S4-T02/T03 runtime, S4-T01 full, S6
iOS (Zico):      S4-T02 → S4-T03
Cuối:            mọi task trên → S6-T01 ∥ S6-T02 → S6-T03
```

Phân biệt: **dependency để bắt đầu coding** (artifact/contract cần có trước khi viết code) và **dependency để nghiệm thu** (fixture/thiết bị/SHA tích hợp). Task được Ready khi đủ loại thứ nhất; chuyển Hoàn thành khi đủ loại thứ hai.

| Wave | Worker live (trần ≤5 non-review, ≤1 feature/slice) | Reviewer (≤3) |
| --- | --- | --- |
| W1 | Liv (docs), Dexter (docs), Noah (scripts), Higo (portal S1-T01), Linh (web S4-T01 verify-first) — 5 là trần, không bắt buộc | James theo PR sẵn sàng; Mira cho handoff PD |
| W2 | Higo S2-T03, Zico S4-T02 (khi S0-T04 có persona Staff), Gonic S3-T01 (khi contract + shared types xong), Linh fix khi có gap tái hiện | James, Mira |
| W3+ | Chuỗi portal tiếp theo; Zico S4-T03 | — |
| Cuối | S6-T01 James ∥ S6-T02 Mira → S6-T03 Minh | — |

WIP đầy (≥3 Chờ duyệt, ≥2 PR/slice chờ merge, ≥4 PR thiếu DoD+CI) → ưu tiên review → fix → CI → merge trước khi mở task mới. Không gắn ngày/ETA. Critical path là chuỗi portal. Task không tái hiện gap → bàn giao verification evidence, không tạo diff chỉ để có commit.

## 6. Reviewer và test plan

| Loại task | Reviewer | Checks bắt buộc |
| --- | --- | --- |
| Portal chạm quyền/context/PII (S1-*, S3-T02, S3-T04 cấp vé, S3-T05 export/PII, S5-T01 mời/gán quyền) | James · `dod+sec+ux` (`reviewer-merged.md`) | `pnpm --filter @ticket/portal lint typecheck test build`; test resolver/gate mới; Orca browser theo `uat-headless.mdc` với persona S0-T04 (390/1024/1440, VI) |
| Portal UI khác | James · `dod+ux` | Như trên, states empty/error/unknown/stale |
| Backend (S3-T01, backend limits nếu có) | James · `dod+sec` | test API + DB/RLS negative tenant; không BYPASSRLS; CI turbo |
| Web attendee | James · `dod+sec+ux` | `pnpm --filter @ticket/web lint typecheck test build`; Orca browser owner/guest |
| iOS | James · `dod+sec+ux` | local prebuild + `xcodebuild` (không EAS); Orca emulator; thiết bị thật cho camera/offline |
| Contract (S0-T03) | James · `dod+sec` | Security checklist; đối chiếu contract/DECISION-LOG/API hiện có |
| Handoff PD (S0-T02) | Mira · `ux` | Đối chiếu O18/O23 |
| Fixture tooling (S0-T04) | James · `dod+sec` | dữ liệu giả, negative access, reset giới hạn namespace, không secret commit, không đổi role DB |
| Docs planning (S0-T01) | James · `dod` | Nhất quán decision/rules, không mâu thuẫn tài liệu |

Mọi verdict ghi exact SHA trên Issue/PR hoặc `docs/reviews/*`; reviewer ≠ implementer; một session cho mỗi PR/SHA với checklist gộp, không review trùng; giới hạn lượt sửa theo `orca-review-convergence.mdc`. `worker_done`/board không chứng minh pilot ready.

## 7. Issue thật trên Project #3 (tạo 26/10/2026)

Epic [#914](https://github.com/hangndat/ticket-solution/issues/914). Hierarchy bằng GitHub sub-issues: Epic → Story → Task.

| Story | Tasks (mã → Issue · nhân viên) |
| --- | --- |
| S0 #915 | T01 #922 Minh · T02 #923 Liv · T03 #924 Dexter · T04 #925 Noah |
| S1 #916 | T01 #926 · T02 #927 · T03 #928 · T04 #929 — Higo |
| S2 #917 | T01 #930 · T02 #931 · T03 #932 · T04 #933 — Higo |
| S3 #918 | T01 #934 Gonic · T02 #935 · T03 #936 · T04 #937 · T05 #938 — Higo |
| S4 #919 | T01 #939 Linh · T02 #940 Zico · T03 #941 Zico |
| S5 #920 | T01 #942 · T02 #943 · T03 #944 · T04 #945 — Higo |
| S6 #921 | T01 #946 James · T02 #947 Mira · T03 #948 Minh |

Status từng item: xem Project #3 (nguồn duy nhất). Mapping với việc hiện hữu: acceptance runtime/visual vẫn ở #880 (Portal ops), #881 (attendee web), #879/#882 (iOS), #889 (ma trận VD-08); S6 gắn evidence vào đúng các Issue đó theo điều kiện ở §4-S6. Việc trước đã đóng được tham chiếu, không mở lại: #421/#422/#423 (import/pending/CS), #520/#521 (onboarding), #229/#406 (portal P0/P1), #838 (audit PA-01–06).

## 8. Điều kiện Ready

- **Sau khi PR planning được tích hợp:** S0-T02 #923, S0-T03 #924, S0-T04 #925, S1-T01 #926; S4-T01 #939 chỉ phần verify-first.
- **Không đánh Ready hàng loạt.** Task khác chuyển Ready khi đủ dependency để bắt đầu coding theo §5, ownership rảnh, WIP/review capacity cho phép.
- **Không vào ready queue:** #901/#903/#904/AR891-INT-F01 và các mục Deferred.

## 9. Quyết định đã chốt trong vòng duyệt 26/10/2026

Ghi tại [O25](../DECISION-LOG.md): (1) `apps/portal` và `apps/web` là hai slice riêng; (2) attendee web cần mạng để tải vé lần đầu, không cold-offline web/PWA/cache trong Epic #914, iOS offline chỉ dữ liệu đã tải theo contract hiện hành. Không còn quyết định mở chặn W1.
