# Roadmap — phạm vi và gate Vemoki

Ngày đối chiếu tài liệu: **05/11/2026**. Đây là bản đồ scope/gates, không phải snapshot board hoặc báo cáo runtime. [Project #3](https://github.com/users/hangndat/projects/3) là nguồn Status động; không suy trạng thái hiện tại từ ngày/SHA trong docs.

## 0. Nguồn quyết định và lịch sử

- Yêu cầu: [PRD](PRD.md); thay đổi đã duyệt: [Decision Log](DECISION-LOG.md). Approval chỉ cấp quyền trong phạm vi được ghi.
- Kiến trúc: [hiện trạng có bằng chứng](architecture/ar891-current-architecture.md), ADR và [technical proposal](TECHNICAL-DESIGN.md).
- [Snapshot roadmap trước khi dọn](archive/roadmap/ROADMAP-before-cleanup-2026-11-03.md) giữ nguyên các approval, Issue/PR/SHA, bảng Status ngày 17/10 và checkpoint E2E 30/10–02/11. Chúng là lịch sử, không phải regression hiện tại.
- Hướng dẫn agent: [bản đồ đọc](agents/README.md). Orca worker_done chỉ là kết thúc attempt, không tự đóng Task/Epic.

## 1. Các phạm vi đã có quyết định

- **O23:** Gate scan/nhập tay/admission/offline Gate chỉ iOS Staff. Portal chỉ đọc báo cáo; attendee web/iOS chỉ hiển thị vé. Không khôi phục Web Gate từ bảng D3/D6 lịch sử.
- **O25–O28 / #914:** sản phẩm cốt lõi/UX theo [roadmap #914](plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md). #914 đã được ghi nhận đóng với known gap chưa pilot-ready tại checkpoint; không tự reopen để làm Pilot.
- **Pilot/UAT #1008:** phạm vi riêng theo [catalog](plans/PROD-LAUNCH-UAT.md). Chỉ chạy launch-uat khi Task authorize; đóng #914 không cấp quyền hoặc chứng minh pilot ready.
- **F04 #1029–#1037:** E2E local theo [acceptance matrix](../tests/e2e/ACCEPTANCE.md) và [plan](../tests/e2e/PLAN.md). `pnpm e2e:f04-status` báo hợp ID có evidence lịch sử đã review và evidence hiện tại; tiến độ này trải trên nhiều SHA, không phải full regression trên HEAD. Không chép số PASS/BLOCKED theo SHA cũ thành tình trạng hôm nay.
- **D13 #301/#310:** [kế hoạch App Store](plans/D13-APP-STORE-RELEASE-PLAN.md); submit/release theo approval riêng và mandatory gates, không EAS Cloud Build.
- **D6 iOS UI 05/11 (wireframe đã duyệt):** Triển khai theo [wireframe iOS đã duyệt](design/mobile-approved-wireframes-2026-11-05/README.md), [handoff](design/mobile-approved-wireframes-2026-11-05/IMPLEMENTATION-HANDOFF.md) và [ADR](architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md). Phạm vi `apps/mobile`; Architecture impact: Không. Nguồn chuẩn là board 45 khung + 15 HTML `originals/` (pin bằng `MANIFEST.sha256`), **không** dùng board 25 màn dựng lại sai. Áp bốn delta CTA sau duyệt (tài khoản nhân viên, khám phá trống, link mời sai, sự kiện không sẵn sàng) theo README. Giữ O28–O33, auth/Gate invariants và Electric Violet token SoT (`brand/vemoki/tokens.json`); O30 chỉ đổi **trình bày** ví A+C, không đổi hành vi thứ tự vé hợp lệ/đã dùng, watermark, back navigation. Epic #914 đã **CLOSED** — việc này mở Issue/Epic mới trong Project #3, không reopen #914. Màn đại diện làm trước: **Ví của tôi** (`apps/mobile/src/app/(tabs)/my-tickets`) đối chiếu `originals/wallet-wireframe-hybrid-ac.html`. Approval thiết kế ≠ code complete / acceptance complete / pilot ready.
- **O33:** VoiceOver, Dynamic Type và WCAG UAT được waive khỏi gate MVP/pilot, không phải known gap và không chặn các Epic đã được quyết định. Mục tiêu thiết kế accessibility không tự tạo lại gate.
- **Non-goals MVP:** Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet. Không mở scope mới từ research/prototype.

### 1.1 Ba mức hoàn thành (bắt buộc phân biệt)

| Mức                                            | Nghĩa                                                                                                                                                                                                        | Không được suy ra                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Code complete**                              | Implementation đã merge `main` (hoặc PR sẵn), CI liên quan xanh trên commit tích hợp                                                                                                                         | Chưa đủ **Hoàn thành** Epic phát hành. Task docs/tooling (nhánh A) có thể đóng sau CI + SHA, không bắt buộc reviewer độc lập |
| **Acceptance complete** (board **Hoàn thành**) | Đủ DoD §2: review độc lập (khi security-sensitive), merge, CI, evidence đúng tiêu chí Issue                                                                                                                  | Chưa = sẵn sàng pilot / production / store                                                                                   |
| **Pilot ready**                                | Gate D5 đạt theo technical design: security/capacity/restore có số liệu rõ; UAT thiết bị thật (camera, deep link, push, offline ví, revoke) với build **local signed**; runbook; chỉ số chưa đạt được nêu rõ | Demo pass, Simulator-only, hoặc `ACCEPTED` APNs **không** đủ                                                                 |

### 1.2 Ngoại lệ UAT thiết bị thật & hạn chế bằng chứng

- **UAT agent qua Orca browser/emulator** theo [workflow UAT](agents/workflows/uat.md) là mặc định — **không** thay thế UAT camera/push trên **thiết bị vật lý** khi Issue yêu cầu (#26).
- Pass **Simulator** / Expo Go ≠ Pass TestFlight / device signed.
- `./scripts/d5-backup-drill.sh` PASS chỉ chứng minh fixture còn sau `pg_dump`/restore trên Postgres vứt bỏ — **không** backup production, **không** SLO.
- Push: đăng ký token / outbox `ACCEPTED` ≠ `DELIVERED` đến thiết bị.
- Không dùng EAS Cloud Build làm bằng chứng phát hành.

### 1.3 F04 — hoàn tất full AC E2E local

**Đơn vị hoàn thành:** từng ID trong 85 nhóm chỉ chuyển `PASS` khi đủ lớp B/H/D/R mà [`PLAN.md`](../tests/e2e/PLAN.md) yêu cầu, có assertion business state và nhánh từ chối không tạo mutation ngoài ý muốn, trên commit sạch với run ID. `coverage.json: implemented`, selector xanh hoặc run trên working tree dirty là bằng chứng một phần. `JOB-08` giữ `OUT`. **Cập nhật 02/11/2026 — user bỏ ràng buộc cấm hạ AC:** lớp bằng chứng và độ rộng assertion được phép điều chỉnh khi chi phí không tương xứng rủi ro, với điều kiện ghi đủ ID · phần bị giảm · lý do · rủi ro còn lại. Hai ranh giới giữ nguyên: không đổi expected outcome để khớp bug đã biết, và không ghi PASS cho lớp chưa chạy. 45 nhóm còn lại chia ba tầng (16 giữ gate đầy đủ · 20 kiểm kê + vòng chạy gộp với AC thu gọn · 9 known gap chờ quyết định owner) theo [`tests/e2e/ACCEPTANCE.md`](../tests/e2e/ACCEPTANCE.md) và [`PLAN.md` §15](../tests/e2e/PLAN.md).

Source/tested SHA và lớp bằng chứng xem acceptance matrix. F04 là local regression evidence, không thay physical-device UAT, security/capacity/restore hoặc các gate phát hành. Chỉ chuyển Issue theo sự kiện thực và evidence, không vì một suite/smoke đạt.

## 2. Định nghĩa hoàn thành (Definition of Done)

Một đầu việc trên board chỉ chuyển **Hoàn thành** khi:

1. Đủ review theo nhánh A/B trong [Project/DoD](agents/policies/project.md); nhánh B có reviewer độc lập.
2. Đã tích hợp vào nhánh tích hợp (`main`).
3. CI pass trên commit tích hợp (check + database-isolation khi liên quan).
4. Có evidence nghiệm thu đúng tiêu chí Issue (lệnh, log, test, SHA — không chỉ `worker_done`).

`worker_done` / Dispatch settled **không** đồng nghĩa task đã hoàn thành trên GitHub Project.

**Agent sync (bắt buộc):** Cập nhật Status Project theo sự kiện (Đang làm / Chờ duyệt / Bị chặn / Hoàn thành) **không chờ user duyệt board**. Khi vào Chờ duyệt, coordinator gốc spawn một Orca worker theo `docs/agents/workflows/dispatch.md` đóng vai người duyệt (khác session implementer). Chi tiết: `docs/agents/policies/project.md`.

## 3. Vai trò phụ trách

| Nhóm                      | Ownership                                                                                                                                    | Không tự ý                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Coordinator gốc           | Trực tiếp spawn planner/workers/reviewers; dispatch, lifecycle, Project sync, root tooling, lockfile, CI, contracts, integration đã ủy quyền | Không đổi nghiệp vụ đã freeze chỉ để giải conflict |
| Epic planner              | Phân Epic → Story → Task, theo dõi phụ thuộc, chuẩn bị spec và nghiệm thu                                                                    | Không spawn worker con, tự đóng Epic hoặc merge    |
| Backend                   | `apps/api`, `apps/worker`, `packages/backend`, schema/migrations, RLS tests                                                                  | UI web/mobile; contract chưa thống nhất            |
| Web                       | `apps/web`                                                                                                                                   | Database, auth policy, native app                  |
| Portal                    | `apps/portal` — slice độc lập với attendee web                                                                                               | Backend rules, attendee web/mobile                 |
| iOS                       | `apps/mobile`                                                                                                                                | Backend rules, web, store submission ngoài task    |
| QA / Security (hardening) | Review độc lập RLS/authz/races, load, restore                                                                                                | Không tự viết lại kiến trúc trong task review      |

Catalog chuyên môn Orca (Role ID gắn Task Spec, không `alwaysApply`): [docs/agents/README.md](./agents/README.md) — `product-ba`, `product-design`, `backend`, `web`, `ios`, `reviewer-dod`, `reviewer-security`.

## 4. Đợt bàn giao — phạm vi và gate

D0–D10 dưới đây là mapping phạm vi đã chốt O10, không chứa trạng thái live. Các scope sau đó (D11/D13/Portal/#914/F04/Pilot) theo kế hoạch và quyết định được dẫn ở §1.

### 4.1 Gate bắt buộc mỗi Milestone khi áp dụng

1. UAT theo AC qua [Orca browser/emulator](agents/workflows/uat.md); evidence physical camera/push vẫn bắt buộc khi Task yêu cầu.
2. Local iOS build/signing khi chạm mobile; không Expo/EAS Cloud Build.
3. Production deploy chỉ khi Task authorize; local/CI không chứng minh deployed.
4. Evidence đúng source/tested SHA, lệnh, kết quả và hạn chế. O33 áp dụng đúng scope waiver.
5. [DoD A/B và Project](agents/policies/project.md), [review/revalidation](agents/workflows/review.md), CI integrated SHA theo phạm vi.
6. Code complete, acceptance complete và pilot ready là ba kết luận riêng.

| Đợt | Tên                       | Mục tiêu                                                                                | Gate chuyên biệt                                                                      |
| --- | ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| D0  | W0 Foundation             | Monorepo, CI, Compose, API health, RLS prototype, web/iOS shell                         | Foundation integrated; no EAS Cloud Build policy                                      |
| D1  | Quyết định & Identity     | O01–O08 liên quan, OIDC, membership/revocation proof                                    | Identity spike đạt criteria trước khi mở business endpoints                           |
| D2  | Nhận vé xuyên web/app     | Mã/quota/issue/outbox + web redeem + iOS ví API thật                                    | Demo đổi vé web → thông báo → cùng user mở vé trên app; concurrency quota/idempotency |
| D3  | Check-in                  | Gate reserve/confirm/recovery chỉ iOS Staff (O23)                                       | Hai thiết bị / race / recovery; camera physical có thể tách D5 nếu ghi rõ             |
| D4  | Admin & Platform          | Permissions, import, approval, config publish, CS, reporting, app feature còn lại       | Tenant thứ hai tự tạo event/brand qua admin, không hardcode pilot                     |
| D5  | Hardening & phát hành     | Security review, capacity, restore, device UAT, local signed iOS / TestFlight           | Evidence đạt technical design; publish/store là task riêng → **pilot ready**          |
| D6  | Hoàn thiện UX/UI          | Polish brand + IA/states trên web/iOS; a11y UAT theo O33                                | Brand test + headless/sim screenshots; không gộp D5 hardening                         |
| D7  | Offline Gate multi-device | Check-in / Gate hoạt động khi nhiều thiết bị và mất mạng có kiểm soát (theo design đợt) | Multi-device + offline/reconcile evidence; không mở Android/payment                   |
| D8  | White-label               | Branding / cấu hình app theo tenant trong một codebase (không fork)                     | Tenant brand smoke + config version; không store submit                               |
| D9  | Demo seed + UX/media      | Seed data đủ demo end-to-end; UX/UI còn lại; thiết kế media                             | Demo script + media assets; headless/sim screenshots                                  |
| D10 | App Store metadata        | Privacy Nutrition Labels, screenshots, review notes, local signed archive               | Metadata + archive sẵn; **không** submit trừ task ủy quyền riêng                      |

## 5. Ánh xạ module PRD → đợt

| Module | Tên                            | Đợt chính                                                       | Phụ thuộc trước                    |
| ------ | ------------------------------ | --------------------------------------------------------------- | ---------------------------------- |
| M01    | Tenant và cách ly dữ liệu      | D0 (prototype) → D1/D4 (đầy đủ)                                 | —                                  |
| M02    | Identity và quyền              | D1                                                              | Quyết định provider; O01/O02       |
| M03    | Event lifecycle                | D2 skeleton → D4 đầy đủ                                         | M01, M02                           |
| M04    | Branding và nội dung           | D0 fixture → D4 publish → **D6 polish platform+event surfaces** | M03                                |
| M05    | Loại vé, nguồn phát, quota     | D2                                                              | M03; identity verified trước issue |
| M06    | Import mã và khách mời         | D4                                                              | M05                                |
| M07    | Redemption và duyệt            | D2 (auto-approve) → D4 (duyệt thủ công)                         | M05, M02                           |
| M08    | Ticket và ví vé                | D2                                                              | M07                                |
| M09    | Email và push                  | D2 (email sandbox) → D4 (push/retry)                            | Outbox; M08                        |
| M10    | Gate và check-in               | D3 → **D7 offline multi-device**                                | M08                                |
| M11    | CS, báo cáo, vận hành          | D3 tối thiểu → D4                                               | M07–M10                            |
| M12    | Platform Operations            | D4–D5                                                           | M01                                |
| M04+   | Branding / white-label mở rộng | D4 publish → D6 polish → **D8 white-label**                     | M04, O01/O10                       |
| —      | Demo seed & media              | **D9**                                                          | D4–D6                              |
| —      | Store metadata (không submit)  | **D10**                                                         | D5 local signed + D6 surfaces      |

## 6. Backlog và tiến độ

Issue/sub-issue và Status lấy Project #3; không giữ bản sao checklist động trong roadmap. Checkbox và bảng board D0–D10 cũ được giữ trong [snapshot](archive/roadmap/ROADMAP-before-cleanup-2026-11-03.md). Chúng không cấp quyền dispatch mới.

## 7. Quyết định còn mở

Đối chiếu Decision Log và Task cụ thể trước khi quyết định. Danh sách Oxx ở roadmap cũ là lịch sử; không tự mở lại câu hỏi đã được owner chốt. Thiếu contract/approval thì checkpoint và hỏi đúng owner.

## 8. Tracking và thực thi

Titles/status/comments tiếng Việt; giữ IDs/API/SHAs. GitHub Project là nguồn dài hạn, Orca Run/Task/Dispatch là lần giao thực hiện. Coordinator tuân [dispatch](agents/workflows/dispatch.md), ownership, quota và WIP; không mở feature ngoài roadmap đã review.

## 9. Liên kết vận hành

- [Runbook](ops/RUNBOOK.md), [release bất biến](ops/IMMUTABLE-RELEASE.md), [deploy pipeline](ops/DEPLOY-PIPELINE.md).
- [Nguồn design theo surface](design/README.md); [docs index](README.md).
- [Archive foundation/run logs](archive/README.md).

## 10. Lịch sử

Approval và checkpoint cũ được giữ đầy đủ trong [snapshot roadmap](archive/roadmap/ROADMAP-before-cleanup-2026-11-03.md); không rewrite evidence hoặc gán lại SHA.
