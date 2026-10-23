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

**Mẫu trực quan trong thư mục này là specimen PD (banner vàng «PD demo»), không chứng minh runtime authenticated.**

## Artifact

| Path | Nội dung |
| --- | --- |
| [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md) | Bảng copy VI/EN Guests Import / Pending / Notifications / Export + PA-03 scope filter |
| [prototype/header-specimen.html](./prototype/header-specimen.html) | HTML/React+AntD CDN — two-tier chrome |
| [prototype/capture-screenshots.sh](./prototype/capture-screenshots.sh) | Orca browser chụp ảnh vào `assets/` |
| [assets/](./assets/) | Ảnh 390 / 1024 / 1440 (sau chạy script) |

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
| `assets/header-pa01-vi-long-390x844.png` | 390×844 | VI, tên dài |
| `assets/header-pa01-vi-1024x900.png` | 1024×900 | VI |
| `assets/header-pa01-vi-1440x1000.png` | 1440×1000 | VI, tên dài |
| `assets/header-pa01-en-1440x1000.png` | 1440×1000 | EN, tên dài |

Đối chiếu audit broken: [auth-event-guests-390x844.png](../../reviews/assets/portal-audit-2026-10-23/ux/auth-event-guests-390x844.png).

## PA-02 / PA-03 — Copy

Chi tiết key và câu chốt: [copy-guests-pa02-pa03.md](./copy-guests-pa02-pa03.md).

Tóm tắt:

- Loại jargon luồng chính: G-E1, `commit idempotent`, `stream authenticated`, `poll`, permission string trong câu user-facing.
- Giữ ý nghĩa trạng thái (accepted/delivered, unknown, READY semantics trong copy vận hành).
- Filter nguồn/loại vé **chỉ** tab Import (PA-03).

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
