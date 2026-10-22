# Review UI/UX mockup · lần 4 (reviewer-uiux)

## Reviewer / independence

| Trường | Giá trị |
| --- | --- |
| Reviewer | Mira · `reviewer-uiux` — dispatch `task_cb849fc0d913` / `ctx_92eab45ab6d6` |
| Độc lập | Session review ≠ tác giả prototype; chỉ đọc `source-manifest.json` + `review-4/task-spec.md` trong bundle (không đọc review UI/UX khác) |
| Skill | `impeccable` playbook **critique** (⚠️ DEGRADED: single-context — worker không spawn sub-agent Assessment A/B); không chạy `init`/PRODUCT.md |

## Scope / phiên bản

| Trường | Giá trị |
| --- | --- |
| Epic | #770 (marketing), #766 (app attendee) |
| Paths | `docs/design/ui-uplift-2026-10/marketing/`, `docs/design/ui-uplift-2026-10/app/` |
| Exact SHA | `de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5` (khớp `source-manifest.json`) |
| Loại | Prototype HTML tĩnh — **không** thay nghiệm thu runtime/DoD |

## Mẫu / môi trường

| Trường | Giá trị |
| --- | --- |
| Mẫu chuẩn | Prototype đang duyệt; brief `docs/reviews/MKT-PD-EVENT-OS-SPEC-2026-10-22.md`; token `brand/vemoki/tokens.json` |
| URL | `http://127.0.0.1:63783/marketing/`, `http://127.0.0.1:63783/app/` (server coordinator) |
| Viewport đo | Orca `set viewport 1440×900`; khung mockup: marketing desktop `frameWidth` **1260**, mobile **390**; app desktop **1280**, mobile **390** (`setView('mobile')`) |
| Locale | VI đầy đủ; EN spot-check marketing (toggle EN trong khung) |
| Persona / states | App theo bảng `screens` (guest/user, catalog → redeem/error/wallet/…); marketing hero, nav, form `#interest` |

## Checks / evidence

| Hạng mục | Cách kiểm | Kết quả tóm tắt |
| --- | --- | --- |
| Hành trình app | `choose(role, page)` + chụp desktop/mobile | Catalog, redeem-error (desktop + mobile) có ảnh; redeem-error có `role=alert` (eval) |
| Hành trình marketing | `device()` / `setLocale()` + scroll `#interest` | Hero VI mobile/desktop; form mobile; EN hero + eval nhãn form |
| Chrome probe | `ui-chrome-wrap-probe.js` qua `orca exec eval -b` | Marketing mobile form: 3 control nhiều dòng; app mobile catalog/redeem-error: 0 issue |
| A11y (hẹp) | DOM redeem-error | Có `[role=alert]`; **chưa** kiểm keyboard/focus/contrast tự động; **chưa** emulate `prefers-reduced-motion` (chỉ xác nhận có `.mkt-marquee`) |

### Ảnh & probe (SHA-256)

| File | SHA-256 (rút gọn đầu) | Ghi chú |
| --- | --- | --- |
| `mkt-vi-mobile-390-hero.png` | `2b4fd559…` | VI, mobile 390, hero |
| `mkt-vi-mobile-390-interest-form.png` | `448632db…` | Scroll `#interest` trong `.site` |
| `mkt-vi-desktop-1280-hero.png` | `63eb8f49…` | Khung 1260px — cuộn gần footer/form |
| `mkt-en-desktop-1280-hero.png` | `aac334fb…` | EN bật (aria-pressed), hero EN |
| `app-vi-desktop-1280-guest-catalog.png` | `f4854777…` | Guest catalog desktop |
| `app-vi-desktop-1280-redeem-error.png` | `e39235f1…` | User redeem-error desktop |
| `app-vi-mobile-390-guest-catalog.png` | `43eb8bab…` | Guest catalog mobile |
| `app-vi-mobile-390-redeem-error.png` | `8619e5a1…` | User redeem-error mobile |
| `probe-marketing-mobile-interest-form.json` | `113d7c7c…` | 3 wrap (Email, Ghi chú, Gửi đăng ký) |
| `probe-app-vi-mobile-guest-catalog.json` | `c64d7c58…` | `issues: []` |

**Limitation evidence:** Lô chụp desktop app ban đầu (redeem-gate, wallet, …) trùng hash với catalog — **không** dùng làm bằng chứng; chỉ cite ảnh có nội dung đã đối chiếu ở bảng trên.

## Findings

