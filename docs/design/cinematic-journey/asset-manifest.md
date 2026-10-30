# Cinematic Journey — Asset manifest (visual spike v2)

> Trạng thái: **asset review spike**, route `noindex`. Runtime manifest: `apps/web/src/marketing/journey/assets.ts`.

## Nguồn & quyền sử dụng

| Mục | Giá trị |
|-----|---------|
| Công cụ | Codex CLI 0.164.0, built-in `image_gen` tool (OpenAI image generation; tool không trả model ID cụ thể). Không dùng fallback CLI/API key. |
| Ngày tạo | 2026-10-30 |
| Prompt | `prompts/*.txt` (nguyên văn) |
| Tham chiếu đầu vào | `gateway-closed` tạo từ text-only. `gateway-open` = **edit** của `gateway-closed`; `stage-main`, `ticket-night` dùng `gateway-closed` làm ảnh tham chiếu style/địa điểm. Không dùng artwork Kage, ảnh stock hay ảnh bên thứ ba. |
| Quyền | Theo điều khoản OpenAI, output thuộc về người dùng tài khoản tạo ảnh, dùng thương mại được (tuân thủ usage policy). Không chứa người thật nhận diện được, logo hay thương hiệu thật. |
| Cần xác nhận trước production | (1) Chủ tài khoản ChatGPT/Codex dùng để tạo = tài khoản có quyền thương mại cho Vemoki. (2) Tên sự kiện hư cấu "LUMEN NIGHT" (chữ trên cổng) — cần tra trùng thương hiệu hoặc thay. (3) Ảnh AI có thể không được bảo hộ bản quyền ở một số quốc gia → không độc quyền. (4) Gắn nhãn "ảnh minh họa AI" nếu chính sách marketing yêu cầu. |

## Master frames (nguồn PNG, không commit — 1536×1024)

| ID | Nội dung | SHA-256 (PNG gốc) |
|----|----------|-------------------|
| `ticket-night` | Bầu trời đêm, festival xa sau rừng thông, khoảng trống trung tâm cho ticket HTML | `06dd5c7f8bab58fc0e65c526e3f984e7a52abfe7239f13c0c38948a9efd6ae95` |
| `gateway-closed` | Lối đi đèn lồng amber → cổng LUMEN NIGHT (LED cyan) cửa đóng, glow sân khấu phía sau | `a583c22cc33a71d0081b207319bdf89e561fa6b6e66f1326af62ed76acc64ab6` |
| `gateway-open` | Cùng khung hình, cửa mở để lộ sân khấu + đám đông, ánh amber tràn ra | `b1f58f7492bee558669b7a2d1a4726abc8cdd2f3e03ba172477763fd9c7bfa92` |
| `stage-main` | Main stage vòm LED cyan/violet, beams, đám đông silhouette giơ tay/điện thoại | `e417e21bc3b9d5fa22c18d515bc3aa03c3a978dec4c3564a45f7891c1ecff323` |

Kiểm tra nhất quán: cùng palette navy/violet/cyan/amber, cùng ống kính/grain; stage vòm tròn trong `stage-main` khớp vòm nhìn thấy qua cổng ở `gateway-*`; `gateway-open` giữ nguyên bố cục pixel ngoài vùng cửa (cho phép wipe từ tâm).

## File runtime (`apps/web/public/marketing/journey/`)

Encode: WebP `cwebp -q 78 -m 6`; AVIF `sips -s format avif -s formatOptions 60` (macOS ImageIO).

| File | Kích thước | Bytes |
|------|-----------|-------|
| `ticket-night-1536.avif` / `.webp` | 1536×1024 | 35 963 / 41 604 |
| `ticket-night-960.avif` / `.webp` | 960×640 | 17 168 / 19 146 |
| `gateway-closed-1536.avif` / `.webp` | 1536×1024 | 111 655 / 128 932 |
| `gateway-closed-960.avif` / `.webp` | 960×640 | 54 313 / 62 906 |
| `gateway-open-1536.avif` / `.webp` | 1536×1024 | 127 559 / 147 560 |
| `gateway-open-960.avif` / `.webp` | 960×640 | 63 414 / 72 940 |
| `stage-main-1536.avif` / `.webp` | 1536×1024 | 110 734 / 119 340 |
| `stage-main-960.avif` / `.webp` | 960×640 | 55 168 / 60 518 |

Tổng một lượt xem (AVIF 1536, 4 plate): **≈ 386 KB**. Ảnh đầu (`ticket-night`) **36 KB**, `fetchPriority="high"`.

## Lớp 2.5D (không phải asset ảnh)

| Lớp | Cách làm |
|-----|----------|
| Ticket | HTML/SVG (QR trang trí, không quét được) — giữ từ Phase 1 |
| Quét / hợp lệ | Glow cyan → amber trên trụ cổng, ghim theo % plate trong cover box 3:2 |
| Cửa mở | `clip-path: inset()` wipe từ tâm giữa `gateway-closed` và `gateway-open` |
| Haze / bokeh đèn lồng | CSS radial gradient, 2 độ sâu parallax |
| Stage "sống dậy" | 2 light sweep + pulse amber (CSS, dừng khi reduced-motion / ngoài viewport) |

## Video loop

**Không thêm.** Lý do: (1) công cụ hiện có chỉ tạo ảnh tĩnh, không tạo video nhất quán với plate; (2) `ffmpeg` trên máy đang lỗi thư viện (`libass.9.dylib`); (3) sweep/pulse CSS đã đủ cho finale ở mức spike. Nếu cần: loop 4–6 s, MP4 H.264 + WebM, ≤ 1.2 MB, chỉ autoplay muted/inline ở chương 4, không seek theo scroll.

## Giới hạn

- Độ phân giải gốc 1536 px: trên màn 2560 px / DPR 2 ảnh bị upscale (mềm). Production nên tạo lại ở độ phân giải cao hơn hoặc upscale có kiểm soát.
- Tay/đầu trong đám đông `stage-main` có thể có artefact AI khi xem 100% — cần designer duyệt.
