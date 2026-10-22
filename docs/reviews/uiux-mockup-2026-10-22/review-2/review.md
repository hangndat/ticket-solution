# Review UI/UX mockup — lần 2 (role `reviewer-uiux`)

## Reviewer / độc lập

| Trường | Giá trị |
| --- | --- |
| Reviewer | Mira · `ux` — dispatch `task_321a5ae0e7a0` / `ctx_ac8ec6a95c27` |
| Độc lập | Session review độc lập; không đọc artifact review lần 1 trong `docs/reviews/uiux-mockup-2026-10-22/` (trừ `source-manifest.json`) |
| Implementer / tác giả prototype | Không thuộc dispatch này (static HTML PD handoff) |

## Scope / phiên bản

| Trường | Giá trị |
| --- | --- |
| Epic / paths | #770 marketing, #766 app attendee — `docs/design/ui-uplift-2026-10/marketing/`, `docs/design/ui-uplift-2026-10/app/` |
| SHA | `de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5` (khớp `source-manifest.json`) |
| Loại | Prototype HTML tĩnh — **không** kết luận runtime / pilot |

## Mẫu / môi trường

| Trường | Giá trị |
| --- | --- |
| URL | `http://127.0.0.1:63783/marketing/`, `http://127.0.0.1:63783/app/` |
| Browser | Orca embedded — `browserPageId` `8f8b4e93-04f3-4f6b-b1f5-8f330bb7ad30` (`orca tab create` + `orca exec --page …`) |
| Viewport | Desktop **1280** và mobile **390** (nút trong thanh review prototype; khung `.browser.mobile` đổi bề rộng — đã xác minh trên ảnh mobile) |
| Locale | VI chính; EN spot-check (nút VI/EN trong khung marketing) |
| Persona / state | Đối chiếu bảng `screens` trong `docs/design/ui-uplift-2026-10/app/index.html` (guest/user × page) |
| Skills | `impeccable` (critique, không init); `web-design-guidelines` (heuristic, không audit file CSS); `orca-cli` + `uat-headless.mdc` |

### Lệnh evidence (rút gọn)

```text
orca tab create --url http://127.0.0.1:63783/marketing/ --worktree path:/Users/admin/orca/workspaces/main/FE-refactor
orca exec --page <id> --command "goto|click @eN|screenshot <path>"
```

## Bảng ảnh (đã mở lại & đối chiếu nhãn)

Mỗi ảnh: URL gốc, nút viewport active, tab state active (app), locale trong khung, nội dung khớp tên file.