| ID | Loại | Vấn đề | Tác động | Bằng chứng | AC / mẫu | Mức | Đóng khi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **UX-4-01** | `chrome` | Marketing mobile 390: H1 hero xếp **một từ mỗi dòng** (stack dọc quá sâu), subhead/CTA/disclaimer không còn trong viewport đầu | Khó đọc value prop; user mobile không thấy CTA + nhãn demo ngay | `mkt-vi-mobile-390-hero.png` | Spec §2 H1 + subhead; “có thể rút gọn mobile” — không đồng nghĩa tách từng từ | Cao (marketing) | Điều chỉnh `clamp`/line-break (`balance`, `hyphens`, rút gọn copy mobile) giữ ≥1 CTA + `role=status` demo trong fold |
| **UX-4-02** | `chrome` | Form `#interest` mobile: nhãn **Email công việc** (2 dòng), **Ghi chú (không bắt buộc)** (3 dòng), nút **Gửi đăng ký** (3 dòng) | Form trông lỗi layout; giảm tin cậy khi đăng ký quan tâm | `probe-marketing-mobile-interest-form.json`, `mkt-vi-mobile-390-interest-form.png` | Accessible patterns form marketing (spec §3) | Trung bình | Probe mobile `issues: []` cho các control form; hoặc full-width label + font-size/padding |
| **UX-4-03** | `IA` | Marketing mobile: `.mkt-nav-links { display: none }` — không còn Features/How/FAQ/Solutions; header chỉ locale + Đăng nhập + CTA | Người mua không điều hướng nội dung dài trang trừ scroll mù; không tương đương desktop | `mkt-vi-mobile-390-hero.png`; CSS `marketing.css` ~1762 | IA 8 section (spec §2) — cần path tới section trên mobile | Cao | Menu/ drawer hoặc anchor menu thay thế links ẩn |
| **UX-4-04** | `copy/locale` | Bật **EN**: H1/nav EN đúng, nhưng nhãn form `#interest` vẫn **tiếng Việt** (Họ tên, Email công việc, …) | Enterprise EN thấy trang “lẫn ngôn ngữ”; mất nhất quán EOS messaging | Eval: `setLocale('en')` → `formLabels` VI; `mkt-en-desktop-1280-hero.png` (nav EN) | Spec §1.3 thuật ngữ VI/EN; form interest thuộc CTA B | Cao | `data-i18n` đủ key form + submit EN |
| **UX-4-05** | `IA` | App catalog: **cùng lúc** `<select>` “Sắp diễn ra” và cặp chip “Sắp diễn ra / Tất cả” | Hai control một ý — tăng tải nhận thức, dễ không rõ state thật | `app-vi-desktop-1280-guest-catalog.png`, `app-vi-mobile-390-guest-catalog.png`; eval `select:true, pills:2` | Operate mode — một pattern filter (PD/web) | Trung bình | Giữ một kênh (chips **hoặc** select) + label rõ |
| **UX-4-06** | `lệch mẫu/AC` | Marketing desktop chụp hero: khung product ~**1260px** (không 1280) — lệch nhãn nút prototype nhưng đã ghi `frameWidth` đo | Rủi ro reviewer/implementer hiểu sai breakpoint | `probe-marketing-desktop-vi-hero.json` `frameWidth: 1260` | Layout handoff 1280/390 | Thấp | Ghi chú prototype hoặc chỉnh CSS max-width = 1280 |

**Điểm mạnh (không phải finding):** Redeem-error có copy hướng dẫn bước tiếp + CTA kép (`app-vi-desktop-1280-redeem-error.png`, mobile); nav app tách Đổi mã / Nhận lời mời; demo strip + badge DEMO nhất quán.

## Limitations / verdict

| | |
| --- | --- |
| **Verdict (prototype UI/UX)** | **PASS with known gap** — đủ để tiếp handoff implement với batch fix trên; gap chủ yếu marketing mobile IA/typography + i18n form, không chặn review workflow lần 4 |
| Chưa kiểm | Keyboard tab order, focus ring đo thực, contrast WCAG, `prefers-reduced-motion` trong browser profile, toàn bộ 8 section marketing từng section, runtime app thật |
| Pilot / DoD | Không kết luận pilot ready; không thay DoD PR |

## Phản hồi về role/workflow

1. **Nút viewport prototype vs đo thật:** `#btnMobile` / `#btn-mobile` click qua Orca đôi khi **không** gắn class `mobile` (app: vẫn `frameWidth` 1280); `setView('mobile')` / `device('mobile')` trong `eval` ổn định hơn — đề xuất task-spec thêm: *“ưu tiên API JS prototype (`setView`, `choose`, `setLocale`) trước click nút review chrome.”*
2. **Probe vs scroll:** Probe form marketing phải chạy **sau** `scrollIntoView(#interest)` trong `.site`; nếu không probe báo hero (0 issue) dù form có wrap — ghi một dòng trong bước 3 role: *“probe tại state đã cuộn tới control.”*
3. **Impeccable critique vs worker:** Playbook bắt sub-agent; worker Cursor không spawn — OK ghi DEGRADED, nhưng coordinator nên coi review prototype HTML là **exempt** sub-agent hoặc pin checklist rút gọn để tránh “failed critique” ngoài ý.
4. **Hash ảnh trùng:** Batch screenshot nhiều state cần assert DOM (tiêu đề màn) trước khi lưu — tránh artifact hàng chục file trùng nội dung như lô desktop app lần đầu.
