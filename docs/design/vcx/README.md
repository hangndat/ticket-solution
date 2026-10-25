# VCX-S0-T02 — Handoff portal: Khách & vé, import, wizard review, conflict & limit

| Trường | Giá trị |
| --- | --- |
| Issue | [#923](https://github.com/hangndat/ticket-solution/issues/923) · Story [#915](https://github.com/hangndat/ticket-solution/issues/915) · Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) |
| Role | `product-design` · Persona **Liv** · [`docs/agents/roles/product-design.md`](../../agents/roles/product-design.md) |
| Roadmap | [`docs/plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md`](../../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) · O25 |
| Mẫu UI | Ant Design + ProComponents (O18) · Live Pulse scoped — [`VD-03-UI-IMPLEMENTATION-HANDOFF.md`](../vemoki-unified-v1/VD-03-UI-IMPLEMENTATION-HANDOFF.md) |
| Baseline code đối chiếu | `a04e71afbc53af4490d0683c1ff680b37a96315a` (`origin/main` tại dispatch) |
| Handoff SHA | _(điền sau commit PR)_ |
| Consumer | **web** (`apps/portal`) — S2-T01 wizard · S3-T02 workspace · S3-T03 import · S2-T04 conflict · S5-T02 limits |
| Reviewer | Mira · `reviewer-uiux` |
| Visual budget | **Không invent** — `apps/portal/src/theme/vemoki.ts` + token Live Pulse portal trong VD-03 §0 |

**Mục tiêu:** unblock coding cho phần còn thiếu (G-05, G-07, G-08, G-09, G-10 trong roadmap §2) mà **không** redesign brand, không yêu cầu người dùng nhập UUID/revision, copy tiếng Việt với dữ liệu giả có nhãn «(mẫu)».

**Non-goals:** payment, Gate scan trên portal (O23), Android, đối thủ, contract/backend (S0-T03), sửa `apps/portal` trong Task này.

---

## Artifact trong thư mục

| File | Nội dung |
| --- | --- |
| [flows.md](./flows.md) | User flow chính + nhánh lỗi |
| [states.md](./states.md) | Ma trận `SurfaceState` / ProTable theo màn |
| [copy-vi.md](./copy-vi.md) | Copy conflict, limit, workspace (VI) |
| [open-questions.md](./open-questions.md) | Điểm còn mở + dependency contract |
| [prototype/vcx-portal-handoff.html](./prototype/vcx-portal-handoff.html) | Wireframe tĩnh 3 màn — viewport 390 / 1024 / 1440 |

**Mẫu trực quan:** HTML specimen có banner «PD demo — không phải runtime». Chụp evidence: mở file trong browser, đặt cửa sổ 390×844, 1024×768, 1440×900; selector màn ở toolbar.

---

## 1. IA & route (delta so với hiện tại)

| Route | Hiện tại (`guests/page.tsx`) | Chốt handoff |
| --- | --- | --- |
| `/t/[tenantId]/e/[eventId]/guests` | Tabs **Import · Chờ duyệt · Thông báo · Xuất** | **Giữ** các tab vận hành; **thêm** nhóm tab **Danh sách** (hoặc `Segmented` phía trên `ProCard`) với **Lời mời · Yêu cầu đổi mã · Vé** — mỗi tab một API/list riêng, **không** gộp row khác loại vào một bảng. |
| Drawer | Chưa có timeline thống nhất | `Drawer` width 480 (1024+) / full (390): timeline + metadata; mở từ hàng ProTable. |
| CS | Route CS riêng (UUID lookup) | **Không đổi** hành vi CS; workspace dùng tìm kiếm server `q` (tickets/redemptions) — **không** bắt UUID. |

```text
Khách & vé (PageContainer)
├── [optional] Segmented: «Vận hành» | «Danh sách»   ← mặc định Danh sách khi có quyền đọc
│   ├── Tab Lời mời      → GET invitations (cursor, state filter)
│   ├── Tab Yêu cầu      → GET redemptions (status, sourceId, ticketTypeId, q)
│   └── Tab Vé           → GET tickets (q, cursor)
│       └── Row action → Drawer timeline (invitation / redemption / ticket / notification / check-in là cột/tag riêng)
└── ProCard tabs vận hành (giữ PA-03): Import | Pending | Notifications | Export
```

Filter **Nguồn mã / Loại vé** chỉ trong tab Import — giữ [pa03-import-filter-diagram.md](../portal-audit-fix-2026-10-23/pa03-import-filter-diagram.md).

---

## 2. API map (chỉ đọc — không đổi contract trong PD)

| Tab | BFF / API | Ghi chú UX |
| --- | --- | --- |
| Lời mời | `GET …/invitations` | Cột: trạng thái **lời mời**, email (mask), nguồn, loại vé, thời gian. `state` filter server. Search `q` **chờ S0-T03** — nếu chưa có: client filter tạm + banner «Tìm kiếm đang giới hạn». |
| Yêu cầu | `GET …/redemptions` | Cột: trạng thái **yêu cầu**, mã (mask), khách, **không** gộp với trạng thái vé. |
| Vé | `GET …/tickets` | Cột: trạng thái **vé**, check-in (trường riêng), thông báo gửi (accepted ≠ delivered). |

PII mask: email `ng***@example.com`, phone `09** *** 42` khi thiếu `pii.read`; full khi có quyền — nhãn cột «(ẩn một phần)» khi mask.

---

## 3. Import — wizard 4 bước + phục hồi job

Thay layout «một Form dài + ô Import ID» bằng `Steps` trong tab Import (giữ catalog source/type PA-03):

| Bước | Tiêu đề | Nội dung |
| --- | --- | --- |
| 1 | Chọn file | Loại job (Mã / Khách), tải mẫu CSV, `Upload` một file, tóm tắt dòng/byte |
| 2 | Ghép cột | Chọn cột `code` hoặc `email`; preview 3 dòng đầu; **không** hiện mapping revision cho user |
| 3 | Xem trước | Bảng lỗi theo dòng; nút tải báo cáo lỗi khi server sẵn sàng; cảnh báo «Xem trước không giữ suất» |
| 4 | Ghi nhận | Trạng thái job (polling); kết quả success / rejected / unknown |

**Phục hồi sau reload (G-09):**

- Lưu `importId` + bước hiện tại trong `sessionStorage` key scoped `tenantId/eventId`.
- Block **«Việc nhập gần đây»** (danh sách ngắn, nhãn thời gian + loại + trạng thái) — dữ liệu từ **list imports API** khi S0-T03 merge; trước đó: chỉ khôi phục từ session + nút «Tiếp tục job đang làm» nếu có.
- **Cấm** ô nhập «Mã import / UUID» trên luồng chính (CS lookup UUID giữ route CS).

Idempotency: retry cùng ý định dùng pattern S1-T04 (ngoài scope implement PD).

---

## 4. Wizard tạo sự kiện — bước review (G-05)

Route: `/t/[tenantId]/events/new` — giữ 3 `Steps`; **bước 3** thay `Alert` tĩnh bằng `ProDescriptions` (hoặc `Descriptions` bordered) đọc **giá trị form hiện tại** (name, slug, timezone, visibility, venue, contact).

- Slug: gợi ý từ `name` (kebab-case) khi blur bước 1 — user sửa được; review hiển thị slug chốt.
- Nút «Tạo sự kiện» chỉ ở bước 3; `validateFields` **toàn form** trước submit (fields bước 1–2 vẫn trong `Form`, ẩn bằng `display: none` hoặc `preserve` — implementer chọn, PD yêu cầu payload đầy đủ).
- Submit lỗi `TENANT_LIMIT_REACHED` → surface limit (§5).

Wireframe: màn 3 trong [prototype/vcx-portal-handoff.html](./prototype/vcx-portal-handoff.html).

---

## 5. Conflict revision & hạn mức (G-07, G-10)

**Conflict revision** (config/setup/publish/notifications template — pattern chung):

| State | UI |
| --- | --- |
| Save/publish trả `REVISION_CONFLICT` / `expectedRevision` mismatch | `Modal` warning: «Ai đó vừa lưu phiên bản mới hơn» · primary «Tải lại bản mới» · secondary «Xem diff» (optional S2) · **không** ghi đè im lặng |
| Đang có bản local chưa gửi | `Alert` sticky: «Bạn có thay đổi chưa lưu» — reload trang → `Modal` confirm |

Copy chi tiết: [copy-vi.md](./copy-vi.md).

**Hạn mức / rate limit** — map error code, **không** đặt policy:

| Code | Surface | Hành động |
| --- | --- | --- |
| `TENANT_LIMIT_REACHED` | `Result` hoặc `Alert` type error trên mutation (tạo event, import commit, mời member…) | Giải thích cap; CTA «Về tổng quan» / «Liên hệ quản trị» — **không** upsell |
| `RATE_LIMITED` | `Alert` warning + countdown gợi ý (copy «Thử lại sau vài phút») | `onRetry` disabled đến khi user bấm lại |
| `RESEND_LIMIT` | Trên action resend (CS / notification) | Disable nút + tooltip cooldown; hiện số lần còn lại **chỉ khi** API trả (S0-T03) |

Chưa có endpoint usage tenant → **không** màn dashboard hạn mức; chỉ touchpoint lỗi.

---

## 6. Component tái sử dụng

| Thành phần | Path |
| --- | --- |
| `SurfaceState` | `apps/portal/src/components/surface-state.tsx` — kinds: loading, empty, error, unknown, permission-denied, … |
| `ProTable` / `ProCard` | `@ant-design/pro-components` — server `request` + cursor |
| `PortalPage` | `apps/portal/src/components/portal-page.tsx` |
| Copy Guests ops | [`copy-guests-pa02-pa03.md`](../portal-audit-fix-2026-10-23/copy-guests-pa02-pa03.md) |

---

## 7. Acceptance (#923) — checklist PD

- [x] Mỗi màn trong scope có states loading/empty/forbidden/error/unknown/stale + hành động theo capability — chi tiết [states.md](./states.md)
- [x] Không yêu cầu nhập UUID/revision trên luồng chính
- [x] invitation / request / ticket / notification / check-in là trường hoặc tag riêng
- [x] Ghi phiên bản mẫu (HTML) + điểm mở [open-questions.md](./open-questions.md)
- [x] Wireframe viewport 390 / 1024 / 1440 (prototype + CSS)

---

## 8. Liên kết

- Guests hiện tại: `apps/portal/app/t/[tenantId]/e/[eventId]/guests/page.tsx`
- Import panel: `apps/portal/src/ops/panels/import-invitations-panel.tsx`
- Wizard: `apps/portal/app/t/[tenantId]/events/new/page.tsx`
- Gap G-08–G-10: roadmap §2
