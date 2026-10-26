# O26 — Design alignment tối thiểu (Portal · Epic #914)

| Trường | Giá trị |
| --- | --- |
| Epic / Story | [#914](https://github.com/hangndat/ticket-solution/issues/914) · handoff gốc [#923](https://github.com/hangndat/ticket-solution/issues/923) (S0-T02) |
| Role | `product-design` · Persona **Liv** |
| Baseline code | `origin/main` @ `f3a515a46e3c43fe8c78017afdb00c0949d88fb0` |
| Quyết định UI | [O26](../../DECISION-LOG.md#o26--portal-dùng-giao-diện-mặc định-ant-design-26102026) + **bổ sung ProComponents** (cùng ngày) |
| Workflow | [ui-workflow.md](../../agents/ui-workflow.md) — Portal: ProComponents ưu tiên, `antd` nền tảng/fallback, **token/theme Ant mặc định**, **không** Vemoki DS |
| Artifact gốc | [`docs/design/vcx/`](./README.md) (flows, states, copy, prototype) |
| Visual budget | **Không** — không invent brand/token Portal; consumer web/iOS không đổi |
| Consumer review | Mira · `reviewer-uiux` — đối chiếu artifact này + #923 |

**Mục tiêu:** Căn chỉnh handoff #923 với UI Portal **đang chạy** sau O26 và với Task coding S2/S3/S5 (#930–#933, #935–#938, #942–#945). **Không** tạo Task/Issue mới; **không** sửa app hay design system trong Task này.

---

## 1. Bảng Task / Issue (phạm vi alignment)

Roadmap canonical: [`VEMOKI-CORE-UX-ROADMAP-2026-10-26.md`](../../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md). Cột bắt buộc: **Task/Issue**, **UI hiện có**, **Ant Design Pro phù hợp**, **Mâu thuẫn O26 trong handoff #923 (có/không)**, **Điều chỉnh tối thiểu**, **Chặn coding?** — ghi **Reuse** khi #923 đủ, không cần PD thêm. Gap của UI đang chạy không đồng nghĩa handoff mâu thuẫn O26; các tham chiếu Live Pulse và `SurfaceState` đã cũ được xử lý chung ở §4.

| Task/Issue | UI hiện có (`f3a515a`) | Ant Design Pro phù hợp | Mâu thuẫn O26 trong #923 | Điều chỉnh tối thiểu | Chặn coding? |
| --- | --- | --- | --- | --- | --- |
| S2-T01 · [#930](https://github.com/hangndat/ticket-solution/issues/930) | `events/new`: `Steps` + `Form`; bước 3 = `Alert` tĩnh; `PortalPage` | `PageContainer`, `ProDescriptions` | Không; M3 của #923 vẫn đúng | Bước 3 đọc form; slug gợi ý bước 1; `Descriptions` là fallback | **Không** cho layout; retry submit idempotent chờ [#929](https://github.com/hangndat/ticket-solution/issues/929) **group1** (đang làm) |
| S2-T02 · [#931](https://github.com/hangndat/ticket-solution/issues/931) | `types` / `sources` / `quota`: `PortalPage` + `ProTable` / form | `ProTable`, `ProForm` | Không | Giữ IA + nhãn/trạng thái | **Không** — không phụ thuộc kỹ thuật |
| S2-T03 · [#932](https://github.com/hangndat/ticket-solution/issues/932) *(Hoàn thành)* | `config/page`: `ProForm`, `ProTable`, conflict `Modal` | `ProForm`, `ProTable` | Không | **Reuse #923** — map [copy-vi.md](./copy-vi.md); pattern conflict đã khớp | **Không** — prerequisite đã đóng |
| S2-T04 · [#933](https://github.com/hangndat/ticket-solution/issues/933) | `e/[eventId]/page`: readiness, publish; `setup` drafts | `ProCard` cho nhóm thông tin nếu phù hợp; trạng thái dùng `Alert`/`Result` | Không; M4 của #923 vẫn đúng | `ReadinessChecklist` + conflict như #923; 403 khác thiếu cấu hình | **Không** PD; payload config từ **#932** đã có |
| S3-T02 · [#935](https://github.com/hangndat/ticket-solution/issues/935) | `guests/page`: tab ops Import · Pending · Notifications · Export | `ProTable` ×3; `Drawer`/`Segmented` dùng `antd` | Không; IA #923 vẫn đúng | Thêm workspace + timeline drawer | **Không** — filter `q` invitations có qua [#924](https://github.com/hangndat/ticket-solution/issues/924) / [#934](https://github.com/hangndat/ticket-solution/issues/934) *(đóng)* |
| S3-T03 · [#936](https://github.com/hangndat/ticket-solution/issues/936) | `import-invitations-panel`: form dài + **Import ID** | `ProForm` trong `ProCard`; `Steps` dùng `antd` | Không; M2 của #923 vẫn đúng | Wizard 4 bước; ẩn UUID; «Việc nhập gần đây» | **Không** list API — [#934](https://github.com/hangndat/ticket-solution/issues/934) đã merge; commit retry chờ **#929** |
| S3-T04 · [#937](https://github.com/hangndat/ticket-solution/issues/937) | `pending-panel` | `ProTable`, `Modal` | Không | Map `PENDING_LIMIT`; copy [copy-vi.md](./copy-vi.md) | **Không** shell UI; mutation retry chờ **#929** |
| S3-T05 · [#938](https://github.com/hangndat/ticket-solution/issues/938) | `cs-panel`, `export-panel` | Giữ `ProCard` / panel ops | Không | Resend cooldown → M5 | **Có** — helper **#929**; xếp hàng cùng slice Portal, không đặt thêm hard dependency lên S3-T02–T04 |
| S5-T01 · [#942](https://github.com/hangndat/ticket-solution/issues/942) | `onboarding/*`, `members/page` (`ProTable`) | `ProTable`; `Card`/`Form` antd | Không | `Result` PENDING; không brand gradient Portal | **Có** — sau **#938** |
| S5-T02 · [#943](https://github.com/hangndat/ticket-solution/issues/943) | Chưa map error code toàn cục | `ProDescriptions`/`ProCard` cho usage read-only khi phù hợp; lỗi dùng `Result`/`Alert` | Không; M5 copy vẫn đúng, OQ-3 đã được #958 giải quyết | Map code G-10 và hiển thị limits/usage từ API #958, không tự đặt policy hoặc xây dashboard mới | **Không** contract — API limits [#958](https://github.com/hangndat/ticket-solution/issues/958) *(đóng)*; còn wiring UI |
| S5-T03 · [#944](https://github.com/hangndat/ticket-solution/issues/944) | `t/[tenantId]/page`: `ProList`, `StatisticCard`, `PortalPage` | `PageContainer`, `ProList`, `StatisticCard` | Không | `asOf` stale / `report-stale-alert` | **Có** — sau **#943** |
| S5-T04 · [#945](https://github.com/hangndat/ticket-solution/issues/945) | `support/page` | — (`Typography`, `Alert` antd) | Không | Help in-context; không upsell | **Có** — sau **#944** |

**Không phát sinh Task mới:** reuse #923 + bảng trên; spike OQ-5 timeline aggregate gắn S3-T02/S3-T05 hoặc backend hiện có, không mở Issue PD.

---

## 2. UI Portal hiện có (đối chiếu nhanh)

Đọc-only trên baseline `f3a515a`. Shell: `portal-shell.tsx` — `Layout`/`Menu`/`Drawer` **antd** + token `theme.useToken()` mặc định.

| Vùng | Route / module | Pattern đang dùng | So với #923 |
| --- | --- | --- | --- |
| Shell & context | `portal-shell`, `portal-context-strip` | antd Layout, Drawer mobile | Khớp O26; unsaved guard một phần đã có (`useUnsavedChanges`) — S1-T03 bổ sung chuyển tenant |
| Page chrome | `portal-page.tsx` → `PageContainer` | ProComponents | #923 khuyên dùng — **giữ** (xem §4 vs #975/#983) |
| Event home / publish | `e/[eventId]/page` | antd + `ReadinessChecklist` | Cần UX conflict/readiness S2-T04; không redesign |
| Setup / metadata | `setup/page` | `ProForm`, `ProCard`, conflict reload | Khớp hướng conflict #923 |
| Config / brand | `config/page` | `ProForm`, `ProTable`, preview publish flow | Gap G-06 payload — UX conflict reuse §5 #923 |
| Wizard tạo event | `events/new` | `PortalPage`, `Steps`, `Form` | **Lệch** #923: thiếu review thật (Alert tĩnh) |
| Khách & vé | `guests/page` + ops panels | `ProCard` tabs ops only; import = form + Import ID | **Lệch** #923: chưa workspace 3 tab + chưa wizard 4 bước |
| Onboarding | `onboarding/page` | antd `Card`/`Form` | Khớp «không brand gradient» hướng O26 |
| Tenant overview | `t/[tenantId]/page` | `PortalPage`, `ProList`, `StatisticCard` | Khớp S5-T03; PR [#983](https://github.com/hangndat/ticket-solution/pull/983) (OPEN) là slice migration #975 — **không** tự động cấm Pro; cần lý do UX/a11y/kỹ thuật cụ thể |
| States chung | `surface-copy.ts` | `Alert` / `Result` / `Spin` + i18n keys | Không còn component `SurfaceState` (xem §4) |
| Theme | `providers.tsx` | `ConfigProvider` + `ProConfigProvider`, locale VI/EN | **Ant mặc định** — không `vemoki.ts` |

---

## 3. ProComponents & antd — gợi ý theo pattern (O26)

Implementer **web** (`apps/portal`): ưu tiên `@ant-design/pro-components` khi pattern khớp; `antd` cho primitives và khi Pro không có API phù hợp. **Không** nạp Vemoki DS; **không** token pipeline Portal.

| Pattern UX (#923 / roadmap) | Gợi ý chính | Fallback antd |
| --- | --- | --- |
| Khung trang ops | `PageContainer` qua `PortalPage` | `Flex` + `Typography.Title` chỉ khi trang đã inline chrome (không bắt buộc đồng nhất toàn app) |
| Bảng server cursor | `ProTable` / `portal-pro-table` wrapper | `Table` + pagination manual (tránh trừ khi Pro không dùng được) |
| Wizard import / tạo event | `Steps` + `ProForm` hoặc `Form` trong `ProCard` | `Steps` + `Form` thuần (wizard event hiện tại) |
| Review / read-only tóm tắt | `ProDescriptions` | `Descriptions` bordered |
| Drawer chi tiết | — | `Drawer` + `Timeline` + `Descriptions` |
| Conflict / confirm | — | `Modal` + `Alert` sticky |
| Limit / forbidden | — | `Result`, `Alert` |
| Filter toolbar | `ProCard` / `QueryFilter` (nếu nhiều field) | `Space` + `Select` (guests catalog filters hiện tại) |
| Tenant KPI strip | `StatisticCard` / `ProList` | `Card` + `Statistic` — chỉ khi đang migrate route cụ thể **có lý do** |

**Freeze UX (Portal):** Không đổi component đang hoạt động chỉ để đổi tên thư viện (bổ sung O26). Migration #975 chỉ tiếp tục slice có AC UX/a11y/kỹ thuật — không phải gate cho #930–#945.

---

## 4. Handoff #923 — mâu thuẫn & phần stale (không sửa file gốc trong Task này)

| Tham chiếu #923 | Trạng thái trên `f3a515a` / O26 | Hướng xử lý cho coding |
| --- | --- | --- |
| `SurfaceState` (`surface-state.tsx`) | **Đã gỡ** — logic copy tại `SURFACE_MESSAGE_KEYS`; UI = `Spin`/`Alert`/`Result` inline | Implementer đọc [states.md](./states.md) nhưng **thay** «SurfaceState» → pattern antd ở cột trên; không khôi phục wrapper riêng (trái O26 gốc, không cần sau bổ sung Pro) |
| `PortalPage` | **Còn**, đang dùng rộng | **Giữ** — PR [#983](https://github.com/hangndat/ticket-solution/pull/983) chỉ áp dụng khi slice #975 có AC UX/a11y/kỹ thuật rõ, không phải cấm Pro mặc định |
| `apps/portal/src/theme/vemoki.ts` + Live Pulse (VD-03 §0) | **Không tồn tại** trên baseline; README #923 dòng Visual budget **stale** | Bỏ qua Live Pulse; theme = Ant default qua `providers.tsx` |
| Mẫu «Ant + Live Pulse scoped» (README #923) | Lịch sử O16/O18; **O26 bổ sung** thắng | Consumer link **artifact này** + O26, không VD-03 cho Portal |
| Import: cấm UUID luồng chính | UI **còn** `Form.Item` Import ID | S3-T03 — bám M2 #923 |
| Guests: tab Lời mời / Yêu cầu / Vé | **Chưa có** | S3-T02 — bám §1 #923 |
| Wizard review `ProDescriptions` | **Chưa có** | S2-T01 |

**Kết luận:** Nội dung **flow / copy / IA / states** trong `flows.md`, `copy-vi.md`, `prototype/` vẫn **valid**; chỉ phần **component path & visual system** trong README #923 và `states.md` (tên `SurfaceState`, Live Pulse) cần hiểu qua §3–4 artifact này. **Không** cần handoff PD thứ hai.

---

## 5. #975 / #982 / #983 và prerequisite vs runtime

| Tham chiếu | Trạng thái (Project #3 · 26/10) | Ý nghĩa cho design |
| --- | --- | --- |
| [#975](https://github.com/hangndat/ticket-solution/issues/975) | **OPEN** — policy ProComponents Portal | Track migration **tùy slice**; **không chặn** #930–#945 theo #923 + §1 |
| [#982](https://github.com/hangndat/ticket-solution/pull/982) | **MERGED** @ `117a741bab815dee392f7b5cecfcff517de438c7` — dissolve `SurfaceState` | Khớp §4; không còn wrapper `SurfaceState` trên main sau merge |
| [#983](https://github.com/hangndat/ticket-solution/pull/983) | **PR OPEN** (SHA đầu PR thay đổi; đối chiếu head khi review) — O26-PR4 inline chrome batch 1 | **Không** coi là Issue; **không** cấm Pro tự động — chỉ merge khi slice #975 có lý do UX/a11y/kỹ thuật cụ thể, không đổi chrome «vì tên thư viện» |

**Prerequisite đã đóng (không gọi là blocker coding UI):**

| ID | GitHub / Project | Ghi chú |
| --- | --- | --- |
| [#925](https://github.com/hangndat/ticket-solution/issues/925) S0-T04 fixture persona | CLOSED · **Hoàn thành** | Fixture UAT local có; **runtime acceptance** S1–S6 vẫn tách (B-01) |
| [#926](https://github.com/hangndat/ticket-solution/issues/926) S1-T01 gate event | CLOSED · **Hoàn thành** | Không chặn #931 / guests skeleton |
| [#932](https://github.com/hangndat/ticket-solution/issues/932) S2-T03 config | CLOSED · **Hoàn thành** | **Reuse** #923 — không chặn #933 |
| [#934](https://github.com/hangndat/ticket-solution/issues/934) S3-T01 list imports | CLOSED · **Hoàn thành** | #936 dùng list API; không chờ S0-T03 |
| [#924](https://github.com/hangndat/ticket-solution/issues/924) S0-T03 contract | CLOSED | `q` invitations + import/limits contract — #935/#936/#943 wiring |
| [#958](https://github.com/hangndat/ticket-solution/issues/958) G-10 limits API | CLOSED · **Hoàn thành** | #943 map error — prerequisite API có |

**Còn ảnh hưởng coding / serial:**

| ID | Trạng thái | Chặn gì | Không chặn |
| --- | --- | --- | --- |
| [#929](https://github.com/hangndat/ticket-solution/issues/929) S1-T04 idempotency | **Đang làm** (group1 mutation) | Retry/commit idempotent đầy đủ trên mutation | Layout wizard, workspace tabs, ProTable shell |
| S3-T05 **#938** | Chưa lên lịch trên Project #3 | Sau **#929**; xếp hàng Portal serial không phải hard dependency guests slice | — |
| S5-T01 **#942** | Phụ thuộc | Sau **#938** | — |
| S5-T02 **#943** | Wiring UI | — (API #958 xong) | Handoff limits copy |
| S5-T03 **#944** | Phụ thuộc | Sau **#943** | — |
| S5-T04 **#945** | Phụ thuộc | Sau **#944** | — |

Deferred #901/#903/#904 — không đưa vào alignment Portal ops.

---

## 6. Điều chỉnh tối thiểu cho consumer (tóm tắt hành động)

1. **Link đúng artifact:** Task web S2/S3/S5 trỏ `docs/design/vcx/O26-DESIGN-ALIGNMENT-2026-10-26.md` + `flows.md` / `states.md` / `copy-vi.md` / prototype — không VD-03 / Live Pulse.
2. **States:** Dùng ma trận [states.md](./states.md) với mapping §3 (không tìm `SurfaceState` trong repo).
3. **Ưu tiên product:** event wizard review → guests workspace + import wizard → setup/config/publish conflict → onboarding/limit touchpoints → overview stale (đúng thứ tự coordinator portal serial).
4. **A11y:** Giữ `role="status"`, `aria-busy`, label tab rút gọn responsive (đã có trên guests) — không đổi locale VI mặc định.
5. **#975 / PR #983:** Feature theo #923; PR #983 chỉ khi slice có AC UX/a11y/kỹ thuật — không prohibition tự động lên `PortalPage`/`ProList`.

---

## 7. Chặn coding UI? (verdict PD)

| Câu hỏi | Trả lời |
| --- | --- |
| Handoff đủ unblock #930–#945? | **Có** — với artifact này làm lớp O26 trên #923 |
| Cần PD thêm trước code? | **Không** — trừ màn ngoài bảng §1 hoặc đổi IA lớn (escalate coordinator) |
| Review bắt buộc | Mira · `ux` — đối chiếu §1–4 + prototype HTML |
| Code complete = acceptance? | **Không** — runtime UAT persona (B-01) tách khỏi prerequisite #925 đã Hoàn thành |

---

## 8. Liên kết nội bộ (kiểm tra tồn tại)

- [DECISION-LOG O26](../../DECISION-LOG.md)
- [ui-workflow.md](../../agents/ui-workflow.md)
- [vcx/README.md](./README.md) · [flows.md](./flows.md) · [states.md](./states.md) · [copy-vi.md](./copy-vi.md) · [open-questions.md](./open-questions.md)
- [prototype/vcx-portal-handoff.html](./prototype/vcx-portal-handoff.html)
- Code: `apps/portal/app/t/[tenantId]/events/new/page.tsx`, `.../guests/page.tsx`, `.../setup/page.tsx`, `.../config/page.tsx`, `.../e/[eventId]/page.tsx`, `src/ops/panels/import-invitations-panel.tsx`, `src/components/portal-page.tsx`, `src/prep/surface-copy.ts`

---

*Artifact duy nhất cho O26 design alignment ngày 26/10/2026. Không thay thế #923 — bổ sung và làm rõ stale references.*
