# VD-03 — Delta handoff UI (mẫu chốt ↔ app hiện hành)

**Issue:** [#875](https://github.com/hangndat/ticket-solution/issues/875) · **Epic:** [#874](https://github.com/hangndat/ticket-solution/issues/874)  
**Tác giả:** Liv · Product Design · Persona theo `company/employees.json`  
**Baseline đối chiếu:** `14f3f56ea273b99a56b63ae632bfa983eff2ff8a` (branch `hangndat/vd03-ui-mapping`)  
**Mẫu chốt (concept):** `docs/design/vemoki-unified-v1/` — **không** coi HTML/PNG là UI production hay evidence runtime.  
**Quyết định sản phẩm:** [O23](../../DECISION-LOG.md) — Gate chỉ iOS Staff; không Web Gate; Portal `report.read` read-only.  
**Kế hoạch:** [VEMOKI-UNIFIED-DESIGN-IMPLEMENTATION-2026-10-24.md](../../plans/VEMOKI-UNIFIED-DESIGN-IMPLEMENTATION-2026-10-24.md)

Consumer tiếp theo: VD-04 (web), VD-05/06 (iOS), VD-07 (portal). Mỗi Task chỉ làm **delta** trong bảng dưới; không mở feature, payment, seat map, Wallet store, Android hay production asset không license.

---

## 0. Visual budget (Epic revamp — **Có**)

**Freeze:** Implementer không invent visual ngoài khối này + `brand/vemoki/tokens.json`. Thiếu token hoặc cần màn ngoài 5 priority → escalate coordinator.

### Tokens & nguồn

| Hạng mục | Chốt | Path SoT / adapter |
| --- | --- | --- |
| Brand chung | Live Pulse v2 — `ink`, `paper`, `signal`, `focus`, `admit`, `unknown`, radius/space | `brand/vemoki/tokens.json` |
| Marketing scoped | Neon dark `--vm-*` **chỉ** khi bật `html[data-vemoki-marketing='neon-v1']` | `design-system/marketing/tokens.css` — **không** ghi đè global product |
| Consumer web | Tailwind v4 `@theme` từ generator O22 | `apps/web` globals + `@ticket/ui` |
| iOS | Generated semantic từ cùng SoT | `apps/mobile/src/theme/*` |
| Portal | Ant Design `ConfigProvider` — **cần nâng** palette hiện tại lên Live Pulse, không copy gradient marketing | `apps/portal/src/theme/vemoki.ts` → đối chiếu `design-system/product/implementation/portal-antd-theme.ts` |
| Gate semantics | Xanh chỉ `APPLIED` có thẩm quyền; queued/unknown **không** neon/celebration | `apps/mobile/src/gate/*`, classifier backend — **giữ** |

### Typography

| Vai trò | Font | Cấm |
| --- | --- | --- |
| Display / H1 marketing & hero sự kiện | **Sora** | Inter, Roboto, Arial, system-only hero |
| Body / form / bảng | **Be Vietnam Pro** | Default stack làm headline |
| Portal dense | Be Vietnam Pro + AntD token | Serif marketing trên bảng ops |

### Surfaces & anti-patterns

- **Marketing:** gradient/glow/3D ribbon **quanh hero + CTA cuối**; thân trang và form lead giữ đọc được khi tắt gradient.
- **Product (attendee/staff/portal):** atmosphere nhẹ (paper wash / navy chrome staff); **không** port full neon hero vào scanner hay ô bảng.
- **Anti-patterns (3–6):** (1) Purple AI-default trên nền trắng ops; (2) card cluster trong viewport đầu consumer; (3) overlay badge trên ảnh hero; (4) social proof / số liệu giả; (5) QR demo `qr-demo-not-valid.png` làm vé thật; (6) link/icon scanner trên web/portal.

### Motion

1. **Marketing hero:** parallax/orb nhẹ — `prefers-reduced-motion` → tĩnh.  
2. **Đổi mã / vé:** fade-in outcome ngắn (đã có pattern consumer — **giữ**, không fade header về opacity 0).  
3. **Staff scan:** lock UI in-flight; không toast che khung camera.

### Priority screens (5 — đợt unified v1)

| # | Màn / surface | Route / file đại diện | Owner Task |
| --- | --- | --- | --- |
| 1 | Marketing home + lead | `apps/web/app/marketing/**`, `src/marketing/marketing-surface.ts` | VD-04 |
| 2 | Attendee web — sự kiện → đổi mã → vé/QR | `…/events/[eventSlug]`, `redeem`, `wallet`, `tickets/[ticketId]` | VD-04 |
| 3 | Attendee iOS — ví + QR | `apps/mobile/src/screens/my-tickets.tsx`, `ticket-detail.tsx` | VD-05 |
| 4 | Staff iOS — quét + outcome | `staff-scan.tsx`, `src/gate/**` | VD-06 |
| 5 | Portal — overview + Gate report read-only | `apps/portal/app/t/[tenantId]/**`, gate report routes | VD-07 |

---

## 1. Ma trận giữ / sửa / bỏ (tránh hồi quy #870)

**#870 / #869 đã nghiệm thu trên web** (`docs/reviews/UI869-DELIVERY.md`): locale nav, hero/media provenance, catalog card height, shared inputs/empty/skeleton, header không fade-to-zero. Cột **Giữ** = không revert khi áp Neon.

### Marketing (`vemoki.com`)

| Hạng mục | Giữ | Sửa | Bỏ |
| --- | --- | --- | --- |
| Shell header/locale | Nhóm locale `5.5rem`, sticky blur, skip link, VI/EN không nhảy layout | Áp palette neon scoped (`--vm-*`) trên hero/footer ink; gradient headline theo mẫu | Fade header về opacity 0; đưa locale vào flex nav co giãn |
| Hero & CTA | Copy/CTA thật (`Xem demo`, form lead); ảnh sản phẩm **có manifest** trong `apps/web/public/marketing/product/` | Bố cục cinematic: human subject + ribbon (scoped CSS); giảm paragraph feature | Mock browser/device/QR giả; bento ảnh capability không có |
| Feature / pricing | Validation form, business copy đã kiểm | Typography lớn, ít đoạn; icon/ribbon trang trí có kiểm soát | Testimonial/logo/số attendee giả |
| Motion | `prefers-reduced-motion` | Orb/gradient hero (optional layer) | Entry che nội dung chờ tải |

### Attendee web (`app.vemoki.com`)

| Hạng mục | Giữ | Sửa | Bỏ |
| --- | --- | --- | --- |
| Chrome & loading | `ConsumerPageShell`, skeleton theo route, shared form chrome | Event header branded + CTA signal theo prototype light attendee-web | Status card full-page loading |
| Catalog / Khám phá | `CatalogEventCard` flex + CTA đáy thẳng hàng | Event art hierarchy, atmosphere nhẹ trên detail | — |
| Redeem / claim | Auth gate SSR, unknown outcome không vé giả | Copy theo COPY-GUIDE; surface state rõ pending/invalid | — |
| Wallet / QR | Quiet zone, session/tenant isolation đã test | Card vé trắng, metadata 12px+; nhãn offline cached | QR demo asset từ gói design |
| Gate | Route `/gate` retired; test session refresh | Copy hướng dẫn Staff iOS nếu còn link lịch sử (theo VD-01/02) | Camera, scanner, `gate.confirm` UI |

### Attendee iOS

| Hạng mục | Giữ | Sửa | Bỏ |
| --- | --- | --- | --- |
| Theme | Live Pulse tokens + Sora/Be Vietnam Pro đã wired | Event card imagery, ticket detail composition (media plane) | Second tab bar / IA mới |
| Flows | OIDC, redeem, wallet contract | Empty/error/offline copy VI; Dynamic Type pass trên priority | Scanner controls |
| Branding | Tenant switch xóa art cũ | Banner sự kiện theo tenant trên public surfaces | — |

### Staff iOS

| Hạng mục | Giữ | Sửa | Bỏ |
| --- | --- | --- | --- |
| Gate logic | Classifier, idempotency, offline queue — **không đổi protocol** | Panel outcome lớn, màu semantic flat; context sticky event/gate/session | Gradient celebration on admit |
| Camera | Edge-to-edge viewport (heuristic padding OK) | Label inset; connectivity + queue count | Web fallback link |
| Manual | Sheet Live Pulse (`gate-manual-confirm-*`) | Copy queued/unknown «Chưa xác nhận vào cổng» | — |

### Portal (`portal.vemoki.com`)

| Hạng mục | Giữ | Sửa | Bỏ |
| --- | --- | --- | --- |
| Auth / RBAC | Host cookies, capability nav, không `gate.confirm` action | Theme Live Pulse (`ink`/`paper`/`signal` mới) + sidebar navy theo prototype | Scanner route/icon |
| Gate report | `report.read` only, `asOf`/stale | Layout compact + summary card mobile; hint «Quét vé bằng ứng dụng Vemoki trên iPhone» | Camera, admission CTA |
| Data | Server-backed tables, masked PII | Readiness checklist visual theo portal.html | Số liệu minh họa không gắn API |

---

## 2. User flow (tóm tắt — chi tiết `design-system/product/FLOWS-AND-STATES.md`)

| Persona | Web | iOS | Portal |
| --- | --- | --- | --- |
| Attendee | Link sự kiện → detail → đổi mã → email/OTP nếu cần → ví → QR | Tab Sự kiện → redeem → Vé của tôi → QR | — |
| Staff | **Không** — chỉ messaging migration link cũ | Staff workspace → chọn event/gate/ca → quét / nhập tay → outcome | — |
| Organizer | — | — | Login → org/event → readiness → guests → report cổng (read-only) |

**Nhánh bắt buộc trong scope:** invalid/expired code, quota hết, pending approval, network error + retry, forbidden/private event, ticket revoked/used, logout/tenant switch, camera denied (staff), offline queue không admit, report stale.

---

## 3. Trạng thái giao diện (contract copy gợi ý)

Áp dụng component `SurfaceState` / pattern hiện có; copy tiếng Việt — bảng đầy đủ: `design-system/product/implementation/COPY-GUIDE.md`.

| State | Khi nào | UI / copy (rút gọn) |
| --- | --- | --- |
| empty | Không sự kiện / không vé | «Chưa có …» + một CTA (khám phá / đổi mã) |
| loading | Fetch | Skeleton route-specific (#870) — không spinner-only full page |
| ready | Có dữ liệu | Nội dung chính + metadata timezone |
| error / retry | 5xx / mạng | «Không tải được…» + «Thử lại»; redeem giữ unknown không fake success |
| denied / forbidden | RBAC / private | «Bạn không có quyền…» / «Sự kiện không công khai» |
| offline (vé) | Cache QR | «Bản vé đã lưu · Trạng thái có thể chưa cập nhật» |
| offline (staff queue) | Chưa sync | Amber «Chờ đồng bộ — Chưa xác nhận vào cổng» — **không** xanh |
| stale (portal report) | `asOf` cũ | «Dữ liệu đến …» + refresh |

---

## 4. Mẫu trực quan đại diện (1–3 màn — **reference render**, không runtime)

| # | Surface | File | Viewport render | State | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| A | Marketing Neon | [`design-system/marketing/desktop.png`](design-system/marketing/desktop.png) | 1440× logical (asset 2880×4762 @2x) | Hero + CTA | Dark neon **scoped**; production hiện **light Live Pulse** — delta là migrate có flag, không đổi product tokens global |
| B | Attendee web | [`design-system/product/previews/attendee-web.png`](design-system/product/previews/attendee-web.png) | 1440×1659 | Event → ticket light | Đối chiếu `attendee-web.html`; implement trên route consumer thật |
| C | Staff iOS | [`design-system/product/previews/staff-mobile.png`](design-system/product/previews/staff-mobile.png) | 390×1556 | Scan + outcome | HTML prototype; runtime = Expo screens + device UAT |

**Portal (tùy chọn reviewer):** [`design-system/product/previews/portal.png`](design-system/product/previews/portal.png) — 1440×1298.

**Xác nhận mẫu:** design complete 24/10/2026 per `DESIGN-ACCEPTANCE.md`. Implementer xác nhận pixel trên **app build**, không trên PNG.

---

## 5. Asset & font provenance

| Asset class | Trong gói design | Production |
| --- | --- | --- |
| `event1–4.jpg`, `hero-figure.png` | Minh họa; **chưa** biên nhận license publish | Ảnh sự kiện thật từ tenant/media API hoặc placeholder có nhãn |
| `qr-demo-not-valid.png` | Cố ý invalid | **Cấm** ship |
| Marketing product shots #870 | — | Runtime capture + hash trong filename + manifest |
| Logo | `brand/vemoki/mark.svg` | Dùng mark chính thức; không V placeholder trong HTML marketing |
| Font | Sora + Be Vietnam Pro (bundled mobile; web self-host) | Không link CDN ngoài policy |

---

## 6. Accessibility (WCAG 2.2 AA mục tiêu)

| Kiểm tra | Prototype | App (bắt buộc evidence) |
| --- | --- | --- |
| Contrast text/CTA | Static scan PASS (`ACCESSIBILITY-REMEDIATION.md`) | axe/computed trên build thật |
| Keyboard / focus | HTML prototype | Web consumer + marketing form |
| Hit target ≥44px | Prototype scoped | Web + iOS priority screens |
| Screen reader | — | VoiceOver staff outcome; web landmarks |
| Reduced motion | CSS media query trong prototype | Giữ #870: không ẩn header |
| Dynamic Type | — | iOS ticket detail + staff panel |

**Giới hạn:** ảnh tĩnh không chứng minh focus order runtime; reviewer ghi limitation trong artifact.

---

## 7. Tiêu chí nghiệm thu UI (delta VD-03 → consumer Tasks)

- [ ] **K-01** Bảng giữ/sửa/bỏ được implementer ký nhận trong PR VD-04/05/06/07; không revert #870 locale/hero/skeleton/header.
- [ ] **K-02** Không scanner/admission trên web/portal; Staff chỉ iOS (O23).
- [ ] **K-03** Gate outcome: xanh chỉ admit có thẩm quyền; queued/unknown không lẫn success.
- [ ] **K-04** Marketing neon (nếu bật) scoped; `brand/vemoki/tokens.json` unchanged globally.
- [ ] **K-05** Portal theme cập nhật khỏi palette terracotta legacy trong `vemoki.ts` hoặc Task ghi explicit exception.
- [ ] **K-06** Copy VI theo COPY-GUIDE; không social proof giả.
- [ ] **K-07** Responsive 320/390/768/1024/1440 không overflow (re-test trên app).
- [ ] **K-08** Evidence: screenshot Orca browser/emulator — SHA build, route, viewport, persona, state; QR/ camera trên thiết bị thật khi AC Gate.

---

## 8. Hướng dẫn triển khai

| Surface | Path | Gợi ý component/token |
| --- | --- | --- |
| Marketing | `apps/web/src/marketing/*` | Bật `data-vemoki-marketing='neon-v1'` + import scoped tokens; giữ `marketing-surface.ts` utilities |
| Attendee web | `apps/web/app/(consumer)/**` | `@ticket/ui`, Live Pulse utilities; event detail composition |
| iOS | `apps/mobile/src/screens/*`, `components/*` | `screen-atmosphere`, `attendee-cta`; gate unchanged contract |
| Portal | `apps/portal/src/theme/vemoki.ts`, layouts | Map `implementation/portal-antd-theme.ts`; ProComponents giữ |

**Thứ tự:** VD-04 sau VD-02 (gate link); VD-05 ∥ VD-06 slot; VD-07 song song khi VD-03 đủ. **Good enough MVP:** 5 priority screens khớp delta; polish ngoài bảng → Issue riêng.

**Phụ thuộc coordinator:** VD-01 behavior link `/gate` cũ; không invent Web Gate.

---

## 9. Checks tài liệu (Task VD-03)

| Lệnh | Kết quả tại baseline |
| --- | --- |
| `git rev-parse HEAD` | `14f3f56ea273b99a56b63ae632bfa983eff2ff8a` |
| `python3 docs/design/vemoki-unified-v1/VERIFY.py` | PASS — 56 payload files |

Không chạy feature CI — scope docs-only.

---

## 10. Điểm mở / escalate

1. License ảnh marketing neon trước go-live.  
2. Portal palette migration vs AntD regression — owner VD-07 + snapshot visual.  
3. Mức độ «dark neon» marketing vs giữ light shell #870 — nếu user muốn full dark, cần xác nhận không ảnh hưởng consumer subdomain chrome.

---

*Handoff PD — Liv · Issue #875 · baseline `14f3f56ea273` · Không feature code.*
