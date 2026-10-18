# Visual Identity v2 — Live Pulse (freeze)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#486](https://github.com/hangndat/ticket-solution/issues/486) |
| Issue | [#487](https://github.com/hangndat/ticket-solution/issues/487) — freeze Live Pulse + brand tokens |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../agents/roles/product-design.md) |
| Visual budget | **Có** — chi tiết mục 0 trong [`visual-notes.md`](./visual-notes.md) |
| Architecture impact | **Có (hẹp)** — cập nhật shared brand tokens / mark; không đổi API/OIDC |
| Ownership artifact | `docs/design/visual-identity-v2/**` + `brand/vemoki/` (tokens + mark) |
| Art direction | **Live Pulse** |
| Trạng thái | **Handoff PD** — chưa claim pilot / production ready |

**Nguồn token chốt:** [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json)  
**Baseline flow/state (không copy palette cũ):** [`docs/design/ux-ui-revamp/`](../ux-ui-revamp/) · marketing: [`docs/design/o13-platform-sales/`](../o13-platform-sales/)

### Artifact trong thư mục

| File | Nội dung |
| ---- | -------- |
| [README.md](./README.md) | Mục 1–5: flow map, states tóm tắt, a11y, UI AC, triển khai |
| [visual-notes.md](./visual-notes.md) | Mục 0: Live Pulse freeze + priority screens |

### DoD role product-design (checklist)

- [x] **0** Brand/visual budget — tokens Live Pulse, type Sora / Be Vietnam Pro, surfaces, anti-patterns, motion, **5** priority screens, freeze
- [x] **1** User flow map (web ∥ iOS) theo priority screens
- [x] **2** UI states tối thiểu trên 5 màn
- [x] **3** Accessibility WCAG 2.2 AA mục tiêu
- [x] **4** UI AC + map UAT headless
- [x] **5** Hướng dẫn triển khai web ∥ iOS (không BE, không invent palette)

**OUT Issue #487:** code trong `apps/web` / `apps/mobile` (chỉ docs + `brand/vemoki/`). Không Android, không Portal, không Gate/Scanner redesign.

---

## 1. User flow (map — không đổi IA)

Persona: **Attendee / khách công khai** + **marketing visitor** (hero O13). Staff Gate / Admin OUT.

```text
[Marketing hero — vemoki.com]
  → CTA Demo / Quan tâm / Login outbound app host
[app Home `/`]
  → catalog / spotlight → Đổi mã hoặc deep-link sự kiện
[Đổi mã]
  → auth CTA trên màn gốc nếu cần → form → vé / ví / chi tiết
[Ví]
  → list → Chi tiết vé + QR
```

Phiên: CTA trên Home / Đổi mã / Ví → web `/api/auth/login?return=…` · iOS OIDC sheet. Không màn `/auth` product.

### Touch map

| Việc | Web | iOS |
| ---- | --- | --- |
| Marketing hero | O13 sales host — **primary** brand plane | N/A (sales web) |
| Home / catalog | `/` — **primary** | Events shell |
| Đổi mã | `/redeem` | `redeem` |
| Ví | list phụ | `my-tickets` **primary** |
| Chi tiết vé + QR | `/t/…/tickets/[id]` | `ticket-detail` |

---

## 2. UI states (tóm tắt)

Áp dụng palette Live Pulse trên mọi state; copy VI khách; không lộ Nest/BFF/UUID thô trên chrome.

| Screen | empty | loading | ready | error/retry | denied / expired |
| ------ | ----- | ------- | ----- | ----------- | ---------------- |
| Marketing hero | — | soft fade hero | brand + CTA + atmosphere | — | — |
| Home | «Chưa có sự kiện đang mở» | skeleton / «Đang tải…» | brand + list + CTA | «Không tải được» + Thử lại | notice plain trên Home |
| Đổi mã | chọn sự kiện | «Đang xử lý…» | form + điều khoản | Thử lại / «Kiểm tra lại» | mã/hết suất; auth CTA |
| Ví | «Chưa có vé» + CTA Đổi mã | «Đang tải vé…» | list theo sự kiện | Thử lại | signed-out CTA trên Ví |
| Chi tiết vé | — | «Đang tải vé…» | QR + meta | về ví | hết hạn/đã dùng — không gợi ý quét cổng |

Chi tiết state machine giữ tương thích [`ux-ui-revamp/README.md`](../ux-ui-revamp/README.md) §2 — **chỉ đổi token/type theo v2**.

---

## 3. Accessibility

| Hạng mục | Yêu cầu |
| -------- | ------- |
| Contrast | ink `#0B1220` trên paper `#F4F6F8`; signal fill `#E11D48` → chữ paper/white đủ AA |
| Focus | ring `focus` `#2563EB` ≥2–3px + offset (web); VoiceOver order brand → CTA → list (iOS) |
| Hit target | ≥ 44×44 |
| Labels / live | form redeem + marketing interest; `aria-live` / announce |
| Reduced motion | bắt buộc nếu ship motion mục 0 |
| QR | accessible name «Mã QR vé [sự kiện]» |

---

## 4. UI AC + UAT headless

| # | Given / When / Then |
| - | ------------------- |
| AC1 | Given handoff v2 · When implementer mở `tokens.json` · Then ink/paper/signal/focus + Sora/Be Vietnam Pro khớp bảng freeze |
| AC2 | Given Home hoặc marketing hero · When first viewport · Then brand hero-level + 1 headline + 1 support + CTA group + 1 visual plane — không card cluster |
| AC3 | Given CTA primary · When render · Then fill `signal` `#E11D48`, không terracotta cũ `#9b3a18` |
| AC4 | Given focus keyboard · When Tab · Then ring `focus` `#2563EB` |
| AC5 | Given `prefers-reduced-motion: reduce` · When motion budget · Then tắt transform kéo dài |

**UAT map (sau coding, không thuộc PR docs này):** web → `scripts/web-uat.sh` / Playwright headless; iOS → `scripts/sim-uat.sh`. Screenshot first viewport Home + marketing nếu trong scope coding.

---

## 5. Hướng dẫn triển khai

| Hạng mục | Chỉ dẫn |
| -------- | ------- |
| Ownership | Coding: `apps/web` ∥ `apps/mobile` **sau** merge token freeze — Task coding riêng link artifact này. PR #487 **không** sửa app code. |
| Tokens | Import từ `brand/vemoki/tokens.json`; CSS vars `--ink` `--paper` `--signal` `--focus`; iOS theme cùng hex. |
| Type | Display **Sora**; body **Be Vietnam Pro**. Thay Syne (display cũ) khi đụng surface. Cấm Inter/Roboto/Arial/system-only hero. |
| Mark | `mark.svg` punch = `#E11D48`. Raster lockup/og/app-icon có thể lệch màu cũ → Ticket follow-up regenerate (không chặn freeze hex). |
| O13 | Marketing đọc lại [`o13-platform-sales/visual-notes.md`](../o13-platform-sales/visual-notes.md) (đã trỏ v2). Prototype CSS cập nhật ở Task web marketing. |
| Revamp #471/#472 | Flow/state vẫn đúng; **palette/type superseded** bởi Live Pulse v2. |
| Escalate | Thiếu token / cần màu thứ 5 / đổi IA → coordinator; không invent. |

### Thứ tự (sau DoD #487)

1. Merge brand tokens + PD freeze  
2. Web: globals/theme + Home/redeem/ticket surfaces  
3. iOS: theme + Events / redeem / wallet / ticket-detail  
4. Marketing O13: CSS + hero (song song nếu capacity)

### Good enough

- Bốn hex + hai font + mark punch đúng trên 5 priority screens  
- Chưa bắt buộc regenerate mọi PNG brand trong cùng PR docs
