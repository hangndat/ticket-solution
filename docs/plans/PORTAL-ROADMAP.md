# Roadmap Portal Vemoki — `portal.vemoki.com` / Ant Design

> **Supersession 24/10/2026:** [O23](../DECISION-LOG.md) thay quyết định `GATE-STAY-APP` trong gói P0+P1: bỏ Web Gate, admission chỉ trong iOS Staff. Nội dung Web Gate bên dưới là lịch sử phê duyệt ngày 18/10; migration `/gate` cần Task/contract và nghiệm thu riêng.

Ngày: **18/10/2026** · Chủ trì: coordinator gốc · Run: `run_df32d5572a2d`.

> **Người dùng đã duyệt ngày 18/10/2026** bằng phản hồi “duyệt” sau bản tổng hợp và planning review PASS. Bắt đầu Epic [#406](https://github.com/hangndat/ticket-solution/issues/406), Run `run_34fde1e32ed1`: P0+P1, `PORTAL-SEPARATE-APP`, `GATE-STAY-APP`, `PLATFORM-PORTAL-ZONE`, `ANTD-CORE-FIRST`. Cho phép coding/PR/review/CI/coordinator integration trong scope; không production DNS/deploy/cutover/cloud/store. Các câu “đề xuất/chờ duyệt” dưới đây là snapshot nghiên cứu trước approval; triển khai theo Task Spec và ADR-20 trong phạm vi đã duyệt. Approval không phải bằng chứng nghiệm thu sản phẩm.

**Yêu cầu đã xác nhận:** user muốn admin riêng tại **`portal.vemoki.com`**, UI **Ant Design (`antd`)**, nghiên cứu và roadmap với cả nhóm. Không cần xác nhận lại tên miền hoặc thư viện UI. **Gói triển khai dưới đây là đề xuất để duyệt; hiện chỉ làm nghiên cứu/tài liệu, chưa code tính năng hay deploy.**

Architecture impact: **Có** — thêm host staff, session/OIDC/BFF, đóng lệch contract và tổ chức app mới. Baseline source: `400ad87a1401972476c79f17c4fd726ca7538063`; các tài liệu mới là local chưa commit, không phải evidence triển khai trên SHA này.

## 1. Kết luận và phương án đề xuất

Portal cần đủ luồng vận hành từ chuẩn bị sự kiện đến hỗ trợ sau sự kiện. Không đo mức hoàn thiện bằng số trang hoặc việc đã thay component bằng antd. **Mỗi chức năng phải có UI → BFF → API → phân quyền → dữ liệu → phản hồi lỗi được kiểm chứng.**

| Thành phần | Phương án coordinator đề xuất để duyệt | Lý do |
| --- | --- | --- |
| Marketing | `vemoki.com` giữ marketing/legal/support | Giữ định hướng O13 |
| Người tham dự | `app.vemoki.com` giữ sự kiện public, đổi mã, nhận/ví vé, tài khoản | Giữ luồng attendee và API iOS |
| Quản trị tổ chức/sự kiện | `portal.vemoki.com`, app Next riêng **`apps/portal` trong monorepo** | Cô lập antd, CSS, CSP, bundle và vòng phát hành |
| Web Gate | **Giữ `app.vemoki.com/gate` trong đợt đầu**, iOS Gate giữ nguyên; portal có báo cáo và liên kết theo quyền | Tránh thay host/login/check-in đồng thời với migration back-office |
| Platform Operator | Đề xuất chuyển vào **`portal.vemoki.com/platform` ở wave riêng**, giữ client/audience/session và navigation Operator riêng | Một host vận hành; tenant Owner không được cấp quyền platform |
| UI | AntD thuần: Layout/Menu/Table/Form/Drawer/Modal/Steps/Upload; theme Vemoki, tiếng Việt | Không bắt buộc Umi hoặc Ant Design Pro; chưa dùng ProComponents mặc định |
| Identity | Hoàn thiện client staff portal + PKCE; BFF cookie **host-only từng host**, Operator giữ client riêng | Không share `Domain=.vemoki.com`; Keycloak IdP SSO có thể tiếp tục, không đồng nghĩa chia sẻ BFF cookie |

Đây là **khuyến nghị tổng hợp** sau đối chiếu chuyên môn: giữ Gate ở đợt đầu để giảm rủi ro, xem lại migration Gate bằng Task riêng nếu có nhu cầu. Chọn **app riêng** làm đích cho portal lâu dài; host-aware trong `apps/web` là phương án thay thế ít chi phí khởi đầu. Spike phải kiểm chứng chi phí auth/BFF/CI trước khi mở rộng.

Không mặc định thêm host `ops.*`/`gate.*` hoặc git repo mới. Nếu phương án app riêng không vượt spike, architect ghi lại tradeoff host-aware để quyết định trong gói triển khai, không âm thầm đổi stack.

**Quy ước chung sau review:** mã `G1/G2/P1` trong từng báo cáo chỉ có nghĩa **nội bộ file đó**, không phải mã quyết định xuyên nhóm. Không copy “chọn G1/P1” vào ADR/Task Spec. Gói duyệt dùng tên tường minh dưới đây:

| Tên dùng trong handoff | Nghĩa duy nhất trong gói roadmap này | Đối chiếu lựa chọn chuyên môn |
| --- | --- | --- |
| `GATE-STAY-APP` | Web Gate giữ `app.vemoki.com/gate` đợt đầu | PD/web gọi G1; architect gọi G2 |
| `PORTAL-SEPARATE-APP` | Next app `apps/portal` trong monorepo | Architect B; web W2; planner packaging P1 |
| `PLATFORM-PORTAL-ZONE` | Đề xuất Platform ở `portal./platform` với audience/session/quyền riêng, wave P1.1 | Architect P1; PD P2. PD P1 “giữ app” là **phương án thay thế**, không phải recommendation của gói tổng hợp |
| `ANTD-CORE-FIRST` | AntD thuần; ProComponents không nằm dependency mặc định | Các đề nghị Pro* của PD chỉ là option sau compatibility spike/peer support |

Footnote này cũng giải nghĩa dòng security đối chiếu lựa chọn PD: đó là ghi nhận **option của PD**, không đổi host model của roadmap. Khi user duyệt, ADR/PD/Task Specs phải ghi các lựa chọn bằng tên tường minh; không tự coi đề xuất Platform đã được user chấp nhận trước lúc đó.

## 2. “Portal chuyên nghiệp” gồm những gì

| Module / màn | Phạm vi đề xuất | Hiện trạng và công việc thật | Ưu tiên |
| --- | --- | --- | --- |
| **Không gian làm việc** | Org/event switcher, breadcrumb, menu theo quyền, hồ sơ và ngữ cảnh sự kiện rõ ràng | **Prod (2026-10-19):** sider nhóm org / event run / event setup trên `portal.vemoki.com` — UAT P1–P3 [PORTAL-PROD-UAT-NAV-2026-10-19.md](../reviews/PORTAL-PROD-UAT-NAV-2026-10-19.md); DoD spinner/home [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md). WIP `52bc54e3fdcb` chưa merge `main`. Còn: cache khi đổi org, parity đầy đủ | P0 |
| **Tổng quan & việc cần làm** | Readiness, quota, chờ duyệt, check-in/reject, email cần CS; deep-link đến thao tác | EventReport/copy O12 đã có; tái dùng, có `asOf`, refresh thủ công; không tự thêm KPI đa event | P0 |
| **Sự kiện** | Danh sách, tìm/lọc theo contract, tạo theo bước, chi tiết, sửa, clone, archive/cancel có impact preview | Có nhiều API; cần wiring pagination/filter đúng khả năng server và form antd | P0 |
| **Loại vé, nguồn mã & quota** | Danh sách/chi tiết, tạo, xem quota và trạng thái sử dụng | Tạo/quota có; browse/list và filter phải xác minh/hoàn thiện contract | P0 |
| **Khách mời & mã** | Nhập CSV, preview lỗi, commit, theo dõi job, danh sách lời mời, gửi có preview | UI/BFF/contracts đã mô tả rộng; audit thấy thiếu/lệch một số Nest endpoints; chưa được gọi là chạy đủ | P0 |
| **Hàng đợi duyệt** | Danh sách chờ duyệt, xem ngữ cảnh, approve/deny có lý do, tránh nhập Request ID thủ công | Nest list pending có; BFF GET/UI list cần nối; bulk chỉ khi có contract và kết quả từng mục | P0 |
| **Vé & hỗ trợ CS** | Tìm vé, chi tiết, timeline, trạng thái email, resend có cooldown và quyền | Có logic/consumer; giữ unknown/retry/idempotency, PII masked | P0 |
| **Nhân sự & quyền** | Danh sách thành viên/lời mời, mời/gán event, thu hồi; quản lý role trong allowlist | Có UI/contracts; cần reconcile list/mutate endpoints thực tế, last-Owner và revoke regression | P0 |
| **Nội dung & thương hiệu** | Editor có preview, asset upload, versions, publish/rollback có xác nhận | Tái dùng config/publish và schema; không render HTML thô | P0 |
| **Thông báo & nhắc** | Template, preview, lịch nhắc/hủy, trạng thái gửi và retry có lý do | Tái dùng flows hiện có; hoàn thiện danh sách/lọc theo contract; ACCEPTED ≠ DELIVERED | P0 |
| **Import / export** | Tạo job, tiến độ/trạng thái, lỗi tải xuống, kết quả, recovery; lịch sử job khi API có | Phải test thực tế worker/MinIO; UI có nút chưa chứng minh end-to-end | P0 |
| **Cấu hình tổ chức** | Thông tin/brand và cài đặt được server cho phép; trạng thái suspended rõ | Tái dùng profile/brand/permissions; không dựng settings chỉ lưu client | P0 |
| **Nhật ký hoạt động** | Browser audit có phân trang/lọc, actor/action/time/result, dữ liệu nhạy cảm được che | Audit writers có; read API + permission mới là **mở rộng đề xuất**, không có sẵn | P1 |
| **Bảo mật tài khoản** | Trạng thái phiên/MFA, logout rõ phạm vi, xác nhận thao tác nguy hiểm, recovery quyền bị thu hồi | Ma trận session/logout cần thiết kế; session-management/step-up mới chỉ thêm khi contract được duyệt | P0 nền tảng / P1 mở rộng |
| **Platform Operations** | Tenant discovery/provision, status/limits/health và support grant có lý do/TTL/audit | UI tồn tại; list/health/contracts cần reconcile; quyền Operator tách tenant | P1, trước cutover Platform |

**Chuẩn UX xuyên suốt:** dữ liệu lớn có phân trang server, search/filter được API hỗ trợ; filter/deep-link giữ ngữ cảnh; không bắt người dùng nhớ UUID; hiển thị loading/empty/error/unknown/forbidden/stale riêng; form báo lỗi tại trường và bảo vệ thay đổi chưa lưu; hành động nguy hiểm có impact/reason; bàn phím/focus/a11y, responsive cho tablet và màn nhỏ. Không dùng lọc client trên dữ liệu tải thiếu để giả bộ tìm toàn bộ.

**Phân quyền:** backend quyết định; menu chỉ phản ánh capability. Owner/Manager/CS/Supervisor/Scanner không mặc nhiên thấy cùng menu. Scanner chỉ Gate; report chỉ hiện khi có đúng quyền. Operator là audience riêng, không phải tenant role cao hơn.

## 3. Các kết luận nghiên cứu cần đưa vào lịch

1. Admin source hiện có phạm vi khá rộng, nhưng audit backend chỉ ra **consumer/contract không đồng nghĩa API đang phục vụ đủ**: member/invite lists, import job lifecycle, invitations, platform list/health, inventory browse và audit browser cần kiểm tra/đóng gap. Xem [backend gaps](./PORTAL-BACKEND-GAPS.md). Không gọi toàn bộ các luồng này acceptance complete từ việc tồn tại UI.
2. Có GET pending trên Nest, nhưng thiếu mirror GET trong admin BFF; event list đã có cursor phía API nhưng BFF chưa truyền đủ. Trước khi thêm backend mới phải xác định gap nằm **web forwarding, contract, controller hay business logic**.
3. AntD hỗ trợ Next App Router với registry SSR; theme theo token. Registry/peer metadata là cơ sở chọn ứng viên, **không chứng minh runtime compatibility**. Research quan sát `antd@6.6.6`, registry `1.3.0`; pin exact sau compatibility spike và kiểm tra phiên bản tại lúc triển khai. ProComponents peer hiện được web ghi nhận chưa khai báo antd 6 — chưa đưa vào dependency mặc định.
4. `app.*` và `portal.*` khác origin nhưng cùng site. Cookie host-only, Origin/CSRF fail-closed, redirect exact và ma trận logout cần kiểm chứng; không dựa riêng SameSite để cô lập quyền.
5. Project #3 lúc khởi động có **183 items**, D12 #293 và D13 #301 đang làm; chưa có Epic portal. Không trộn roadmap này vào công việc store, không sửa tài nguyên đang thuộc Run khác. Không gán ngày phát hành trước estimate implementation.

## 4. Roadmap theo cổng bàn giao

| Wave / Story | Đầu ra | Task ownership có thể chạy song song | Cổng ra / bằng chứng |
| --- | --- | --- | --- |
| **R0 — Nghiên cứu và chốt gói** | Bộ BA/PD/architect/web/BE/security, roadmap và Epic→Story→Task | Đã dispatch các chuyên môn độc lập; coordinator tổng hợp | Người dùng review roadmap; ghi phạm vi được duyệt trước feature coding |
| **P0.1 — Nền tảng portal** | `apps/portal`, shell antd, login/logout, org/event context, routes và host policy local; đo baseline | Web một Task ∥ coordinator workspace/lockfile/CI/handoff ∥ BE kiểm chứng gap độc lập ∥ reviewer trên PR đã ready | SSR/style/locale, authz, cookies/CSRF, role matrix, attendee không tải antd; spike pass |
| **P0.2 — Dữ liệu và chuẩn bị sự kiện** | Event list/setup wizard, types/sources/quota, nội dung/brand/preview/publish, staff directory/invites | BE đóng gap theo contract đã chốt ∥ web phần UI có API sẵn ∥ coordinator contract ∥ reviewer độc lập | Không nhập UUID cho luồng chính; list phân trang đúng; permissions/cross-tenant; publish ≠ mở đổi mã ≠ mở Gate |
| **P0.3 — Khách, vé và day-of** | CSV/import/guest invitation, pending approval, CS/timeline/resend, thông báo/reminder, event Dashboard | Một web coding Task tại một thời điểm; BE gap khác endpoint ∥ reviewer/BA kiểm AC | Real API + worker/storage; quota/idempotency/unknown recovery; watermark và KPI O12; Gate cũ hoạt động |
| **P0.4 — Đủ chức năng và hardening** | Export/recovery, kiểm đủ mọi chức năng admin cũ; a11y/perf/security; chuyển đổi thử local/staging được cho phép | Web hoàn thiện ∥ security ∥ DoD/QA độc lập ∥ coordinator runbook | **100% parity matrix đã chọn chuyển có evidence**; không bỏ CS/export/team/notification để gọi portal đủ |
| **P1.1 — Vận hành nâng cao** | Audit browser, job history/filter khi được duyệt, security settings có API, Platform zone và reconcile endpoints | Contract trước consumer; BE ∥ web luồng unblocked ∥ reviewer security/DoD | Không thêm permission/PII ngoài contract; Operator client/audience/session riêng; review exact SHA |
| **P1.2 — Cutover có kiểm soát** | Deploy portal khi được ủy quyền riêng; dual-run, deep-link migration, redirect tạm, quan sát và rollback | Coordinator edge/env/Keycloak ∥ web redirect/nav/email-link đúng ownership; UAT/review sau build phù hợp | Login/E2E portal và attendee/Gate regression; rollback drill; chỉ gỡ đường cũ khi parity đã đạt |
| **P2 — Đề xuất sau** | Multi-event analytics, saved views/automation nâng cao, EN portal, custom roles hoặc self-serve onboarding | Discovery riêng theo nhu cầu thật | **Cần duyệt phạm vi riêng**; chưa xếp coding trong gói P0/P1 |

Waves là trình tự dependency ở mức kết quả, **không ép hoàn tất toàn Story mới làm Task khác**. Mọi Task unblocked khác ownership được chạy cùng checkpoint dưới capacity/WIP. **Không** chạy hai feature coding Dispatch cùng slice web, kể cả `apps/web` và `apps/portal`; BE tương tự. Reviewer có thể chạy song song nhiều PR.

Ánh xạ skeleton planner → roadmap tổng hợp (để tạo Issue không dùng hai lịch khác nhau):

| Wave trong `PORTAL-EPIC-TASKS.md` | Wave dùng khi lập lịch/Issue theo gói này |
| --- | --- |
| R0 / S0 | R0 nghiên cứu; đã bàn giao trong Run này |
| I1 / S1 | P0.1 nền tảng |
| I2 / S2 | P0.2 → P0.3 → P0.4 theo dependency từng Task, không chặn Task độc lập |
| S3 Platform | P1.1 Platform zone (audit/security mở rộng cũng ở P1.1); không chạy coding song song cùng slice web |
| S4 Gate | Chỉ liên kết/regression cho `GATE-STAY-APP`; không mở Task chuyển Gate từ gói này |
| I3 / S5–S6 | P1.2 cutover + UAT/review/rollback; review/CI vẫn chạy liên tục từng PR ở các wave trước |

P2 là backlog cần duyệt riêng, không có coding Task trong skeleton triển khai gói hiện tại.

Không đưa số tuần hoặc ngày giả. Sau approval và spike P0.1, planner/implementers estimate theo Task, risk và capacity thực tế; báo lại critical path. Root tooling/lockfile/contracts do coordinator; **`apps/portal` là đề xuất mở rộng ownership web trong Task Spec sau duyệt**, chưa tự cấp quyền edit source trong Run nghiên cứu.

## 5. Tiêu chí nghiệm thu bắt buộc

- **Nghiệp vụ:** persona hợp lệ hoàn thành các luồng tạo/publish, import/duyệt, CS/resend, staff, notification, export trên API thật. Backend thiếu route thì giữ Task chưa đạt; không mock để vượt UAT.
- **Tenant/quyền:** deny-by-default; đổi tổ chức, session hết hạn, membership revoke và cross-tenant đều không rò dữ liệu. PostgreSQL là nguồn quota/check-in, tenant context transaction-local, query parameterized và runtime DB role không bypass RLS.
- **Phiên/host:** Set-Cookie không có Domain parent; HttpOnly/Secure theo môi trường; test request thực tế giữa host. Không dùng `document.cookie` để chứng minh session HttpOnly. Origin không hợp lệ/thiếu xử lý fail-closed; auth redirects HTTPS exact, callback/logout path khớp client; không wildcard production.
- **Logout:** ghi rõ thoát phiên portal, phiên Operator và phiên IdP/toàn bộ khác nhau thế nào; kiểm tra theo semantics đã duyệt. Không giả định một host xóa trực tiếp cookie host-only của host khác.
- **UX/dữ liệu:** state unknown không coi success; retry mutation giữ idempotency phù hợp; list cursor không giả pagination số trang/tổng số khi API không có; email ACCEPTED không coi đã giao; report theo O12 `asOf`/refresh thủ công.
- **Chất lượng:** headless Playwright/`scripts/web-uat.sh`, keyboard/focus/axe; đo bundle và tốc độ cùng dữ liệu/điều kiện trước-sau; không claim WCAG toàn app từ một lần axe. CSP/SSR được kiểm chứng, không dùng CDN runtime cho portal self-host.
- **DoD:** PR/CI theo quyền implementation được giao, reviewer độc lập exact SHA, security review cho host/auth/PII, CI trên integrated commit và evidence. **Code complete ≠ acceptance complete ≠ pilot ready.** iOS không đổi trong portal web thì không tạo build/store Task; nếu sau này chạm mobile, áp dụng local build và gates tương ứng.

## 6. Migration và rollback

1. **Expand:** app portal và OIDC callback hợp lệ chạy thử; admin cũ còn nguyên. Đồng bộ BFF/contracts trước khi đổi đường link. Test trực tiếp trên host portal thật ở môi trường được phép trước cutover production.
2. **Parity:** checklist đối chiếu từng chức năng/role/data state, có links evidence. Platform chuyển ở wave riêng sau parity riêng; Gate giữ nguyên.
3. **Switch:** khi được phép deploy, thêm DNS/TLS/nginx upstream portal và origin/env đúng từng process. Redirect **GET/HEAD navigation** từ URL admin cũ bằng destination cố định; giữ context hợp lệ và query allowlist. Không redirect mutation POST/PUT/PATCH hoặc BFF cũ sang host khác một cách mù quáng.
4. **Deep-link:** bảo toàn org/event và intent được allowlist qua login; không copy raw token/PII vào URL mới; reject `//`, scheme/host ngoại và return URL tùy ý. Fragment phải có adapter client nếu cần (server không nhận fragment).
5. **Observe:** redirect tạm thay permanent trong cửa sổ thử, kiểm login errors/403/unexpected empty/unknown và Gate latency; runbook có tiêu chí dừng và owner.
6. **Rollback:** công tắc chỉ chọn một hướng. Tắt app→portal redirect **trước** khi đưa người dùng về legacy; không tạo loop portal↔app. Giữ callback/legacy route cần cho rollback; không dùng parent-domain cookie để chữa login. Chưa bỏ legacy/BFF/callback cho đến hết cửa sổ đã thống nhất.

Deployment production/DNS/TLS vẫn cần Task ủy quyền riêng; approval roadmap không tự tạo tài nguyên cloud hoặc submit store.

## 7. Gói để người dùng duyệt

Đề nghị duyệt **P0 + P1** theo bảng §2/§4: portal Next riêng trong monorepo, AntD thuần tiếng Việt, migration đủ nghiệp vụ admin hiện có, đóng API gaps thật, audit/ops có contract và Platform zone tách quyền. **Giữ Web Gate trên app trong đợt đầu.**

Không kéo vào gói: multi-event BI (O12/O14 đang OUT), enterprise SSO mới, billing, custom-domain/sender, payment/refund/transfer, seat map, Wallet, Android, validate-only desk. Các mục này không cần để nghiệm thu portal quản trị vé mời hiện tại.

Sau khi gói được duyệt: coordinator ghi quyết định mới tiếp nối O13, tạo Epic/Story/Task trong Project #3, chốt ADR/client callback và dispatch wave ready theo ownership. Không yêu cầu user chọn lại từng Task độc lập hoặc trả lời nhiều câu kỹ thuật có thể giải trong phạm vi đã duyệt. Nếu user chỉ muốn review roadmap, các tài liệu hiện tại đủ để review và chưa khởi động coding.

## 8. Hồ sơ nghiên cứu và thứ tự sử dụng

**File này là bản tổng hợp khuyến nghị để review.** Các báo cáo chuyên môn ghi options khác nhau theo góc nhìn; không hợp nhất chúng thành decisions đã duyệt. Khi bảng web/BA mô tả consumer sẵn có, phải đọc kèm backend gaps trước khi kết luận end-to-end.

| Tài liệu | Nội dung |
| --- | --- |
| [Sản phẩm](./PORTAL-PRODUCT-RESEARCH.md) | Personas, benchmark, JTBD, capability |
| [Thiết kế AntD](../design/PORTAL-ANTD-UX.md) | IA, wireframe text, states, tokens/a11y |
| [Kiến trúc](../architecture/PORTAL-SUBDOMAIN-ANTD.md) | Packaging options, host/OIDC/BFF/cutover |
| [Web feasibility](./PORTAL-WEB-FEASIBILITY.md) | Registry/peer/version observations, UI migration |
| [Backend gaps](./PORTAL-BACKEND-GAPS.md) | API vs BFF/contract, lists/jobs/RBAC |
| [Security discovery](../reviews/PORTAL-DISCOVERY-SECURITY.md) | Threat model và test acceptance, không PASS runtime |
| [Epic/Story/Task](./PORTAL-EPIC-TASKS.md) | Skeleton phân việc; khi dispatch phải reconcile theo gói được duyệt trong file này |
| [Run evidence](./PORTAL-RESEARCH-RUN.md) | IDs/agent/ownership/checks/cleanup |

Nguồn chính thức kiểm tra 18/10/2026: [AntD Next.js](https://ant.design/docs/react/use-with-next/), [theme tokens](https://ant.design/docs/react/customize-theme/), [Table](https://ant.design/components/table/), [i18n](https://ant.design/docs/react/i18n/), [ProComponents peer metadata](https://registry.npmjs.org/@ant-design/pro-components/latest), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Benchmark nghiệp vụ: [Ticket Tailor — event summary/report/history/export](https://help.tickettailor.com/en/articles/5028380-how-to-see-your-check-in-data). Chỉ lấy pattern thao tác; không sao chép định nghĩa checked-in/attended của sản phẩm khác thay dictionary O12. Eventbrite/Cvent trong BA là research public theo báo cáo worker; coordinator không dùng nội dung không fetch được làm bằng chứng chính cho khuyến nghị.

**Giới hạn:** nghiên cứu source/docs, chưa phỏng vấn vận hành hoặc chạy portal runtime; chưa estimate nhân lực/lịch, chưa có commit triển khai hay production proof. GitHub Project mới là authority trạng thái động; local docs không tự chuyển board sang Hoàn thành.
