# M-01 — Map giá trị spacing/radius lẻ (mobile)

**Input codemod:** #797. **Nguồn số liệu:** audit M-01 (`358` chỗ số cứng; giá trị lẻ in đậm).

Quy tc: map về token [TOKENS.md](./TOKENS.md); ghi comment `// was 10` trong PR codemod nếu reviewer cần diff visual.

| Giá trị lẻ | Số lần (audit) | Token chốt | Ngữ cảnh / lý do |
| --- | --- | --- | --- |
| **10** | 27 | `space.sm` (8) **hoặc** `space.md` (12) | **Padding nút / chip / ô nhỏ:** `space.sm`. **Gap list item / khoảng icon–label:** `space.md` nếu cần thoáng hơn 8. Mặc định codemod: **→ 12** (`space.md`) trừ file gate sticky dùng 8. |
| **14** | 16 | `space.md` (12) | Padding card nội bộ, `borderRadius` không áp dụng — **12** khớp lưới; nếu cặp với `fontSize: 14` giữ typography role, không map 14→space. |
| **18** | 4 | `radius.lg` (18) nếu `borderRadius`; nếu padding/margin → `space.lg` (16) | Phân loại theo property trong codemod. |
| **22** | 2 | `space.xl` (20) hoặc `space.2xl` (24) | **Margin section nhỏ:** 20. **Gap block:** 24. Mặc định **→ 20**. |
| **5** | 2 | `space.xs` (4) | Micro gap — không thêm token 5px. |
| **6** | 9 | `space.sm` (8) | Hit area phụ / gap icon — 8 đủ; không 6px token. |

## Giá trị đã trên lưới (tham chiếu nhanh)

| px | Token |
| --- | --- |
| 2 | `space.xxs` |
| 4 | `space.xs` |
| 8 | `space.sm` |
| 12 | `space.md` |
| 16 | `space.lg` |
| 20 | `space.xl` |
| 24 | `space.2xl` |
| 32 | `space.3xl` |
| 48 | `space.4xl` |
| 72 | `space.5xl` |

## Ví dụ theo component (gợi ý codemod rule)

| Pattern trong codebase | Map |
| --- | --- |
| `padding: 10` trên `Pressable` CTA | `theme.space.md` (12) |
| `gap: 10` trong `FlatList` contentContainerStyle | `theme.space.md` (12) |
| `borderRadius: 18` card | `theme.radius.lg` |
| `paddingHorizontal: 14` input | `theme.space.md` (12) |
| `marginBottom: 22` section title | `theme.space.xl` (20) |
| `padding: 5` badge | `theme.space.xs` (4) |
| `gap: 6` icon row | `theme.space.sm` (8) |

## Không map trong M-01

- `fontSize` / `lineHeight` / `fontWeight` → M-02 (`typography.*`).
- Màu hex → `colors.*` / `brand.*` (M-05).
