# Portal audit fix — PD handoff (#838)

| Trường | Giá trị |
| --- | --- |
| Issue | [#838](https://github.com/hangndat/ticket-solution/issues/838) |
| Plan | [PORTAL-AUDIT-FIX-PLAN-2026-10-23.md](../../plans/PORTAL-AUDIT-FIX-PLAN-2026-10-23.md) |
| Role | `product-design` · Persona Liv · PD |
| Baseline impl | `7dc042f` · branch `hangndat/portal-audit` |
| Audit evidence | `b3418791` (ảnh audit gốc không thay) |
| Visual budget | **Không** — token AntD staff [`apps/portal/src/theme/vemoki.ts`](../../../apps/portal/src/theme/vemoki.ts), O18 ProLayout |
| Xác nhận | User đã duyệt PA-01–06 + plan 23/10/2026 |
| Consumer | Web B (PA-01 header) · Web A (PA-02–03 copy, dùng [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md)) |
| PD handoff SHA | Batch 1 `c9598be`; MR-PORTAL refresh **local** (không commit) — xem [CHANGELOG-pack.md](./CHANGELOG-pack.md) |
| MR-PORTAL evidence | [`docs/reviews/assets/MR-PORTAL-2026-10-23/`](../../reviews/assets/MR-PORTAL-2026-10-23/) |
| MR-FIX1-PORTAL (#859 batch 1/2) | [`docs/reviews/assets/MR-FIX1-PORTAL-2026-10-23/`](../../reviews/assets/MR-FIX1-PORTAL-2026-10-23/) · [REPORT-FIX1-PORTAL](../../../.orca-metrics/mockup-refresh/REPORT-FIX1-PORTAL.md) |

**Mẫu trực quan trong thư mục này là specimen PD (banner vàng «PD demo»), không chứng minh runtime authenticated.**

### Evidence batch sửa 1/2 (#838)

| Kiểm tra | Kết quả |
| --- | --- |
| Mobile stack &lt;768px | CSS `flex: 1 1 100%` + probe `layout.stacked: true` @ 390px (vi, vi-long, en) |
| Viewport label | `useEffect` + `resize`; chụp: `orca tab create --url` → `set viewport W H` → probe `metaText` khớp W×H |
| Desktop row | probe `layout.sideBySide: true` @ 1024 / 1440 |
| Ảnh PNG | `sips` khớp tên file; `ui-evidence-check` trên `assets/header-pa01-*.png` — không trùng hash |
| Probe JSON | `assets/evidence/header-pa01-*.json` (viewport, mediaMin768, bounding boxes tenant/event) |

Capture: [prototype/capture-screenshots.sh](./prototype/capture-screenshots.sh) + [probe-pa01-header.js](./prototype/probe-pa01-header.js).

## Artifact

| Path | Nội dung |
| --- | --- |
| [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md) | Bảng copy VI/EN Guests Import / Pending / Notifications / Export + PA-03 scope filter |
| [pa03-import-filter-diagram.md](./pa03-import-filter-diagram.md) | Sơ đồ PA-03 — filter chỉ tab Import |
| [pa06-reduced-motion-notes.md](./pa06-reduced-motion-notes.md) | PA-06 CSS + kiểm tra reduced motion |
| [CHANGELOG-pack.md](./CHANGELOG-pack.md) | Lịch sử batch PD (PA-01 regression) |
| [prototype/header-specimen.html](./prototype/header-specimen.html) | PA-01 — two-tier chrome (giữ tên file) |
| [prototype/portal-full-specimen.html](./prototype/portal-full-specimen.html) | **Full portal mockup**: org/event/operator nav, Guests tabs, **audit & codes** (MR-R08), setup, platform grants preview, state presets VI/EN |
| [prototype/capture-screenshots.sh](./prototype/capture-screenshots.sh) | Orca chụp PA-01 → `assets/header-pa01-*` |
| [prototype/capture-portal-mr.sh](./prototype/capture-portal-mr.sh) | Orca chụp MR-PORTAL qua docs server `:57277` |
| [prototype/probe-portal-full.js](./prototype/probe-portal-full.js) | Probe PA-03..06 + viewport |
| [assets/](./assets/) | Ảnh PA-01 + `portal-*` MR batch |
| [assets/evidence/](./assets/evidence/) | Probe JSON mỗi ảnh |
| [../../reviews/assets/MR-PORTAL-2026-10-23/](../../reviews/assets/MR-PORTAL-2026-10-23/) | Mirror evidence + `source-manifest.json` |

## PA-01 — Quyết định header (one pattern)

**Pattern chốt: Two-tier chrome** — tách **điều hướng tài khoản** khỏi **ngữ cảnh tenant/sự kiện**.

### Tier A — `ProLayout` header (cố định ~56px)

| Slot | Nội dung | Ghi chú |
| --- | --- | --- |
| Leading | Collapse menu (mix layout) | Giữ `breakpoint="lg"` |
| Brand | `Vemoki Portal` một dòng | `white-space: nowrap`, `text-overflow: ellipsis`, `max-width` responsive (≈140px mobile → 200px desktop); link `/` |
| Trailing | Account `Dropdown` + `Button type="text"` | Giữ `trigger={['click']}`, `data-testid="account-menu"` |
| **Không** đặt ở Tier A | Tenant/event `Select`, hint iOS scan | Đây là nguyên nhân vỡ 390px (minWidth 200 × 2 + hint dọc) |

### Tier B — Context strip (ngay dưới header, full width)

| Thành phần | AntD | Hành vi |
| --- | --- | --- |
| Tổ chức | `Select` + `<label>` visible hoặc `Form.Item` label | `aria-label` = `shell.tenant.label`; placeholder/empty/disabled giữ contract hiện tại |
| Sự kiện | `Select` `allowClear` | `shell.event.*`; clear → `/t/{tenantId}` |
| iOS scan hint | `Typography.Text type="secondary"` hoặc `Alert type="info" showIcon` **một dòng** | Chỉ khi `showGateScanHint`; copy `gateDeeplink.h_iosHint`; **không** `GateIosScanHint` trong `actionsRender` header |

**Responsive**

| Viewport | Layout strip |
| --- | --- |
| &lt;768px | Hai `Select` full width, stack; hint full width **dưới** hai field (wrap bình thường, không `writing-mode`) |
| ≥768px | Hai field ~240–280px; hint căn phải cùng hàng nếu còn chỗ |
| ≥1024px | Giữ strip; Tier A brand rộng hơn |

Khi label bị ellipsis: option list vẫn hiện full text; `optionLabelProp` / `title` trên option hoặc `Typography.Text ellipsis={{ tooltip: true }}` để screen reader và hover đọc được giá trị đầy đủ.

**Sizing token:** `paddingInline` 16 (mobile) / 24 (≥1024 content); gap `Space` 12–16; `Select` `width: 100%` mobile, **bỏ** `minWidth: 200` cứng trên mobile.

### Component slots (implement Web B)

```text
portal-pro-layout.tsx
  ProLayout.headerContentRender → null hoặc chỉ spacer (không Select)
  children đầu tiên trong <ProLayout> (sau skip link):
    <PortalContextStrip tenants events caps onTenant onEvent />
```

`PortalContextStrip` (tên gợi ý): client component, reuse logic `Select` từ layout hiện tại (lines 126–169 incumbent).

### Trạng thái UI

| State | Tier A | Tier B |
| --- | --- | --- |
| loading tenants/events | Brand + account OK | `Select` `loading` hoặc skeleton ngắn |
| `tenants.length === 0` | Account OK | Tenant disabled + `shell.tenant.empty` |
| no tenant selected | — | Event disabled + `shell.event.selectTenantFirst` |
| `tenantEvents.length === 0` | — | Event disabled + `shell.event.empty` |
| `showGateScanHint === false` | — | Không render hint |
| SUSPENDED/PENDING tenant | Giữ banner `SurfaceState` trong content (không đổi) | Strip vẫn hiện để đổi tenant |

### Keyboard / a11y

1. Skip link → `#portal-main` (giữ).
2. Tab order: menu → brand → account → tenant label+select → event label+select → hint (nếu có link thì focusable) → main.
3. Mỗi `Select`: label programatically associated (`aria-labelledby` hoặc `Form.Item`).
4. Account menu: giữ click trigger; không ẩn đổi tenant/event.

### AC quan sát (PA-01)

- [ ] 390×844 VI + EN: không chữ dọc, không overlap header/content; brand một dòng.
- [ ] Tên tổ chức/sự kiện dài (fixture `long=1` specimen): ellipsis trong `Select`, không page overflow ngang.
- [ ] 1024×900 và 1440×1000: tenant/event + account đều thấy và focus được.
- [ ] Đổi tenant/event: hành trình route giữ như incumbent (`router.push`).
- [ ] Hint scan: một dòng, đọc được trên mobile.

### Ảnh specimen (PD)

| File | Viewport | Locale / fixture |
| --- | --- | --- |
| `assets/header-pa01-vi-390x844.png` | 390×844 | VI |
| `assets/header-pa01-vi-long-390x844.png` | 390×844 | VI, tên dài (stack) |
| `assets/header-pa01-en-390x844.png` | 390×844 | EN |
| `assets/header-pa01-vi-1024x900.png` | 1024×900 | VI |
| `assets/header-pa01-vi-1440x1000.png` | 1440×1000 | VI, tên dài |
| `assets/header-pa01-en-1440x1000.png` | 1440×1000 | EN, tên dài |

Đối chiếu audit broken: [auth-event-guests-390x844.png](../../reviews/assets/portal-audit-2026-10-23/ux/auth-event-guests-390x844.png).

## PA-02 / PA-03 — Copy

Chi tiết key và câu chốt: [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md). Sơ đồ filter: [pa03-import-filter-diagram.md](./pa03-import-filter-diagram.md).

Tóm tắt:

- Loại jargon luồng chính: G-E1, `commit idempotent`, `stream authenticated`, `poll`, permission string trong câu user-facing.
- Giữ ý nghĩa trạng thái (accepted/delivered, unknown, READY semantics trong copy vận hành). VI: *tiếp nhận gửi / nhà cung cấp tiếp nhận* ≠ khách đã nhận email — không dùng «đã gửi» thay *delivered*.
- Filter nguồn/loại vé **chỉ** tab Import (PA-03).

### AC quan sát (PA-02..06) — specimen `portal-full-specimen.html`

| ID | Kiểm tra | Evidence |
| --- | --- | --- |
| PA-02 | Tab/alert Guests không jargon protocol; VI/EN toggle | `portal-guests-import-vi-390x844.png`, `portal-full-en-1024x900.png` |
| PA-03 | Pending/Export: không `import-catalog-filters` | Probe `portal-guests-pending-vi-1024x900.json` → `catalogVisible: false` |
| PA-04 | `Intl` locale VI vs EN + nhãn UTC | `portal-pa04-datetime-vi/en-390x844.png` |
| PA-05 | `aria-label` export ≠ `exportId` | Probe export tab → «Mã yêu cầu xuất» / «Export request ID» |
| PA-06 | Spinner `animation: none` khi `?rm=1` | [pa06-reduced-motion-notes.md](./pa06-reduced-motion-notes.md), `portal-pa06-rm-vi-390x844.png` |

Query gợi ý: `?page=guests&tab=export&locale=vi`, `?page=audit&auditTab=codes&locale=en`, `?page=platform&persona=operator&platformTab=grants`, `?long=1`, `?state=loading&rm=1`.

## Hướng dẫn triển khai

| Slice | Việc |
| --- | --- |
| Web B | Implement `PortalContextStrip` + thu gọn `headerContentRender` / `actionsRender` theo bảng trên |
| Web A | Áp bảng copy; di chuyển filter vào Import panel |
| Review | So specimen + AC; probe không bắt buộc trên specimen HTML |

**Non-goals:** đổi API, RBAC, palette staff, route IA, consumer web/mobile.

## Limitations

- Specimen dùng AntD CDN, không bundle portal — chỉ minh họa bố cục/copy strip.
- Chưa chụp trạng thái loading/error authenticated trên app thật; Web B verify trên fixture D9.
- Touch thiết bị vật lý và screen reader toàn app: ngoài scope PD (audit đã ghi).
