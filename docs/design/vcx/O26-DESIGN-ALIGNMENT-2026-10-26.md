# O26 — Design alignment tối thiểu (Portal · Epic #914)

| Trường | Giá trị |
| --- | --- |
| Epic / Story | [#914](https://github.com/hangndat/ticket-solution/issues/914) · handoff gốc [#923](https://github.com/hangndat/ticket-solution/issues/923) (S0-T02) |
| Role | `product-design` · Persona **Liv** |
| Baseline code | `origin/main` @ `f3a515a46e3c43fe8c78017afdb00c0949d88fb0` |
| Quyết định UI | [O26](../DECISION-LOG.md#o26--portal-dùng-giao-diện-mặc định-ant-design-26102026) + **bổ sung ProComponents** (cùng ngày) |
| Workflow | [ui-workflow.md](../../agents/ui-workflow.md) — Portal: ProComponents ưu tiên, `antd` nền tảng/fallback, **token/theme Ant mặc định**, **không** Vemoki DS |
| Artifact gốc | [`docs/design/vcx/`](./README.md) (flows, states, copy, prototype) |
| Visual budget | **Không** — không invent brand/token Portal; consumer web/iOS không đổi |
| Consumer review | Mira · `reviewer-uiux` — đối chiếu artifact này + #923 |

**Mục tiêu:** Căn chỉnh handoff #923 với UI Portal **đang chạy** sau O26 và với Task coding S2/S3/S5 (#930–#933, #935–#938, #942–#945). **Không** tạo Task/Issue mới; **không** sửa app hay design system trong Task này.

---

## 1. Bảng Task / Issue (phạm vi alignment)

Roadmap canonical: [`VEMOKI-CORE-UX-ROADMAP-2026-10-26.md`](../../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md). Cột «Handoff #923» = flow/states/copy trong `docs/design/vcx/*` vẫn là nguồn UX; cột «Điều chỉnh O26» = chỉ rõ pattern component theo bổ sung O26.

| Mã | Issue | Gap / nội dung UX | UI hiện có (`f3a515a`) | Handoff #923 | Điều chỉnh O26 (tối thiểu) | Chặn coding? |
| --- | --- | --- | --- | --- | --- | --- |
| S2-T01 | [#930](https://github.com/hangndat/ticket-solution/issues/930) | G-05 wizard: review thật, slug, payload đầy đủ | `events/new`: `Steps` + `Form`; bước 3 = `Alert` tĩnh; `PortalPage` | M3 + prototype màn 3 | Bước 3 → `ProDescriptions` hoặc `Descriptions` đọc form; giữ `PortalPage` + `Steps`; slug gợi ý ở bước 1 | Chờ **S1-T04** (idempotency) cho retry submit; không chặn bắt đầu layout review |
| S2-T02 | [#931](https://github.com/hangndat/ticket-solution/issues/931) | Loại vé / nguồn / quota — nhãn & trạng thái | `types/page`, `sources/page`, `quota/page`: `PortalPage` + `ProTable` / form | Không chi tiết riêng trong #923 | Giữ ProTable/ProForm; không đổi IA | **S1-T01** (#926) nếu gate event sai ảnh hưởng menu |
| S2-T03 | [#932](https://github.com/hangndat/ticket-solution/issues/932) | G-06 config: không ghi đè phần không chỉnh | `config/page`: `ProForm`, `ProTable`, `buildMinimalConfigPayload` | Conflict pattern §5 #923 | `Modal` conflict + sticky unsaved — đã có pattern setup; map copy [copy-vi.md](./copy-vi.md) | **S1-T01** (gate event) |
| S2-T04 | [#933](https://github.com/hangndat/ticket-solution/issues/933) | G-07 draft/preview/publish, readiness vs 403/mạng | `e/[eventId]/page`: readiness checklist, publish; `setup` drafts | M4 conflict, M5 limits | `ReadinessChecklist` + `Alert`/`Result`; conflict → `Modal` như #923; phân biệt forbidden vs thiếu cấu hình | Verify-first; phụ thuộc **S2-T03** cho payload config đúng |
| S3-T02 | [#935](https://github.com/hangndat/ticket-solution/issues/935) | G-08 workspace Lời mời / Yêu cầu / Vé + drawer | `guests/page`: **chỉ** tab Import · Pending · Notifications · Export (`ProCard` tabs) | M1 IA §1 #923 — **chưa** có tab Danh sách | Thêm `Segmented` hoặc tab lồng: 3× `ProTable` (`portal-pro-table` hoặc `ProTable`); `Drawer` timeline; `PortalPage` | **S0-T03** nếu cần `q` invitations; không chặn skeleton tab nếu filter client + banner OQ-2 |
| S3-T03 | [#936](https://github.com/hangndat/ticket-solution/issues/936) | G-09 import 4 bước, không UUID luồng chính | `import-invitations-panel`: form dài + **ô Import ID** | M2 wizard `Steps` | Refactor tab Import → `Steps` 1–4; ẩn UUID khỏi luồng chính; `sessionStorage` + block «Việc nhập gần đây» khi có list API | **S0-T03** → **S3-T01** cho list imports; **S1-T04** cho commit retry |
| S3-T04 | [#937](https://github.com/hangndat/ticket-solution/issues/937) | Pending approve/reject + quota | `pending-panel` | Copy trong [copy-vi.md](./copy-vi.md) | `ProTable` + `Modal` lý do; map `PENDING_LIMIT` khi có | **S1-T04** |
| S3-T05 | [#938](https://github.com/hangndat/ticket-solution/issues/938) | CS / export | `cs-panel`, `export-panel` | CS route riêng — không đổi | Giữ panel pattern; resend cooldown → M5 | — |
| S5-T01 | [#942](https://github.com/hangndat/ticket-solution/issues/942) | Onboarding / members | `onboarding/*`, `members/page` (`ProTable`) | Limit touchpoint §5 | `Card`/`Form` antd; `Result` PENDING; không gradient brand (đã bỏ trên một số route) | — |
| S5-T02 | [#943](https://github.com/hangndat/ticket-solution/issues/943) | G-10 limits / rate | Chưa map error code toàn cục | M5 | `Result`/`Alert` theo code; **không** dashboard usage nếu không có endpoint (OQ-3) | **S0-T03** chọn contract |
| S5-T03 | [#944](https://github.com/hangndat/ticket-solution/issues/944) | Overview tenant / `asOf` stale | `t/[tenantId]/page`: `ProList`, `StatisticCard`, `PortalPage` | Stale banner §states | Giữ ProComponents; `report-stale-alert` / pattern `asOf` đã có trên analytics | — |
| S5-T04 | [#945](https://github.com/hangndat/ticket-solution/issues/945) | Help in-context | `support/page` | — | `Typography` + `Alert` — không upsell | — |

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
| Tenant overview | `t/[tenantId]/page` | `PortalPage`, `ProList`, `StatisticCard` | Khớp S5-T03; PR #983 muốn gỡ Pro ở đây — **không** bắt buộc theo bổ sung O26 |
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
| `PortalPage` | **Còn**, đang dùng rộng | **Giữ** — không theo nhánh #983 gỡ Pro khỏi overview trừ khi Task #975 slice được reviewer chốt riêng |
| `apps/portal/src/theme/vemoki.ts` + Live Pulse (VD-03 §0) | **Không tồn tại** trên baseline; README #923 dòng Visual budget **stale** | Bỏ qua Live Pulse; theme = Ant default qua `providers.tsx` |
| Mẫu «Ant + Live Pulse scoped» (README #923) | Lịch sử O16/O18; **O26 bổ sung** thắng | Consumer link **artifact này** + O26, không VD-03 cho Portal |
| Import: cấm UUID luồng chính | UI **còn** `Form.Item` Import ID | S3-T03 — bám M2 #923 |
| Guests: tab Lời mời / Yêu cầu / Vé | **Chưa có** | S3-T02 — bám §1 #923 |
| Wizard review `ProDescriptions` | **Chưa có** | S2-T01 |

**Kết luận:** Nội dung **flow / copy / IA / states** trong `flows.md`, `copy-vi.md`, `prototype/` vẫn **valid**; chỉ phần **component path & visual system** trong README #923 và `states.md` (tên `SurfaceState`, Live Pulse) cần hiểu qua §3–4 artifact này. **Không** cần handoff PD thứ hai.

---

## 5. #975 và #983 — trạng thái & blocker thực sự

| Issue | Trạng thái (26/10) | Ý nghĩa cho design |
| --- | --- | --- |
| [#975](https://github.com/hangndat/ticket-solution/issues/975) | **OPEN** — policy: ProComponents chuẩn Portal; PR [#977](https://github.com/hangndat/ticket-solution/pull/977)/[#980](https://github.com/hangndat/ticket-solution/pull/980) merged; [#982](https://github.com/hangndat/ticket-solution/pull/982) cần đối chiếu O26 trước merge | **Không chặn** implement #930–#945 theo #923 + bảng §1. Là track migration **tùy chọn** từng slice — không đảo PR đã merge |
| [#983](https://github.com/hangndat/ticket-solution/issues/983) | **OPEN** — O26-PR4: gỡ `PortalPage`/`ProList`/`StatisticCard` khỏi tenant home | **Mâu thuẫn policy** với bổ sung O26 («không thay component đang hoạt động chỉ vì tên thư viện»). **Không** coi #983 là yêu cầu UX cho S5-T03 cho đến khi coordinator/user chốt lại scope #975 |

**Blocker thực sự cho acceptance runtime (không phải PD):**

| ID | Chặn | Không chặn handoff / coding UI thuần |
| --- | --- | --- |
| B-01 | Persona fixture S0-T04 — runtime UAT S1–S6 | Spec + implement local |
| S0-T03 | List imports, limits contract — G-09/G-10 đầy đủ | UI import có session fallback; error-only limits |
| S1-T01 | Gate event #926 — menu vs route | S2-T03 có thể ưu tiên sớm sau T01 |

Deferred #901/#903/#904 — không đưa vào alignment Portal ops.

---

## 6. Điều chỉnh tối thiểu cho consumer (tóm tắt hành động)

1. **Link đúng artifact:** Task web S2/S3/S5 trỏ `docs/design/vcx/O26-DESIGN-ALIGNMENT-2026-10-26.md` + `flows.md` / `states.md` / `copy-vi.md` / prototype — không VD-03 / Live Pulse.
2. **States:** Dùng ma trận [states.md](./states.md) với mapping §3 (không tìm `SurfaceState` trong repo).
3. **Ưu tiên product:** event wizard review → guests workspace + import wizard → setup/config/publish conflict → onboarding/limit touchpoints → overview stale (đúng thứ tự coordinator portal serial).
4. **A11y:** Giữ `role="status"`, `aria-busy`, label tab rút gọn responsive (đã có trên guests) — không đổi locale VI mặc định.
5. **#975/#983:** Implement feature theo #923; migration Pro↔antd chỉ trong Task #975 được giao riêng, có evidence — không song song đổi chrome vì #983 khi chưa chốt.

---

## 7. Chặn coding UI? (verdict PD)

| Câu hỏi | Trả lời |
| --- | --- |
| Handoff đủ unblock #930–#945? | **Có** — với artifact này làm lớp O26 trên #923 |
| Cần PD thêm trước code? | **Không** — trừ màn ngoài bảng §1 hoặc đổi IA lớn (escalate coordinator) |
| Review bắt buộc | Mira · `ux` — đối chiếu §1–4 + prototype HTML |
| Code complete = acceptance? | **Không** — B-01 và CI/UAT persona vẫn theo roadmap §3 |

---

## 8. Liên kết nội bộ (kiểm tra tồn tại)

- [DECISION-LOG O26](../DECISION-LOG.md)
- [ui-workflow.md](../../agents/ui-workflow.md)
- [vcx/README.md](./README.md) · [flows.md](./flows.md) · [states.md](./states.md) · [copy-vi.md](./copy-vi.md) · [open-questions.md](./open-questions.md)
- [prototype/vcx-portal-handoff.html](./prototype/vcx-portal-handoff.html)
- Code: `apps/portal/app/t/[tenantId]/events/new/page.tsx`, `.../guests/page.tsx`, `.../setup/page.tsx`, `.../config/page.tsx`, `.../e/[eventId]/page.tsx`, `src/ops/panels/import-invitations-panel.tsx`, `src/components/portal-page.tsx`, `src/prep/surface-copy.ts`

---

*Artifact duy nhất cho O26 design alignment ngày 26/10/2026. Không thay thế #923 — bổ sung và làm rõ stale references.*