| File | SHA-256 | Nội dung đã xác minh |
| --- | --- | --- |
| `marketing-vi-desktop-1280-hero.png` | `659cd60f5253a4cb2747397449e2f6ae30cde94b2aba2a58451957ee43795c44` | `/marketing/`, Desktop 1280, VI; hero proposition + CTA + disclaimer «Demo giả lập»; chrome `vemoki.com` |
| `marketing-vi-mobile-390-hero.png` | `e2f252b02455a736e5171274ecf2d627593d16215e4e6ad168d109241d0384f8` | Mobile 390, VI; khung hẹp, header gọn (logo, VI/EN, Đăng nhập, Đăng ký quan tâm) |
| `marketing-en-desktop-1280-hero.png` | `20b4d75b423f93a7be354caf06bf3967aa21ad355f1180d71c104d2fe44f5edb` | Desktop 1280, EN active; headline/nav EN («Run events from invite to gate…») |
| `marketing-en-desktop-1280-interest-form.png` | `60b2407088c5c71ebb5d8146f8eb6c5d1d1d05aa7e25fa6a3d1e70d0989dc48d` | Desktop 1280; block «Đăng ký quan tâm», copy «Không thanh toán trên form», checkbox consent, nút «Gửi đăng ký» |
| `marketing-vi-desktop-1280-interest-form.png` | `3c861becbea98b943f18509e02f5cf4d5ff3acf8e7947327857a209210e47bf4` | **Hạn chế:** hash `#interest` không cuộn nội dung trong khung mockup — ảnh vẫn là hero VI (không dùng làm evidence form); form VI lấy cùng layout từ ảnh EN (chỉ khác locale shell) |
| `app-vi-desktop-1280-guest-catalog.png` | `69e94ac9c0a3c7b1c8e0b5ee6ea9bea74e0b8f506ee7683b5923e15c14064f11` | Tab «Guest · Catalog», Desktop; nav **không** có «Vé của tôi»; strip mô phỏng |
| `app-vi-desktop-1280-user-catalog.png` | `17beee83b55a9f3d312cadfee5efed0b248442915c7b80be92af62fc380eb355` | Tab «User · Catalog»; nav có «Vé của tôi»; avatar «MA / Minh Anh» |
| `app-vi-desktop-1280-event-detail.png` | `8c97531f0b9b509d08028d22b0c0c4d6eb9b551adc3ab3a026944918f17fe810` | Tab «Event detail», user; MFest, CTA redeem |
| `app-vi-desktop-1280-redeem-gate.png` | `2f9e0e2e2b0db623acb436da6e1afe8b735adea1b0e79845f04f0231edbf0d4f` | Tab «Redeem · gate», **guest**; URL `…/redeem`; CTA «Đăng nhập để tiếp tục» |
| `app-vi-desktop-1280-redeem-form.png` | `44deb7fbe5bcc08679fdeea244d792e2a9d7cfddb440dc3ccae81d13399a9a9d` | Tab «Redeem · form», user; ô mã + «Tìm vé» |
| `app-vi-desktop-1280-redeem-terms.png` | `94ff84eeac8602d572afe10e7158239de70d13c3dc91828a346448a3c96c59e5` | Tab «Redeem · terms», user; checkbox điều khoản |
| `app-vi-desktop-1280-redeem-success.png` | `636ca3fcc099cc03e9d26e513a60a4141e8d1f84f4fffc14196a4288c2a1e052` | Tab «Redeem · success», user |
| `app-vi-desktop-1280-redeem-error.png` | `dee4c6422e2fea7736e674afc62093562cdd54c75b950fad8c10c83ee01bc395` | Tab «Redeem · error», user; hộp hướng dẫn + «Thử mã khác» / «Vé của tôi» |
| `app-vi-desktop-1280-claim-invite.png` | `9df55096cfab4760f25bc6bd41e5fff3dfc9a576e8d79c31432015b7483ccdad` | Tab «Claim invite», guest; callout phân biệt «Đổi mã» |
| `app-vi-desktop-1280-wallet.png` | `fcf41a612e2b449bd63040e44c062867cb2ce459d196f4189c55f0d2c9fcae60` | Tab «Wallet», user; danh sách vé |
| `app-vi-desktop-1280-wallet-empty.png` | `b969c41b21635060a5c334d7a0ffabb28c5e3c46c9b0bde322d73831dfd579ea` | Tab «Wallet empty», guest |
| `app-vi-desktop-1280-ticket-qr.png` | `99dfca65a1f7fbdf2cf9e871347659fb3759c49814938e5114575506de1798a1` | Tab «Ticket · QR», user; disclaimer QR minh họa |
| `app-vi-desktop-1280-account.png` | `91528a78abcfe555864e5f9cc1c9226e95804bb13b1df1575f6e36160e38e3e3` | Tab «Account», user |
| `app-vi-desktop-1280-loading.png` | `cf3506564f2db7cfe0c402fce164a2992fe126a0b7f5dbb61eb753f0c5c1bfbd` | Tab «Loading», guest |
| `app-vi-desktop-1280-catalog-error.png` | `eadfe9a778cfed67daac867446be0ebae5d6852a78fb3ebd49fdc4b3b577906f` | Tab «Error», guest; «Thử lại» |
| `app-vi-desktop-1280-wallet-toast.png` | `6c9a4a39d0b353c178a288bffc97724234bc069b5a65767c23c93cd5d0858b91` | Tab «Toast», user; toast check-in |
| `app-vi-mobile-390-guest-catalog.png` | `a21b68b32ec50fb13b86548f692cfe6930c9ff3f64cf5b2a2cd11370b03cbf05` | Mobile 390, «Guest · Catalog»; «≡ Menu» |
| `app-vi-mobile-390-wallet-nav.png` | `4dcb779178f8ffdaf7dc741ee4e66dcff73de2c643ac17f3ab3c5d0f1a123caf` | Mobile 390, «Wallet»; «≡ Menu», không thanh tab dưới |

**Hash:** 23 ảnh, không trùng SHA. Đã loại ảnh `marketing-vi-desktop-1280-form.png` (full-page sai scope).

## Điểm tốt (2–3)

1. **Trung thực demo:** strip «Dữ liệu mô phỏng», badge «Demo», disclaimer marketing/QR, FAQ «Demo có phải khách hàng thật?» — proposition B2B rõ, không giả case study.
2. **Phân tách nghiệp vụ:** «Đổi mã» vs «Nhận lời mời» (copy + callout); lỗi redeem có bước tiếp (email/organizer + ví).
3. **Persona khớp bảng `screens`:** guest thiếu «Vé của tôi» và redeem gate yêu cầu đăng nhập; user có nav đầy đủ — không phát hiện lệch quyền so với prototype.

## Findings

