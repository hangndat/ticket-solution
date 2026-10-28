# Roadmap — Event Ticketing Platform

> **Mới 28/10/2026 — Pilot/UAT tách khỏi #914:** tracking Pilot ready / PROD-LAUNCH-UAT trên Epic [#1008](https://github.com/hangndat/ticket-solution/issues/1008) (Project #3 `Chưa lên lịch`; **chưa** ủy quyền chạy `launch-uat`). [#914](https://github.com/hangndat/ticket-solution/issues/914) giữ CLOSED · Hoàn thành với known gap «chưa pilot-ready» — **không** reopen #914, **không** suy pilot ready từ đóng #914. D13/store: [#301](https://github.com/hangndat/ticket-solution/issues/301) / [#310](https://github.com/hangndat/ticket-solution/issues/310).

> **Mới 28/10/2026 — O28 / Epic [#914](https://github.com/hangndat/ticket-solution/issues/914):** Guest NativeTabs **Sự kiện + Đổi mã** (catalog public; không Tài khoản, không Vé). Verified: **Sự kiện + Đổi mã + Vé của tôi**. Đổi mã là **tab** (không CTA footer Events). Header guest → OIDC «Đăng nhập»; verified → `/account`. Deep link `/redeem` và `/redeem-global` → tab. Privacy native, staff header-only event switch, banner per-event, USB skill giữ [O27](./DECISION-LOG.md) (O27 §3–§4 guest-no-tabs **đã sửa** bởi O28). VoiceOver ngoài #914.

> **S6 giấy nghiệm thu 27/10/2026 — Epic [#914](https://github.com/hangndat/ticket-solution/issues/914):** UAT + CI trên SHA `2645999f0ad535276b63a95c6c96bace9cff025e` (29/29 check-runs). Story S6 [#921](https://github.com/hangndat/ticket-solution/issues/921) / T01 [#946](https://github.com/hangndat/ticket-solution/issues/946) / T02 [#947](https://github.com/hangndat/ticket-solution/issues/947) / T03 [#948](https://github.com/hangndat/ticket-solution/issues/948) đóng theo comment GitHub. **Code complete** SHA này. **Acceptance complete trong scope S6** với known gap (VoiceOver/Dynamic Type owner skip; revoke giữa ca không chạy; TestFlight 1.0.0 (28) catalog PASS, OIDC login fail-closed — không chờ KEYRING). Cutover prod 5 service live cùng SHA. Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) sau đó **CLOSED · Hoàn thành** (known gap «chưa pilot-ready»); Pilot/UAT theo dõi [#1008](https://github.com/hangndat/ticket-solution/issues/1008) — **không** blocking #914. Status live: Project #3.

> **Mới 26/10/2026 — O25 / Epic [#914](https://github.com/hangndat/ticket-solution/issues/914):** hoàn thiện sản phẩm cốt lõi và UX tự phục vụ. Roadmap thực thi canonical: [`plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md`](./plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md). `apps/portal` và `apps/web` là hai slice riêng; attendee web không cold-offline trong Epic này. Nợ #901/#903/#904/AR891-INT-F01 vẫn hoãn. **iOS VoiceOver ngoài phạm vi #914 / quyết định owner** — không AC S6/UAT, không known gap.

> **Quyết định mới 24/10/2026 — O23:** bỏ Web Gate, Gate admission chỉ trên iOS Staff. Hướng thiết kế tại [`vemoki-unified-v1`](./design/vemoki-unified-v1/README.md) được chốt ở mức design; các checkpoint Web Gate lịch sử bên dưới giữ làm bằng chứng phạm vi cũ. D-6 đã xóa route `/gate` web; các link/copy cũ và direct-route behavior cần Task Spec, contract/ADR, review và nghiệm thu riêng trước khi coi migration hoàn tất. Chưa coi là acceptance complete hay pilot ready.

> **Cập nhật phát hành 24/10/2026:** [Production đã triển khai và iOS đã build](reviews/DEPLOY-PROD-UI859-2026-10-24.md); [build 1.0.0 (27) đã lên Internal TestFlight](reviews/TESTFLIGHT-UI859-BUILD27-2026-10-24.md). Web có hotfix CSS `0304364`, đã kiểm tra trực tiếp marketing/app/redeem ở 1280px và 390px. Các dòng “chưa deploy/store” bên dưới là checkpoint trước phát hành; chưa có public App Store release hoặc kết luận pilot ready.

> **#859 — đã sửa và tích hợp, 24/10/2026: Code complete, nghiệm thu local trong scope và integration complete PASS.** PR #862/#863/#864/#865 đã merge; main `c466343aeea75c3fe303e8ee885632ec44afce2c`, review độc lập exact SHA và [CI đầy đủ](https://github.com/hangndat/ticket-solution/actions/runs/40056730975) PASS (18 shard DB, ba bài D5). [Issue #859](https://github.com/hangndat/ticket-solution/issues/859) CLOSED. Source113 cùng ba delta UI tích hợp có source map và native smoke; giữ toàn bộ lịch sử 2/2 + ngoại lệ/resumes/privacy/barrier/gói durable20/45/30, không reset. [Báo cáo](reviews/UI-FIXALL-2026-10-23.md). Chưa pilot ready/deploy/store; giới hạn M09 physical APNs/crash-inflight và PKCE/MFA giữ nguyên. Project #3 chưa sync do thiếu read:project.

> **#859 — phê duyệt bổ sung24/10/2026:** user “duyệt, fix hết đi” cho phần còn lại sau batch lifecycle: History/pending iOS, recovery M10 qua restart offline và contract/API đọc receipt offline có scope khi cần. Giới hạn lookup theo operation gốc, actor/tenant/event/staff-session ownership/current assignment; không mở manual lookup/search rộng hay cấp admission từ historical receipt. Theo [quyết định thực thi](../.orca-metrics/fix-all/DECISION-F02-FULL-2026-10-24.md), contract phải được chốt và review bảo mật trước coding phụ thuộc. Không gồm production/store/cloud build hoặc Git integration.

> **PORTAL P0 + P1 đã duyệt 18/10/2026:** Epic [#406](https://github.com/hangndat/ticket-solution/issues/406), [roadmap PORTAL](./plans/PORTAL-ROADMAP.md). Triển khai `portal.vemoki.com` bằng Next `apps/portal` riêng trong monorepo, Ant Design thuần tiếng Việt; Web Gate giữ `app.` trong đợt đầu, Platform zone tách client/audience/session. Bao gồm parity admin và API gaps/audit/ops theo gói; cho phép PR/review/CI/coordinator integration. Không production DNS/deploy/cutover/cloud/store từ approval này. Status từng Task lấy Project #3, không trộn D12/D13; không tuyên bố pilot ready từ code/build.

> **D13 được duyệt 18/10/2026:** [Epic #301](https://github.com/hangndat/ticket-solution/issues/301), [kế hoạch phát hành App Store](./plans/D13-APP-STORE-RELEASE-PLAN.md). Đích là app công khai tải được trên App Store với URL/version/territory và exact-SHA evidence. Approval này cho phép workflow end-to-end gồm PR/review/CI/integration và store upload/submit/release sau mandatory gates; không cấp quyền tạo cloud resources hay dùng EAS Cloud Build. Territory chưa chốt. Trạng thái động lấy Project #3, không suy từ các snapshot lịch sử phía dưới.

> **Seed prod Epic [#686](https://github.com/hangndat/ticket-solution/issues/686) (21/10/2026):** 4 org (1/2/3/0 event), 6 event khung giờ khác nhau, staff plus-address, bộ media raster `brand/prod`. PR #688–#692, #695 chờ DoD/security review; chưa merge, chưa chạy prod (cần owner xác nhận theo `docs/ops/PROD-SEED-RUNBOOK.md`). Trạng thái động lấy Project #3.
> D13 tái sử dụng D10 metadata/archive prep và D12 release work theo SHA, revalidate trên binary cuối. Runtime preflight: [evidence](./reviews/D13-S2-T1-RUNTIME-PREFLIGHT.md). SMTP Mailpit không chứng minh email đến inbox thật; chưa có go/no-go phát hành. Các giới hạn “không store submit” trong scope D10/D11 vẫn là lịch sử của các đợt đó; D13 có mục tiêu publish được user giao và duyệt riêng.

> **Đã duyệt triển khai ngày 18/10/2026:** user trả lời “duyệt” cho gói D11. Phạm vi thực thi: web admin theo công việc/readiness; iOS Gate feedback/offline/conflict; attendee web/iOS nhận vé/QR/recovery; brand-test đa tenant và a11y trong các bề mặt đó. Thứ tự wave: web admin ∥ iOS Gate, rồi attendee theo slot ownership. Cho phép workflow feature branch → PR → review độc lập → CI → coordinator integration theo git-workflow. Validate-only/manual lookup, metrics mới, O06 số liệu, publish privacy, production deploy và store submit **không** được tự mở từ phê duyệt này. Các phần “chưa approved” bên dưới là snapshot proposal trước phê duyệt; Task Spec cụ thể và comment approval trên #222 là authority thực thi.

> **Đối chiếu live 18/10/2026 — cập nhật D11:** Project #3 xác nhận D0–D10 **Hoàn thành**; tại checkpoint trước D11 có 100/101 item Hoàn thành, item #7 là phạm vi hủy. `main` đối chiếu: `3e61cde42d55654897048d6d627ab6834b54b808`. Các bảng snapshot ngày 17/10 bên dưới giữ làm lịch sử; không dùng để suy ra trạng thái hiện tại.
>
> **Định hướng mở rộng được user giao ngày 18/10:** đẩy mạnh UX/UI và giao BA/PD nghiên cứu, thiết kế cho vận hành production. Mở **D11 — nghiên cứu và thiết kế UX/UI production** ([Epic #222](https://github.com/hangndat/ticket-solution/issues/222)); pha discovery/design đang thực hiện. Phạm vi tính năng, thứ tự ưu tiên và thiết kế chi tiết là **đề xuất để user review trước feature coding**. Kế hoạch: [D11-UX-PRODUCTION-PLAN](./plans/D11-UX-PRODUCTION-PLAN.md); nghiên cứu: [D11-BA-RESEARCH](./plans/D11-BA-RESEARCH.md); thiết kế: [D11-PRODUCTION-UX-UI](./design/D11-PRODUCTION-UX-UI.md).
>
> **Gate D11:** (1) BA nêu pain có nguồn, journeys, ưu tiên và AC/metrics; (2) PD bàn giao flow/state/a11y/UI AC/handoff + prototype tương tác đánh dấu demo; (3) planner chia Epic→Story→Task theo ownership, role/path, dependency thật và wave; (4) user review roadmap trước coding. Research/design complete không phải code complete, acceptance complete hay pilot ready. Không tự deploy production hoặc submit store. Các phạm vi hủy O10 giữ nguyên. O06 retention và các gap phát hành phải được đánh giá bằng evidence khi lập release gate.

Ngày cập nhật nội dung: 2026-10-17
Đối chiếu live: `origin/main` `7c1abae72ab0d847e2a909d2da3ed2323edacf94` (MinIO/APNs D5 [#101](https://github.com/hangndat/ticket-solution/pull/101); D6 web [#92](https://github.com/hangndat/ticket-solution/pull/92) / iOS [#93](https://github.com/hangndat/ticket-solution/pull/93) / docs [#94](https://github.com/hangndat/ticket-solution/pull/94)) và [GitHub Project #3](https://github.com/users/hangndat/projects/3) cùng ngày.
Nguồn phạm vi: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md), [Decision Log](./DECISION-LOG.md) (O10 — MVP mở rộng), [Agent Development Plan](./AGENT-DEVELOPMENT-PLAN.md), [W0 report](./W0-FOUNDATION-REPORT.md).
Tracking lâu dài: GitHub Issues + Project (tiếng Việt). Orca Task/Dispatch chỉ là lần giao thực thi.

**Chưa chốt lịch / thời lượng.** Không gắn ngày giả. Timeline Project có thể tạo view trước; ngày mục tiêu để trống đến khi người dùng chốt.

## 0. Ai là nguồn trạng thái động?

| Artifact                                                       | Vai trò                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Project #3](https://github.com/users/hangndat/projects/3)** | **Nguồn trạng thái động** (Status Issues: Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành). Agent/coordinator đồng bộ board theo sự kiện — không chờ user duyệt từng bước Status.                   |
| **Roadmap này**                                                | Phạm vi đợt, gate nghiệm thu, ánh xạ module, Definition of Done, hạn chế bằng chứng (proof limits). **Không** thay Status live trên Project. Khi checkbox §6 lệch board, **board thắng**; sửa roadmap trong PR docs riêng. |
| **GitHub Milestone**                                           | Nhóm đợt; `open`/`closed` của milestone có thể chậm hơn Status Project — không dùng milestone state làm authority.                                                                                                         |
| **Orca `worker_done`**                                         | Chỉ báo worker kết thúc attempt — **không** = Hoàn thành trên Project.                                                                                                                                                     |

**Roadmap đã được user duyệt lần đầu (2026-10-16)** — đóng D0 và mở D1. Các đoạn “đợt tiếp theo = D1 / chưa mở business endpoints” bên dưới §10 là **lịch sử**; không còn mô tả hiện tại.

**Trọng tâm hiện tại (Project #3, 2026-10-17):** parent **D5 (#6)** đang **Đang làm** (Gate camera staff + push DELIVERED; MinIO/APNs prod). Parent **D0–D4 (#1–#5)** và **D6 UX/UI (#81)** đã **Hoàn thành**/closed — Tenant 2 prod UAT: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md); D6 web [#92](https://github.com/hangndat/ticket-solution/pull/92) / iOS [#93](https://github.com/hangndat/ticket-solution/pull/93) / docs [#94](https://github.com/hangndat/ticket-solution/pull/94). **MVP mở rộng (O10):** sau D5 còn D7–D10 (Offline Gate multi-device → White-label → Demo seed/UX-media → App Store metadata). Issue [#7](https://github.com/hangndat/ticket-solution/issues/7) sẽ được **rewrite** trên board (worker GitHub) — không còn backlog “Android/payment/seat/Wallet trong MVP”. Không tuyên bố pilot production / store submission sẵn sàng.

## 1. Trạng thái hiện tại (tóm tắt theo Project + main)

Cột **Board** = Status parent Issue trên Project #3 tại thời điểm đối chiếu. Chi tiết sub-issue luôn lấy từ board.

| Mục                              | Board (parent)                             | Mức hoàn thành                                                    | Ghi chú / proof limits                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0 Foundation                    | **Hoàn thành** (#1)                        | Nghiệm thu đợt                                                    | Prototype — **không** = production auth hay ticketing xong. Evidence: [W0-FOUNDATION-REPORT](./W0-FOUNDATION-REPORT.md)                                                                                                                                                                                                                                                                                                             |
| Identity / OIDC (D1)             | **Hoàn thành** (#2)                        | Nghiệm thu đợt                                                    | Keycloak self-host; gỡ Clerk. Live P4 smoke: [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md). O06 **đã chốt** 2026-10-18 — [DECISION-LOG](./DECISION-LOG.md)                                                                                                                                                                                                                                                              |
| Nhận vé (D2)                     | **Hoàn thành** (#3)                        | Nghiệm thu đợt                                                    | Mã/quota/issue/outbox + web redeem + iOS ví đã có trên `main` (PRs #30–#32…)                                                                                                                                                                                                                                                                                                                                                        |
| Check-in (D3)                    | **Hoàn thành** (#4)                        | Nghiệm thu đợt (có ngoại lệ UAT)                                  | Gate + web Gate + iOS scan/recovery trên `main`. **Camera thiết bị thật** hoãn sang D5 (#26) — không ghi là UAT camera physical đã PASS                                                                                                                                                                                                                                                                                             |
| Admin & Platform (D4)            | **Hoàn thành** (#5)                        | Nghiệm thu đợt (PASS with known gap)                              | Tenant 2 prod: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md). Gap CSRF invite UI / MinIO export / invite email → theo dõi D5 ops                                                                                                                                                                                                                                                                                       |
| Hardening / UAT / phát hành (D5) | **Đang làm** (#6)                          | Child #24/#25/#26/#56 **Hoàn thành** trên board; parent chưa đóng | Còn Gate camera staff + push **DELIVERED** trên thiết bị (TF 0.1.0 (7)); MinIO/APNs wiring đã có [#101](https://github.com/hangndat/ticket-solution/pull/101) — còn gắn/verify prod. Build native **chỉ** local Xcode; **cấm** Expo/EAS Cloud Build                                                                                                                                                                                 |
| UX/UI polish (D6)                | **Hoàn thành** (#81)                       | Nghiệm thu đợt (acceptance)                                       | Web [#92](https://github.com/hangndat/ticket-solution/pull/92) · iOS [#93](https://github.com/hangndat/ticket-solution/pull/93) · docs S7 [#94](https://github.com/hangndat/ticket-solution/pull/94). #82–#85/#87–#89 + parent #81 closed; Milestone #8 closed. Plan [`D6-UX-UI-PLAN.md`](./plans/D6-UX-UI-PLAN.md). **Không tuyên bố lại từ đầu** — status lấy từ Project. **Proof limits:** D6 ≠ pilot ready / store / production |
| Offline Gate multi-device (D7)   | **Chưa lên lịch** (Issue mới / #7 rewrite) | Trong MVP mở rộng                                                 | Đồng bộ board sau rewrite #7 — docs mô tả phạm vi; không spawn coding trước khi Issue sẵn sàng                                                                                                                                                                                                                                                                                                                                      |
| White-label (D8)                 | **Chưa lên lịch**                          | Trong MVP mở rộng                                                 | App/branding theo tenant trong phạm vi O10; không Android native                                                                                                                                                                                                                                                                                                                                                                    |
| Demo seed + UX/media (D9)        | **Chưa lên lịch**                          | Trong MVP mở rộng                                                 | Seed data đủ demo; UX/UI còn lại + thiết kế media                                                                                                                                                                                                                                                                                                                                                                                   |
| App Store metadata (D10)         | **Chưa lên lịch**                          | Trong MVP mở rộng                                                 | Privacy, screenshots, review notes, local signed archive — **không** submit store trừ task riêng ủy quyền                                                                                                                                                                                                                                                                                                                           |
| Ngoài phạm vi có chủ đích        | — (#7 sau rewrite)                         | **Không** làm trong MVP                                           | Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet — xem §6                                                                                                                                                                                                                                                                                                                                                |

### 1.1 Ba mức hoàn thành (bắt buộc phân biệt)

| Mức                                            | Nghĩa                                                                                                                                                                                                        | Không được suy ra                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Code complete**                              | Implementation đã merge `main` (hoặc PR sẵn), CI liên quan xanh trên commit tích hợp                                                                                                                         | Chưa đủ **Hoàn thành** Epic phát hành. Task docs/tooling (nhánh A) có thể đóng sau CI + SHA, không bắt buộc reviewer độc lập |
| **Acceptance complete** (board **Hoàn thành**) | Đủ DoD §2: review độc lập (khi security-sensitive), merge, CI, evidence đúng tiêu chí Issue                                                                                                                  | Chưa = sẵn sàng pilot / production / store                       |
| **Pilot ready**                                | Gate D5 đạt theo technical design: security/capacity/restore có số liệu rõ; UAT thiết bị thật (camera, deep link, push, offline ví, revoke) với build **local signed**; runbook; chỉ số chưa đạt được nêu rõ | Demo pass, Simulator-only, hoặc `ACCEPTED` APNs **không** đủ     |

### 1.2 Ngoại lệ UAT thiết bị thật & hạn chế bằng chứng

- **Headless UAT** (Playwright / `scripts/web-uat.sh`, AXe / `scripts/sim-uat.sh`, Orca embedded browser) là mặc định agent — **không** thay thế UAT camera/push trên **thiết bị vật lý** khi Issue yêu cầu (#26).
- Pass **Simulator** / Expo Go ≠ Pass TestFlight / device signed.
- `./scripts/d5-backup-drill.sh` PASS chỉ chứng minh fixture còn sau `pg_dump`/restore trên Postgres vứt bỏ — **không** backup production, **không** SLO.
- Push: đăng ký token / outbox `ACCEPTED` ≠ `DELIVERED` đến thiết bị.
- Không dùng EAS Cloud Build làm bằng chứng phát hành.

## 2. Định nghĩa hoàn thành (Definition of Done)

Một đầu việc trên board chỉ chuyển **Hoàn thành** khi:

1. Đã review (security-sensitive: reviewer khác tác giả / khác session implementer).
2. Đã tích hợp vào nhánh tích hợp (`main`).
3. CI pass trên commit tích hợp (check + database-isolation khi liên quan).
4. Có evidence nghiệm thu đúng tiêu chí Issue (lệnh, log, test, SHA — không chỉ `worker_done`).

`worker_done` / Dispatch settled **không** đồng nghĩa task đã hoàn thành trên GitHub Project.

**Agent sync (bắt buộc):** Cập nhật Status Project theo sự kiện (Đang làm / Chờ duyệt / Bị chặn / Hoàn thành) **không chờ user duyệt board**. Khi vào Chờ duyệt, coordinator gốc spawn một Orca worker theo `.cursor/rules/orca-agent-routing-coordinator.mdc` đóng vai người duyệt (khác session implementer). Chi tiết: `.cursor/rules/github-project-tracking.mdc`.

## 3. Vai trò phụ trách

| Nhóm                      | Ownership                                                                                                                                    | Không tự ý                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Coordinator gốc           | Trực tiếp spawn planner/workers/reviewers; dispatch, lifecycle, Project sync, root tooling, lockfile, CI, contracts, integration đã ủy quyền | Không đổi nghiệp vụ đã freeze chỉ để giải conflict |
| Epic planner              | Phân Epic → Story → Task, theo dõi phụ thuộc, chuẩn bị spec và nghiệm thu                                                                    | Không spawn worker con, tự đóng Epic hoặc merge    |
| Backend                   | `apps/api`, `apps/worker`, `packages/backend`, schema/migrations, RLS tests                                                                  | UI web/mobile; contract chưa thống nhất            |
| Web                       | `apps/web`                                                                                                                                   | Database, auth policy, native app                  |
| iOS                       | `apps/mobile`                                                                                                                                | Backend rules, web, store submission ngoài task    |
| QA / Security (hardening) | Review độc lập RLS/authz/races, load, restore                                                                                                | Không tự viết lại kiến trúc trong task review      |

Catalog chuyên môn Orca (Role ID gắn Task Spec, không `alwaysApply`): [docs/agents/README.md](./agents/README.md) — `product-ba`, `product-design`, `backend`, `web`, `ios`, `reviewer-dod`, `reviewer-security`.

## 4. Đợt bàn giao (Milestones) — phạm vi & gate

Gợi ý từ kế hoạch agent; cổng identity trước business đã **đi qua** (D1 Hoàn thành trên board).
**MVP mở rộng (O10, 2026-10-17):** D0–D10. Các mục **hủy khỏi kế hoạch MVP** (Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet) nằm ở §6 «Ngoài phạm vi có chủ đích» — không đưa vào backlog đợt D0–D10.

### 4.1 Gate bắt buộc mỗi Milestone (D0–D10 khi áp dụng)

Trước khi parent đợt chuyển **Hoàn thành** trên Project #3, phải có đủ (ghi rõ SHA / artifact; không chỉ `worker_done`):

1. **Headless UAT** — web (`scripts/web-uat.sh` / Playwright headless) và/hoặc iOS Simulator (`scripts/sim-uat.sh` / AXe) theo phạm vi đợt; không dùng mouse desktop người dùng.
2. **Local iOS build** — prebuild + Xcode/`xcodebuild` local; **cấm** Expo/EAS Cloud Build.
3. **Deploy prod** — chỉ khi task/coordinator **ủy quyền** rõ; nếu chưa authorize thì ghi “chưa deploy” + lý do, không tự deploy.
4. **Bằng chứng UAT / artifact** — log, screenshot path (vd. `apps/web/.uat-artifacts/`, `apps/mobile/.uat-artifacts/`), Issue/PR comment hoặc `docs/reviews/*` kèm exact SHA.
5. **Cập nhật GitHub Project** — Status parent/sub-issue đúng sự kiện (Đang làm → Chờ duyệt → Hoàn thành); board là authority.

Gate chuyên biệt từng đợt (bảng dưới) **bổ sung**, không thay thế 4.1.

| Đợt | Tên                       | Mục tiêu                                                                                | Gate chuyên biệt                                                                      | Board (2026-10-17)                       |
| --- | ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| D0  | W0 Foundation             | Monorepo, CI, Compose, API health, RLS prototype, web/iOS shell                         | Foundation integrated; no EAS Cloud Build policy                                      | Hoàn thành                               |
| D1  | Quyết định & Identity     | O01–O08 liên quan, OIDC, membership/revocation proof                                    | Identity spike đạt criteria trước khi mở business endpoints                           | Hoàn thành                               |
| D2  | Nhận vé xuyên web/app     | Mã/quota/issue/outbox + web redeem + iOS ví API thật                                    | Demo đổi vé web → thông báo → cùng user mở vé trên app; concurrency quota/idempotency | Hoàn thành                               |
| D3  | Check-in                  | Gate reserve/confirm/recovery + web Gate + iOS scan                                     | Hai thiết bị / race / recovery; camera physical có thể tách D5 nếu ghi rõ             | Hoàn thành (UAT camera device → #26)     |
| D4  | Admin & Platform          | Permissions, import, approval, config publish, CS, reporting, app feature còn lại       | Tenant thứ hai tự tạo event/brand qua admin, không hardcode pilot                     | Hoàn thành                               |
| D5  | Hardening & phát hành     | Security review, capacity, restore, device UAT, local signed iOS / TestFlight           | Evidence đạt technical design; publish/store là task riêng → **pilot ready**          | Đang làm                                 |
| D6  | Hoàn thiện UX/UI          | Polish brand Vemoki + IA/states/a11y trên web & iOS đã có chức năng                     | Brand test + headless/sim screenshots; không gộp D5 hardening                         | Hoàn thành (#81 closed; PRs #92/#93/#94) |
| D7  | Offline Gate multi-device | Check-in / Gate hoạt động khi nhiều thiết bị và mất mạng có kiểm soát (theo design đợt) | Multi-device + offline/reconcile evidence; không mở Android/payment                   | Chưa lên lịch                            |
| D8  | White-label               | Branding / cấu hình app theo tenant trong một codebase (không fork)                     | Tenant brand smoke + config version; không store submit                               | Chưa lên lịch                            |
| D9  | Demo seed + UX/media      | Seed data đủ demo end-to-end; UX/UI còn lại; thiết kế media                             | Demo script + media assets; headless/sim screenshots                                  | Chưa lên lịch                            |
| D10 | App Store metadata        | Privacy Nutrition Labels, screenshots, review notes, local signed archive               | Metadata + archive sẵn; **không** submit trừ task ủy quyền riêng                      | Chưa lên lịch                            |

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

## 6. Backlog đầu việc (checkbox = tiến độ docs; Status live = Project)

Mỗi nhóm tương ứng parent Issue trên GitHub; sub-issues mang tiêu chí nghiệm thu cụ thể.
**Cập nhật Status luôn theo Project #3.** Checkbox dưới đây phản ánh evidence đã ghi trên `main` / Issue tại lần đối chiếu `ed6f0dd` — nếu lệch board, sửa docs, không “sửa” thực tế bằng cách đánh dấu sớm.

### D0 — W0 Foundation (board: Hoàn thành)

- [x] Xác nhận W0 foundation đủ để đóng đợt — Issues #1/#9
- [x] Bảo toàn commit/policy/lockfile trên remote `main` và CI Node 24 có iOS JS export — Issue #8

### D1 — Quyết định & Identity (board: Hoàn thành)

- [x] Chốt / ghi log O01–O08 — [DECISION-LOG.md](./DECISION-LOG.md), Issue #10
- [x] Spike OIDC → **Keycloak**; gỡ Clerk — Issue #11 / PR #28
- [x] Membership tenant/event + deny-by-default; thu hồi — Issue #12
- [x] Session web BFF + iOS SecureStore — Issue #13
- [x] Live P4 smoke Keycloak local — [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md)
- [x] Mở D2 sau identity proof — parent #2/#3 Hoàn thành trên Project (lịch sử: từng chặn business endpoints trước P4)

### D2 — Nhận vé (board: Hoàn thành)

- [x] Backend: mã/quota → issue → ticket → outbox/email — #14
- [x] Web: form đổi mã, verify, success/ticket API thật — #15
- [x] iOS: My Tickets, QR, cache; đồng bộ identity — #16
- [x] Kiểm thử độc lập quota/idempotency — #17

### D3 — Check-in (board: Hoàn thành)

- [x] Backend Gate: staff session, reserve/confirm/status, revoke/undo, audit — #18
- [x] Web Gate dự phòng + CS lookup tối thiểu — #19
- [x] iOS: dedupe và recovery sau restart/mạng — #20. **Camera thiết bị thật → D5 #26**
- [x] Race / timeout recovery theo test Postgres; unknown trên web/iOS theo quyết định sản phẩm

### D4 — Admin & Platform (board: Hoàn thành)

- [x] Backend platform (permissions, import, approval, config publish, reporting) — #21; PRs #38/#43/#48
- [x] Web admin đầy đủ (#22) — board Hoàn thành
- [x] iOS hoàn thiện (#23) — board Hoàn thành; APNs client trên `main`; device UAT theo dõi #26/#6
- [x] Backend D4/D5 còn lại (#56) — board Hoàn thành
- [x] Tenant thứ hai self-serve trên prod — PASS with known gap: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md) (tenant `26c16ee9…` / event `5295ef1a…` / ticket `7d8c18df…`). Gap CSRF invite / MinIO export / invite email → D5 ops

### D5 — Hardening & phát hành (board: Đang làm)

- [x] Review/test độc lập RLS, authorization, transaction races — Issue #24; PR #47
- [x] Backup/restore + obs/load drills (board #25 Hoàn thành) — evidence [D5-ISSUE-25-EVIDENCE.md](./reviews/D5-ISSUE-25-EVIDENCE.md). **Proof limits:** continuous RPO/RTO prod và SLO prod **chưa** claim.
- [x] UAT thiết bị / TestFlight partial (#26 closed trên board) — ví/offline/deep link PASS; **Gate camera staff + push DELIVERED còn mở trên parent #6** (TF `0.1.0 (7)`; Part C từng BLOCKED session signed-out trên build 5)
- [x] Runbook, release checklist, O06 options — `docs/ops/RUNBOOK.md`, `RELEASE-CHECKLIST.md`, `O06-OPTIONS.md`
- [ ] **Parent #6 còn lại:** Gate camera admit trên thiết bị thật (staff session) + push **DELIVERED** (APNs key chưa gắn VPS) + MinIO export prod; không tuyên bố pilot ready

### D6 — Hoàn thiện UX/UI (board: Hoàn thành)

- [x] Tokens & design contract — D6-S1 (#82) — closed; consumed by PR #92 + #93
- [x] Web guest / redeem / claim / event — D6-S2 (#83) — merge PR [#92](https://github.com/hangndat/ticket-solution/pull/92) `eb0d0784f300571dc7a557c0db3ecd865c4e9cfe` (DoD PASS w/ gaps @ `ec8eac6…`)
- [x] Web gate & account — D6-S3 (#84) — cùng PR #92
- [x] Web admin & platform — D6-S4 (#85) — cùng PR #92
- [x] iOS theme + Events/Redeem/Claim — D6-S5 (#87) — merge PR [#93](https://github.com/hangndat/ticket-solution/pull/93) `b93124b58eb1740d263fc5191ddd9a9aad4506f6` (DoD PASS w/ gaps @ `a3eabf2…`)
- [x] iOS ví + Staff scan UX — D6-S6 (#88) — cùng PR #93
- [x] ROADMAP sync & nghiệm thu đợt — D6-S7 (#89) — merge PR [#94](https://github.com/hangndat/ticket-solution/pull/94) `05618b5ed1401a3e524243a5823ed336b8731796`; parent #81 **Hoàn thành**/closed

Parent [#81](https://github.com/hangndat/ticket-solution/issues/81) **Hoàn thành**/closed. Milestone [D6 — Hoàn thiện UX/UI Vemoki](https://github.com/hangndat/ticket-solution/milestone/8) **closed**.
**Gate:** xem [docs/plans/D6-UX-UI-PLAN.md](./plans/D6-UX-UI-PLAN.md) §7 — đợt acceptance xong trên board. **Không tuyên bố lại D6 từ đầu** — chỉ sync Status từ Project. **Proof limits:** D6 ≠ pilot ready / store submission / production deploy.

### D7 — Offline Gate multi-device (board: Chưa lên lịch — sau rewrite #7)

- [ ] Thiết kế + contract: offline/reconcile multi-device không phá invariant online Gate (ADR-06)
- [ ] Backend + web Gate + iOS staff: hành vi mất mạng / nhiều máy quét theo spec đợt
- [ ] Gate §4.1 + evidence multi-device; cập nhật Project

### D8 — White-label (board: Chưa lên lịch)

- [ ] Cấu hình brand/tenant (theme, copy, assets) trong một app chung — không fork per-tenant
- [ ] Smoke tenant thứ hai với brand khác; Gate §4.1; cập nhật Project
- [ ] **Không** Android native; **không** store submit trong D8

### D9 — Demo seed + UX/UI còn lại + thiết kế media (board: Chưa lên lịch)

- [ ] Seed data đủ chạy demo end-to-end (tenant/event/mã/vé/staff) — đánh dấu fixture rõ
- [ ] UX/UI còn lại sau D6 + thiết kế media (ảnh event, asset marketing tối thiểu)
- [ ] Gate §4.1 + artifact demo; cập nhật Project

### D10 — Chuẩn bị metadata App Store (board: Chưa lên lịch)

- [ ] Privacy Nutrition Labels / privacy policy copy; screenshots; App Review notes
- [ ] Local signed archive (Xcode) sẵn sàng upload — **không** submit App Store trừ task riêng ủy quyền
- [ ] Gate §4.1 (headless/sim + local build + Project sync); deploy prod chỉ nếu authorize

### Ngoài phạm vi có chủ đích (không làm trong MVP mở rộng)

Quyết định user **2026-10-17 (O10)** — **hủy khỏi kế hoạch/roadmap MVP** (Issue [#7](https://github.com/hangndat/ticket-solution/issues/7) rewrite đồng bộ board; worker GitHub sở hữu Issue):

| Hủy khỏi MVP                        | Ghi chú                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| Android native                      | Khách Android dùng web responsive; không Google Play trong MVP |
| Payment / refund / chuyển nhượng vé | Vé miễn phí qua mã / invite như PRD baseline                   |
| Seat map                            | Không sơ đồ ghế trong MVP                                      |
| Apple / Google Wallet               | Ví trong-app + QR; không pass Wallet                           |

Vẫn **sau MVP** (không thuộc D7–D10, không bị “hủy” khỏi tầm nhìn dài hạn): SSO doanh nghiệp; billing tự động; custom domain/sender tenant; workflow builder tổng quát; marketplace template.

## 7. Quyết định còn mở (chặn thiết kế liên quan)

| ID               | Câu hỏi                                       | Baseline tạm                                                                                                                                                                    | Ảnh hưởng                                                                         |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| O01–O05, O07–O09 | (xem DECISION-LOG)                            | **Đã chốt MVP**                                                                                                                                                                 | [DECISION-LOG.md](./DECISION-LOG.md)                                              |
| O10              | Mở rộng MVP / hủy Android·payment·seat·Wallet | **Đã chốt** 2026-10-17 — D7–D10 trong MVP; mục hủy → §6                                                                                                                         | [DECISION-LOG.md](./DECISION-LOG.md)                                              |
| O06              | Retention, vùng dữ liệu, SLA?                 | **Đã chốt** 2026-10-18 — xem [DECISION-LOG](./DECISION-LOG.md) O06 / [O06-OPTIONS](./ops/O06-OPTIONS.md)                                                                        | Privacy copy khớp số; drill RPO/RTO trên VPS trước công bố                        |
| UX-11            | Auth đổi mã: Keycloak vs OTP/magic link PRD?  | **Đã chốt Option A** 2026-10-18 — MVP = Keycloak verified email / UI «Cần đăng nhập»; OTP/magic link = sau MVP ([#372](https://github.com/hangndat/ticket-solution/issues/372)) | [DECISION-LOG.md](./DECISION-LOG.md) UX-11; không mở Task OTP trừ khi user chọn B |
| ADR-09           | Provider OIDC cụ thể?                         | **Keycloak self-host đã chốt** — POC P4 local                                                                                                                                   | [spikes/D1-OIDC-PROVIDER.md](./spikes/D1-OIDC-PROVIDER.md)                        |
| ADR-11…15        | SaaS cấm; MinIO/SMTP/APNs/Caddy               | **Đã chốt MVP**                                                                                                                                                                 | [DECISION-LOG.md](./DECISION-LOG.md)                                              |

## 8. Quy ước tracking GitHub

- **Project:** https://github.com/users/hangndat/projects/3 — private, gắn `hangndat/ticket-solution`. **Authority trạng thái động.**
- **Fields (tiếng Việt):** Trạng thái, Ưu tiên, Đợt bàn giao, Nhóm phụ trách, Ngày bắt đầu, Ngày mục tiêu.
- **Trạng thái:** Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành.
- **Labels:** đợt (`dot-d0`…), nhóm (`nhom-backend`…), loại (`loai-quyet-dinh`, `loai-tinh-nang`, `loai-ha-tang`, `loai-kiem-thu`), ưu tiên.
- **Views:** Tổng quan/Backlog, Board theo trạng thái, Roadmap (không gắn ngày giả).
- **Parent / sub-issues** theo nhóm module; **blocked-by** khi phụ thuộc thật (ví dụ lịch sử: D2 từng bị chặn bởi D1 identity).
- **Đồng bộ board:** không chờ user duyệt từng bước Status; `worker_done` ≠ Hoàn thành — xem `.cursor/rules/github-project-tracking.mdc`.
- **GitHub Flow:** feature branch → commit → push → PR → Cursor DoD review → CI → coordinator merge `main`. Không commit feature thẳng `main` — xem `.cursor/rules/git-workflow.mdc`.
- **Orca:** worker/reviewer `orca-agent-routing-core.mdc`; coordinator spawn `orca-agent-routing-coordinator.mdc`: Codex điều phối; Composer thực thi phần ít cần suy luận; Codex worker chọn lọc cho reasoning/review theo cost-catalog; Task Spec có **Cost tier** (`cheap|standard`, trần standard) để map `--model`. Concurrent soft caps (≤5 non-review + ≤3 reviewer, ≤1 feature/slice) trong `orca-parallel-workers.mdc`. Coordinator gốc trực tiếp spawn ownership workers/reviewers cùng depth 1; một planner/Epic, fan-out task ready tối đa dưới caps/WIP; planner phân Story/Task, theo dõi phụ thuộc và chuẩn bị nghiệm thu, không spawn worker con. Worktree gắn Issue/PR + DAG/`gate` theo `orca-worktree-hygiene.mdc`. Idle fill và WIP theo `orca-*.mdc` trong `.cursor/rules/`.

## 9. Liên kết vận hành

- Repo: https://github.com/hangndat/ticket-solution
- Agent rules: root [AGENTS.md](../AGENTS.md) + `.cursor/rules/*.mdc`
- W0 evidence: [W0-FOUNDATION-REPORT.md](./W0-FOUNDATION-REPORT.md)
- Chính sách iOS: không bao giờ Expo/EAS Cloud Build — xem root/mobile `AGENTS.md`, README, PRD, technical design. Cài USB/máy thật: skill [ios-usb-device](../.cursor/skills/ios-usb-device/SKILL.md) — chọn mode **prod** (OIDC/API/APNs như TestFlight) hoặc **local API** trước khi bake; không trộn extras.
- Bàn giao Cursor W0→roadmap (lịch sử): [BAN-GIAO-CURSOR.md](./BAN-GIAO-CURSOR.md)

## 10. Lịch sử — sau duyệt roadmap lần đầu (2026-10-16)

> **Chỉ mang tính lịch sử.** Không dùng làm trạng thái hiện tại. Trạng thái live: §0–§1 và Project #3.

1. ~~User xác nhận roadmap / đóng D0~~ — đã duyệt 2026-10-16.
2. ~~Cập nhật Issue statuses lúc mở D1~~ — D0 Hoàn thành; D1 code slice (#10–#13) rồi Chờ duyệt / đóng.
3. ~~Trước D2:~~ P4 Keycloak API/web UAT có evidence ([smoke](./reviews/D1-P4-KEYCLOAK-SMOKE.md)); business endpoints đã được mở và D2/D3 đã **Hoàn thành** trên board sau đó.
4. **2026-10-17:** docs process sync — sửa văn bản “đợt tiếp theo = D1 / D2–D5 chưa bắt đầu” còn sót sau PR #51 (chỉ cập nhật checkbox §6, chưa sửa §1). Đối chiếu `ed6f0dd` + Project #3.
5. **2026-10-17:** User mở rộng MVP (O10) — thêm D7–D10; hủy Android/payment/seat/Wallet khỏi kế hoạch MVP; #7 rewrite (board). Đối chiếu `7c1abae` + Project #3.
