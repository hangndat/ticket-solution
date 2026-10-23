# Audit portal — framework frontend và UX/UI (23/10/2026)

> **Phê duyệt tiếp theo 23/10/2026:** User “duyệt” sau báo cáo. PA-01–PA-06 được triển khai theo [kế hoạch sửa](../plans/PORTAL-AUDIT-FIX-PLAN-2026-10-23.md), Issue #838; report này giữ nguyên baseline và giới hạn của lượt audit.

**Portal đã dùng Ant Design/ProComponents thật. Vấn đề ưu tiên là header mobile bị vỡ và trải nghiệm vận hành còn mang ngôn ngữ kỹ thuật. Chưa có căn cứ để thay framework hoặc tuyên bố UX đã nghiệm thu.**

| Mục | Bằng chứng / phạm vi |
| --- | --- |
| Yêu cầu / tracking | User yêu cầu audit tương tự FE audit 22/10, đánh giá sâu UX/UI; [Issue #832](https://github.com/hangndat/ticket-solution/issues/832) |
| Exact SHA | `b34187919ade8ab5e07efcab59ac0284097c663d`; `HEAD = origin/main` lúc chốt baseline |
| Scope | `apps/portal`; đọc contracts/session/token khi truy dependency; không audit lại consumer web/mobile |
| Architecture impact | Không — đây là audit; kiến nghị thay IA/token/rendering cần review riêng trước triển khai |
| Đội độc lập | Mira · ux: Assessment A + lượt bổ sung authenticated; Higo · web: Assessment B framework/mechanical; coordinator kiểm source, ảnh và tổng hợp |
| Run | `run_f882e146c144`; A `ctx_14b111498042`, A2 `ctx_1867a7b94b16`, B `ctx_b3f8f9dce776` |
| Method | A/B không đọc kết quả của nhau; coordinator chỉ đọc B sau khi A đầu hoàn tất; A2 bổ sung auth và kiểm chứng có mục tiêu |
| Mẫu chuẩn | O16/O18; `PORTAL-ANTD-UX.md`, `PORTAL-PRO-REVAMP.md`, ADR portal hiện hành; FE audit 22/10 chỉ là mẫu phương pháp |
| Tài liệu chi tiết | [Framework — Assessment B](./PORTAL-FE-FRAMEWORK-AUDIT-2026-10-23.md), [UX/UI — Assessment A/A2](./PORTAL-UX-UI-AUDIT-2026-10-23.md) |
| Artifact | [Ảnh/probe UX](./assets/portal-audit-2026-10-23/ux/), [logs kỹ thuật](./assets/portal-audit-2026-10-23/fe/), [đối chiếu coordinator](./assets/portal-audit-2026-10-23/coordinator/) |

Đây là kết luận tổng hợp sau kiểm chứng. Các `PFE-*` / `PUX-*` trong hai assessment là đầu vào; **không cộng thành số bug**, không tự nhận mọi kiến nghị của reviewer là lỗi bắt buộc sửa.

## 1. Kết quả chính

1. **Không có tình trạng framework chỉ cài mà chưa dùng như audit consumer trước đó.** Có `ProLayout`, `PageContainer`, `ProTable`/wrapper, `ProForm` và `StatisticCard`; không có `<button>`, `<table>`, `<form>` HTML tự viết trong 40 file TSX. Portal chỉ có 72 dòng CSS global và không có `!important`.
2. **Lỗi rõ nhất là chrome ở 390px.** Wordmark xuống hai dòng; tenant/event selectors cạnh tranh chỗ với account và hint quét vé. Hint bị ép thành cột chữ dọc, tràn lên nội dung. Chỉ sửa `white-space` ở logo chưa xử lý hết.
3. **Luồng nghiệp vụ chứa copy cho lập trình viên.** Guests có tab `Export CSV / recovery · G-E1 history filter`; hướng dẫn import nói `commit idempotent`, `stream authenticated`; CS hiển thị `q`, `opaque ID`, `UUID exact`. Ngôn ngữ này xuất hiện trong ảnh thực tế, không chỉ source.
4. **Có các khoảng hở consistency/i18n/a11y cụ thể:** filter Import đặt ngoài tab Guests; formatter báo cáo cố định `vi-VN`; nhãn `exportId` và CSS spinner chưa theo reduced motion.
5. **Checks xanh không thay UAT.** 130/130 tests, lint, typecheck có log; phần lớn hành vi vận hành sâu, phân quyền theo từng role, keyboard/contrast toàn app chưa được chứng minh bởi các checks đó.

Không xác nhận P0 trong phạm vi đã kiểm. Có một nhóm P1 về mobile chrome, ba nhóm P2 và hai nhóm P3 bên dưới. Đây là mức ưu tiên của bản tổng hợp, độc lập với mức sơ bộ trong assessment.

## 2. Stack đã cài và sử dụng thực tế

| Lớp | Kết quả trên baseline |
| --- | --- |
| Framework | Next `16.4.2`, React `19.3.1` |
| UI | antd `6.6.6`, ProComponents `3.1.15-7`, nextjs-registry `1.3.0`, pin exact |
| SSR/style | Root `AntdRegistry`, `ConfigProvider`, `ProConfigProvider`; giữ App Router và O18 |
| Pro adoption | Shell/layout/page wrapper đã có; bảy route có `ProTable`/`PortalCursorProTable`; bảy ops panel còn dùng `Table` antd |
| Source inventory TSX | 40 file; 22/22 page và 39/40 TSX khai báo client; 35 file import antd, 20 file import ProComponents |
| Cách đếm | Các con số import ở đây chỉ tính TSX; assessment B tính rộng hơn cả TS và type imports. Không dùng chênh lệch cách đếm để suy adoption |
| Styling | 102 `style={{…}}`, 72 dòng CSS; không có HTML button/table/form tự viết trong TSX |
| Source of evidence | [inventory.json](./assets/portal-audit-2026-10-23/coordinator/inventory.json), các `inventory*.log` của B |

Số Client Component hoặc inline style chỉ là inventory. Chưa đo bundle, TTFB, INP hay render cost; chưa đủ căn cứ kết luận performance kém. ADR nói **ưu tiên** Pro*, không bắt buộc mọi bảng phải là ProTable. Chọn thành phần theo nhu cầu thao tác và consistency; không lấy phép đếm `<Table>` bằng 0 làm acceptance ngầm.

## 3. Findings đã sàng lọc

### PA-01 · P1 · Header authenticated bị vỡ ở mobile

- **Tái hiện:** staff Owner, Guests, viewport thật 390×844. Wordmark hai dòng; hint quét vé nằm dọc và chồng nội dung; account bị ép sát/cắt cạnh phải. Probe xác nhận logo `lines: 2`; ảnh cho thấy vấn đề rộng hơn riêng logo.
- **Tác động:** giảm khả năng đọc và tiếp cận các điều khiển ngữ cảnh/tài khoản ở đầu mọi màn staff trên mobile. Chưa kiểm touch trên thiết bị vật lý.
- **Bằng chứng:** [Guests 390px](./assets/portal-audit-2026-10-23/ux/auth-event-guests-390x844.png), [probe](./assets/portal-audit-2026-10-23/ux/probe-auth-event-guests-390x844.json). Coordinator đã mở ảnh; đối chiếu [portal-pro-layout.tsx](../../apps/portal/src/components/portal-pro-layout.tsx) dòng 118–176: logo, selector có minWidth 200, header Space, hint và account cùng tranh chỗ.
- **Sửa đề xuất:** thiết kế lại sự phân bố header ở breakpoint nhỏ: thu gọn brand, đưa chọn tổ chức/sự kiện vào hàng/vùng riêng hoặc control gọn; chuyển hint sang vùng không cạnh tranh header. Giữ nguyên role/context contract.
- **Owner:** web portal; PD chốt một mẫu header desktop/tablet/mobile trước nhân rộng.
- **Đóng khi:** 390/430/768/1024/1440px, VI+EN và tên tổ chức/sự kiện dài: không text dọc, chồng, clipping hay page overflow; account và cả hai selector truy cập được bằng bàn phím; có ảnh + probe + hành trình đổi context.

### PA-02 · P2 · Copy vận hành lẫn thuật ngữ API và bản dịch chưa hoàn chỉnh

- **Tái hiện:** ảnh Guests VI cho thấy `Export CSV / recovery · G-E1 history filter`, `commit idempotent`, `stream authenticated`; ảnh CS VI có `q chỉ nhận opaque ID chính xác` và placeholder `ticketId / requestId (UUID exact)`. Cột/placeholder ở các ops panel còn literal `Status`, `Created`, `State` dù shell ở VI.
- **Tác động:** tăng yêu cầu đào tạo và việc nhớ thuật ngữ nội bộ; nhãn dài làm tab/header khó đọc. Việc đổi key sang `t()` chưa giải quyết nếu giá trị tiếng Việt vẫn là copy kỹ thuật.
- **Bằng chứng:** [Guests desktop](./assets/portal-audit-2026-10-23/ux/auth-event-guests-1440x1000.png), [CS](./assets/portal-audit-2026-10-23/ux/auth-event-support-1440x1000.png); [messages.ts](../../apps/portal/src/i18n/messages.ts) dòng 305–346; [export-panel.tsx](../../apps/portal/src/ops/panels/export-panel.tsx) dòng 235–284; [codes-panel.tsx](../../apps/portal/src/ops/panels/codes-panel.tsx) dòng 105–158.
- **Sửa đề xuất:** copy theo công việc: “Nhập danh sách khách”, “Xuất danh sách”, “Tìm vé”, diễn đạt rõ trạng thái đã gửi/chưa rõ kết quả. Dời chi tiết protocol/permission vào chẩn đoán có chủ đích. Giữ phân biệt `ACCEPTED ≠ DELIVERED`, nhưng diễn đạt bằng ngôn ngữ vận hành.
- **Owner:** web portal + PD/copy. Đổi UUID input thành tìm theo tên/email nếu cần là kiến nghị product/API riêng; không tự nới tra cứu hay quyền/PII.
- **Đóng khi:** review VI/EN trên màn thật gồm bảng, tab, placeholder, validation, empty/error; không còn mã wave như G-E1 hay hướng dẫn protocol trên luồng chính. Không cấm các từ hợp lệ như Email/CSV/ID theo máy móc.

### PA-03 · P2 · Bộ lọc Import nằm ngoài phạm vi tab Guests

- **Bằng chứng:** [guests/page.tsx](../../apps/portal/app/t/[tenantId]/e/[eventId]/guests/page.tsx) dòng 200–228 render chọn nguồn/loại vé trước toàn bộ `ProCard` tabs; [ảnh VI](./assets/portal-audit-2026-10-23/ux/auth-event-guests-1440x1000.png). Handoff `PORTAL-PRO-REVAMP` §1.2 yêu cầu filter trong tab Import.
- **Tác động:** khi chuyển sang Chờ duyệt/Xuất danh sách, người dùng có thể hiểu nhầm bộ lọc bên ngoài đang áp dụng cho tab đó. Vị trí đã xác nhận bằng ảnh/source; lượt A2 chưa thao tác toàn bộ tab để chứng minh mọi hệ quả.
- **Sửa đề xuất:** đặt các selector vào panel chúng thực sự chi phối; giữ filter của pending/notification/export đúng scope, có nhãn rõ. Không thay BFF.
- **Owner:** web portal; PD xác nhận nhãn/phạm vi.
- **Đóng khi:** chuyển qua lại các tab, đổi nguồn/loại vé, refresh/deep link; mỗi filter chỉ hiển thị và tác động tại đúng scope, có hành vi kiểm chứng.

### PA-04 · P2 · Formatter thời điểm báo cáo không theo locale

- **Bằng chứng source:** [report.ts](../../apps/portal/src/ops/report.ts) dòng 120–131 cố định `Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC' })`; được dùng ở analytics, event home và Gate. Gate có thêm nhãn UTC; không khẳng định mọi nơi đều thiếu nhãn múi giờ.
- **Tác động:** giao diện EN vẫn nhận định dạng Việt. Watermark là căn cứ vận hành nên cần nhất quán và rõ timezone.
- **Owner:** web portal; PD chốt quy ước hiển thị thời gian nếu thay UTC.
- **Đóng khi:** formatter nhận locale, có test VI/EN và timestamp không hợp lệ; UI hiển thị timezone theo quy ước đã chốt. Không tự đổi business time/server timestamps.

### PA-05 · P3 · Tên accessibility của ô export là tên trường kỹ thuật

- **Bằng chứng source:** [export-panel.tsx](../../apps/portal/src/ops/panels/export-panel.tsx) dòng 235–241: `placeholder="exportId"`, `aria-label="exportId"`.
- **Tác động:** người dùng screen reader nhận tên trường nội bộ thay vì nhãn công việc; trùng PFE-008/PUX-009 nên chỉ tính một lần.
- **Owner / đóng khi:** web portal; đặt nhãn VI/EN dễ hiểu, kiểm accessible name trong DOM và thử luồng bằng bàn phím. Chưa có axe/VoiceOver toàn app nên không claim WCAG PASS.

### PA-06 · P3 · Spinner CSS chưa tôn reduced motion

- **Bằng chứng source:** [globals.css](../../apps/portal/app/globals.css) dòng 53–72 chạy animation vô hạn, không có media override; tắt motion token AntD trong provider không tự tắt animation CSS này.
- **Owner / đóng khi:** web portal; kiểm computed style của trạng thái loading với `prefers-reduced-motion: reduce`, ảnh/chữ trạng thái vẫn rõ khi bỏ chuyển động. Đây là khoảng hở motion preference, không tự suy thành vi phạm WCAG AA cụ thể.

## 4. Những nhận xét chưa được nâng thành bug

| Đầu vào | Kết luận kiểm chứng của coordinator |
| --- | --- |
| PFE-001: detector source trả `[]` | Là giới hạn công cụ, không phải lỗi sản phẩm. Không coi `[]` là runtime/a11y PASS |
| PFE-002 / PUX-011: còn antd Table | Là đề xuất consistency; chỉ migrate khi có nhu cầu toolbar/filter/keyboard cụ thể, không ép đổi framework/component theo số đếm |
| PFE-003: toàn page client | Cần đo trước khi kết luận performance; antd không bắt buộc mọi page phải client |
| PFE-005: state selection “chết” | Không đúng khi gọi hoàn toàn là dead state: biến vẫn được đọc làm fallback. Có giả thuyết clear event sau deep-link giữ context cũ; chưa hoàn tất kiểm chứng thao tác nên chưa chốt bug |
| PFE-006: `hashed={false}` | Chưa có bằng chứng hydration/style flash hay hệ quả đo được. Không suy nonce pipeline là cách sửa tương ứng |
| PFE-007: account dropdown thiếu semantics | Chưa kiểm DOM expanded/haspopup đầy đủ. `trigger=['click']` đã có sẵn nên không phải phần thiếu được chứng minh |
| PUX-003: literal “Vemoki Portal” | Tên thương hiệu tiếng Anh không tự là lỗi i18n; metadata locale là cải thiện riêng nếu AC yêu cầu |
| PUX-005 / PFE-004: token staff khác v2 | Có chênh lệch source/handoff. Cần chốt authority token staff theo O18/O22 và visual budget trước khi đổi palette; không tự redesign portal theo marketing |
| PUX-007: chữ Email | “Email” hợp lệ trong UI tiếng Việt; không tính là bug chỉ vì nguồn từ tiếng Anh |
| PUX-010: hash tab không sync | Có source đọc hash ban đầu; yêu cầu history/share-tab cần chốt trước khi nâng thành defect bắt buộc |
| PUX-012: title lộ UUID | Cột bảng `ID` không chứng minh title trang lộ UUID; loại khỏi danh sách lỗi đã xác nhận |
| Sider chỉ thấy nhóm trong ảnh | Coordinator có snapshot/DOM nhóm menu; thao tác mở nhóm kiểm tra tiếp bị Orca runtime timeout. Chưa đủ căn cứ kết luận nav leaf không truy cập được |

Không kế thừa verdict `PASS with known gap` của Assessment A thành nghiệm thu UI. Ảnh EN có chữ EN cũng không tự chứng minh lỗi bản VI; PA-02 dùng ảnh VI và source VI cụ thể.

## 5. Coverage và giới hạn thực tế

| Phạm vi | Đã kiểm | Chưa chứng minh |
| --- | --- | --- |
| Auth | OIDC local thật, staff Owner vào shell, attendee vào empty-org; auth/error landing | MFA production, revocation và policy từng role. Required action TOTP của user demo được reviewer bỏ trong fixture để chụp; không dùng làm proof MFA |
| Staff surfaces | Org/event overview, events list, members, setup/config/quota/sources, Guests Import VI+EN, CS, Gate report | CRUD end-to-end, publish/destructive confirmation, CSV commit/error, resend/delivery, export READY/download |
| Personas | Fixture Owner và attendee | CS-only, Supervisor-only, Scanner-only, Platform Operator; Owner thấy CS không thay role-specific UAT |
| Responsive | 1440×1000, 1024×900, 390×844; auth landing có thêm 430px | Touch thiết bị vật lý, zoom toàn app, tất cả tên dài/breakpoint trung gian |
| IA/context | Source contract, nhóm menu, selectors và route rendering | Hoàn tất tenant2 switching, event-clear/back/forward, mọi leaf nav và saved view trên hai tenant |
| A11y | Source semantics, focus/skip-link patterns, chrome probes | Full keyboard flow, screen reader, contrast/axe runtime toàn portal |
| Khác | Source `/platform`, analytics, audit/settings | Authenticated runtime các màn này và các trạng thái dữ liệu lớn |

Môi trường riêng: Docker project `portal-audit-832`, Postgres `58432`, Keycloak `8480`, API `3410`, portal `3413`. Seed D9 hai tenant có nhãn Demo, runtime DB login non-owner/non-BYPASSRLS. Không dùng dữ liệu user thật, không production mutation. Source không đổi; env/realm chỉnh cho localhost nằm ngoài Git.

## 6. Checks và evidence

| Check | Kết quả / giới hạn |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; không đổi lockfile |
| Portal tests | PASS 130/130 — [log](./assets/portal-audit-2026-10-23/fe/test-after-build.log) sau build workspace contracts/session |
| Portal lint/typecheck | PASS — logs trong thư mục FE; không suy từ đây thành UAT PASS |
| Portal build | A/A2 dùng build local và `next start`; B không chạy build. Evidence ảnh trên cùng source SHA, không phải production deploy |
| Impeccable source detector | JSON `[]`, regex-only; không chấm sạch runtime từ kết quả này |
| UI evidence | Ảnh/probe A2; coordinator đã mở Guests 390/1440 và CS 1440, kiểm source và probe tương ứng |
| Resource cleanup | Xem [CLOSEOUT.md](./assets/portal-audit-2026-10-23/coordinator/CLOSEOUT.md); workers đã settle, ảnh/report bảo toàn |

Lệnh UI mẫu: `orca tab create --url <local-route> --worktree path:<checkout> --json` → `orca exec --page <id> --command 'set viewport 390 844' --json` → snapshot/probe/screenshot qua Orca. Dùng `docs/agents/tools/ui-chrome-wrap-probe.js` và `ui-evidence-check.sh`; không Playwright trực tiếp trong agent session.

## 7. Wave sửa đề xuất — chưa triển khai

| Wave | Việc cụ thể | Owner | Gate trước khi đóng |
| --- | --- | --- | --- |
| W1 | PA-01: một mẫu header đại diện mobile/tablet/desktop, xử lý selectors/hint/account | PD → web portal | Kiểm viewport/tên dài, keyboard và hành trình đổi context |
| W2 (có thể song song W1) | PA-02, 04, 05, 06: copy VI/EN, locale formatter, accessible labels, reduced motion | web portal + PD copy | Render VI/EN, tests formatter và kiểm hành vi phù hợp |
| W3 | PA-03: đặt filter đúng tab; thống nhất bảng theo nhu cầu thật | web portal, PD xác nhận scope | Tab/filter/deep-link/back/empty/error dùng fixture |
| W4 | Hoàn tất ma trận role/journey còn trống; đo bundle nếu có mục tiêu performance | QA/reviewer + web hỗ trợ | Có evidence exact SHA mới; không kế thừa PASS từ baseline audit |
| Quyết định riêng | Authority token staff; lookup bằng dữ liệu nghiệp vụ; metadata locale; tab history | Coordinator/PD, BA/architect khi contract thật sự đổi | Review scope/roadmap trước khi mở feature |

Không sửa sản phẩm, không commit/push/PR/merge từ yêu cầu audit này. **Audit đã có báo cáo và bằng chứng; acceptance complete của portal và pilot ready chưa được chứng minh.**

Questions skipped: yêu cầu audit đã rõ; các wave trên là kiến nghị để review, chưa phải ủy quyền triển khai.