| ID | Vấn đề | Tác động | Evidence | Mức độ | Điều kiện đóng |
| --- | --- | --- | --- | --- | --- |
| **UX-MKT-001** | Marketing mobile 390: không thấy lối vào anchor nav (Tính năng / FAQ / …) trong header; chỉ logo, locale, Đăng nhập, Đăng ký quan tâm | Người dùng mobile khó điều hướng nội dung dài; phụ thuộc scroll mù | `marketing-vi-mobile-390-hero.png` | Trung bình (mockup) | Có menu/accordion nav mobile hoặc PD chấp nhận «chỉ CTA» trên mobile |
| **UX-MKT-002** | Locale EN: hero/nav chuyển EN nhưng block form «Đăng ký quan tâm» vẫn nhãn VI («Họ tên», «Gửi đăng ký») khi kiểm spot-check | Khách quốc tế gặp UI lẫn ngôn ngữ; giảm tin cậy | `marketing-en-desktop-1280-hero.png` vs `marketing-en-desktop-1280-interest-form.png` | Trung bình | Form + CTA cùng locale EN (hoặc ghi rõ «VI only» trong handoff) |
| **UX-MKT-003** | Header marketing desktop: mật độ link cao (hai hàng link + CTA) | Dễ lộn xộn thị giác, khó scan trên laptop nhỏ | `marketing-en-desktop-1280-interest-form.png` (header) | Thấp | PD rút gọn nav hoặc gom «Xem demo» |
| **UX-APP-001** | Catalog: «Sắp diễn ra» xuất hiện cả dropdown sort và chip filter cạnh nhau | Trùng ý nghĩa, tốn không gian, dễ hiểu nhầm hai control khác nhau | `app-vi-desktop-1280-user-catalog.png` | Thấp | Gộp một control hoặc đổi nhãn chip (vd. «Lọc») |
| **UX-APP-002** | App mobile 390: điều hướng chính qua «≡ Menu», không thấy bottom tab trong mockup | Khác pattern consumer phổ biến; chưa chứng minh IA mobile đã chốt | `app-vi-mobile-390-wallet-nav.png`, `app-vi-mobile-390-guest-catalog.png` | Thấp / gap mockup | PD xác nhận bottom nav hoặc bổ sung state mobile trong prototype |
| **UX-APP-003** | Toast check-in chỉ xem qua tab prototype, không chứng minh vị trí overlay trên journey thật | Rủi ro che CTA khi implement | `app-vi-desktop-1280-wallet-toast.png` | Thấp | Ghi spec vị trí toast trong handoff implement |

## Ưu tiên xử lý

1. UX-MKT-001 + UX-MKT-002 (marketing mobile + i18n form)  
2. UX-APP-001  
3. UX-MKT-003, UX-APP-002, UX-APP-003  

## Limitations

- Không kiểm keyboard/focus, reduced motion, contrast đo tự động; không chạy checklist `web-interface-guidelines` trên file nguồn (review render-only).
- Không mở menu mobile («≡ Menu») — chưa xác minh danh sách link trong drawer.
- Scroll tới form marketing trong khung mockup: `scrollintoview` / `#interest` trên URL ngoài **không** đổi viewport nội bộ; evidence form dùng ảnh EN sau điều hướng thủ công (một lần thành công).
- `orca exec` ref (`@eN`) stale sau `goto` — phải `snapshot` lại (đã xử lý khi chụp EN).

## Kết luận (scope mockup)

**PASS with known gap** — hierarchy proposition marketing và hành trình app attendee (catalog → redeem → wallet/QR, empty/loading/error) đạt mục tiêu prototype; gap chủ yếu mobile marketing nav, i18n form EN, và chi tiết mobile IA. Không chặn tiếp tục uplift sang implement; không thay DoD runtime.

---

## Phản hồi về role/workflow

| Vấn đề | Đề xuất |
| --- | --- |
| Bước 7 yêu cầu «mở lại ảnh» + hash nhưng không nói rõ **mockup nhúng trong khung** — scroll/hash trang wrapper ≠ state trong `#site` | Thêm câu: «Với prototype có khung `.browser`, cuộn/chụp phải tác động nội dung trong khung (click anchor trong mockup hoặc tab state), không chỉ URL trang review.» |
| `ui-workflow.md` gợi ý fetch checklist `web-design-guidelines` theo file; task mockup **cấm** đọc CSS rộng | Ghi rõ nhánh: «Review prototype render-only: heuristic critique, không bắt buộc fetch command.md trừ khi Task đọc code.» |
| Artifact bảng ảnh dài; task ~15 phút dễ trùng hash nếu chụp lại state | Cho phép «ảnh đại diện» tối thiểu theo checklist Task + 1 ảnh/form nếu scroll khó, tránh bắt buộc chụp lại toàn bộ khi hash manifest đã khớp coordinator. |
| Độc lập «không đọc review lần 1» tốt nhưng không nhắc **không đọc** `capture-screenshots.mjs` | Thêm vào Task template: «Không dùng script chụp tự động; chỉ Orca browser.» (đã có trong task này — nên đưa vào `ui-workflow.md` mục Evidence UI). |
