# Review mockup UI uplift #766 / #770

| Trường | Giá trị |
| --- | --- |
| Reviewer | **Mira · ux** — dispatch `ctx_d8bb02100f05`, task `task_b112ad63dae2`, terminal `term_4237c344-396d-4bb3-b9b7-05895e97b595` |
| Độc lập | Session reviewer-only; không đọc `docs/reviews/*` review trước; không sửa source mockup |
| Scope | Prototype HTML tĩnh `docs/design/ui-uplift-2026-10/marketing/` + `app/` (Epic #770 marketing, #766 app uplift) |
| Source SHA | `de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5` (`git rev-parse HEAD` trên worktree) |
| File hashes | Theo `docs/reviews/uiux-mockup-2026-10-22/source-manifest.json` |
| Căn cứ nội dung | `docs/PRD.md`, `docs/TECHNICAL-DESIGN.md`, `docs/DECISION-LOG.md`, `docs/ROADMAP.md` (phần liên quan); brief `docs/reviews/MKT-PD-EVENT-OS-SPEC-2026-10-22.md`; `brand/vemoki/tokens.json` |
| Skills / checklist | **impeccable** playbook `critique` (đánh giá hierarchy, Persuade/Operate, craft — không chạy `init`/PRODUCT.md); **web-design-guidelines** checklist upstream `vercel-labs/web-interface-guidelines` @ `command.md` (fetch 2026-10-22) trên `marketing/*.{html,css,js}`, `app/*.{html,css}`; **orca-cli** + `.cursor/rules/uat-headless.mdc` cho browser evidence |
| Giới hạn phương pháp | Critique **single-context** (không spawn sub-agent Assessment A/B impeccable); không kiểm keyboard/focus thực tế, reduced-motion render, hay production a11y audit |

## Môi trường & coverage

| Surface | URL | Viewport / khung | Locale | States đã xem |
| --- | --- | --- | --- | --- |
| Marketing | `http://127.0.0.1:63783/marketing/` | Outer viewport mặc định Orca; **khung mockup** Desktop 1280 & Mobile 390 (nút prototype) | VI chủ đạo; EN spot-check hero/footer | Hero, product preview trong hero, footer + form quan tâm, nhảy `#features` (hash) |
| App | `http://127.0.0.1:63783/app/` | Khung Desktop 1280 (mặc định); thử Mobile 390 (một lần chụp không đổi layout — xem Limitations) | VI | Guest catalog, event detail, redeem form / terms / error / success, wallet, ticket QR |

**Thanh prototype** (Desktop/Mobile, VI/EN, grid màn hình app): tách biệt UI sản phẩm — không tính là bug production.

### Lệnh Orca browser (evidence)

- `orca tab create --url http://127.0.0.1:63783/marketing/ --worktree path:/Users/admin/orca/workspaces/main/FE-refactor` → `browserPageId` `68489425-d191-4660-9e61-2f66e2fddc09`
- `orca tab create --url http://127.0.0.1:63783/app/` → `browserPageId` `58d403af-cb51-4512-8369-f5c6a346dea6`
- `orca exec --page <id> --command "snapshot|click @e…|screenshot <path>|goto …|press End"` (không dùng `resize` — command không hỗ trợ)
- Đóng tab worker: `orca tab close --page` cho hai page trên

### Ảnh (`assets/worker/`)

| File | Mô tả ngắn |
| --- | --- |
| `marketing-vi-desktop-1280.png` | Hero VI, nav đầy đủ, disclaimer demo |
| `marketing-vi-mobile-frame-390.png` | Hero mobile khung 390 |
| `marketing-en-mobile-frame-390.png` | Hero EN khung 390 |
| `marketing-vi-desktop-footer-1280.png` | Form quan tâm + footer |
| `marketing-en-desktop-hero-1280.png` | Footer/nav EN (sau toggle locale) |
| `marketing-vi-desktop-features-1280.png` | Vùng form (sau `goto #features`) |
| `app-catalog-vi-desktop.png` | Guest catalog |
| `app-event-detail-vi.png` | Event detail MFest |
| `app-redeem-form-vi.png` | Đổi mã — form |
| `app-redeem-terms-vi.png` | Xác nhận điều khoản |
| `app-redeem-error-vi.png` | Lỗi đổi mã |
| `app-redeem-success-vi.png` | Thành công (đã chụp) |
| `app-wallet-vi.png` | Ví vé |
| `app-ticket-qr-vi.png` | QR vé + nhãn minh họa |
| `app-guest-catalog-mobile-390.png` | Chụp sau bấm Mobile 390 — vẫn layout desktop (limitation) |

## Điểm làm tốt (mockup scope)

1. **Messaging EOS + trung thực demo:** Headline/subhead/bullet khớp hướng `MKT-PD-EVENT-OS-SPEC`; disclaimer «Demo giả lập» có `role="status"`; card sự kiện gắn nhãn DEMO — phù hợp rào anti-marketplace / không logo khách giả.
2. **Live Pulse v2 trên marketing:** Hero ink + CTA signal, preview sản phẩm thật trong khung `app.vemoki.com`, bento/section IDs bám IA 8 block (trust, features, how, solutions, outcomes, faq, interest).
3. **Luồng attendee redeem:** Form → terms → error/success có copy hướng dẫn bước tiếp; QR kèm «Mã minh họa»; strip `role="status"` prototype — dễ bàn giao implementer.

## Findings

| ID | Vấn đề | Tác động | Evidence | Mức độ | Điều kiện đóng |
| --- | --- | --- | --- | --- | --- |
| **UX-MKT-001** | Mobile 390 **ẩn toàn bộ** `mkt-nav-links` (Features, FAQ, …) **không** thay bằng menu/drawer/footer anchor | Người mobile chỉ còn locale + Đăng nhập + CTA; khó điều hướng nội dung dài ngoài scroll | `marketing/css/marketing.css` L1762–L1764; `marketing-vi-mobile-frame-390.png` | **Cao** (mockup ship 390) | Thêm pattern menu (sheet) hoặc footer link tới `#features`…; giữ CTA hero |
| **UX-MKT-002** | Form **Đăng ký quan tâm** label/consent **hardcode VI**; chỉ nút submit dùng `data-i18n` | Locale EN: nav/footer EN nhưng form vẫn VI → lệch spec VI+EN | `marketing/index.html` L493–L524; `marketing-en-desktop-hero-1280.png` (nav EN + label VI + «Submit») | **Trung bình** | Gắn `data-i18n` / bảng copy EN cho toàn form + consent |
| **UX-MKT-003** | `goto …/marketing/#features` **không** cuộn tới section features trong khung `.site` | Anchor header ngoài khung browser mockup; demo IA kém tin cậy | `marketing-vi-desktop-features-1280.png` (vùng interest); hash trên URL outer | **Thấp** (prototype) | Scroll target trong `.site` hoặc JS scrollIntoView trong frame |
| **UX-MKT-004** | Option vai trò form lẫn EN («Tenant Owner», «Agency») khi UI VI | Mất nhất quán thuật ngữ PD §1.3 | `marketing/index.html` L507–L511 | **Thấp** | VI hóa option hoặc song ngữ có chủ đích |
| **UX-APP-001** | State **Guest · Catalog** nhưng chrome **đã đăng nhập** (Vé của tôi, avatar Minh Anh) | Review guest→redeem khó tách; gây hiểu nhầm quyền | `app-catalog-vi-desktop.png`; prototype bar «Guest · Catalog» | **Trung bình** (handoff) | Bản Guest catalog tách nav guest (ẩn vé/tài khoản) hoặc ghi chú rõ «user có vé» |
| **UX-APP-002** | **Event detail** guest hiển thị «Bạn có 2 vé — Xem vé» | Guest chưa redeem vẫn thấy vé — lệch journey | `app-event-detail-vi.png` | **Trung bình** | State guest: CTA đổi mã / nhận lời mời thay block vé |
| **UX-APP-003** | Top nav 5 mục + locale + avatar trên **chiều ngang hẹp** (chưa xác minh sheet mobile trong khung 390) | Rủi ro tràn/chật trên 390 thật | Code có `.mobile-menu-btn` (`app-uplift.css` L1270–L1278); chụp mobile app không đổi layout | **Thấp–TB** | Chụp/verify khung Mobile 390 + mở menu sheet trong evidence |
| **UX-CODE-004** | Checklist web: marketing form **tốt** (label `for`, autocomplete); app search có `aria-label` — **không** phát hiện `outline-none` / `transition: all` trong mockup CSS | — | Grep mockup CSS; `app/index.html` L411 | — (pass hẹp) | Giữ khi port sang Next |

### Thứ tự ưu tiên đề xuất

1. UX-MKT-001 → UX-MKT-002 → UX-APP-001 / UX-APP-002 → UX-MKT-003 / UX-MKT-004 → UX-APP-003

## Limitations

- Không đọc artifact review UI/UX trước trong repo (theo task).
- Không test keyboard tab order, focus ring thực tế, `prefers-reduced-motion` render (chỉ thấy rule CSS `@media (prefers-reduced-motion: reduce)`).
- Outer Orca viewport không đổi kích thước (`resize` unknown); mobile marketing/app dựa **khung CSS** `.browser.mobile` — đủ cho mockup, khác device thật.
- EN mobile: một lần bấm locale; hero EN đúng trong ảnh EN; không audit toàn trang EN.
- Chưa xem: marketing mid-page scroll đầy đủ (trust bento, outcomes chart), app Wallet empty, Loading/Error/Toast, redeem gate, claim invite, User catalog, account tabs.

## Kết luận (scope mockup HTML)

Prototype **đạt hướng** brief EOS / Live Pulse v2 và **đủ** để PD→FE handoff **sau khi** xử lý navigation mobile marketing và đồng bộ locale/states guest app. Không phát hiện claim marketplace hay logo khách giả trong phần đã xem. **Không** đưa verdict PASS/FAIL production; coordinator tổng hợp từ báo cáo này.
