# PA-06 — Loading spinner và `prefers-reduced-motion`

## Quy ước PD (#838)

| Chế độ | Hành vi |
| --- | --- |
| `prefers-reduced-motion: no-preference` | Spinner `.pd-spinner` quay (`animation: pd-spin 0.9s linear infinite`) |
| `prefers-reduced-motion: reduce` | **Không animation**; hiển thị khung tĩnh (arc cố định ~270°) + copy trạng thái «Đang tải…» / «Loading…» |

## CSS (minh họa specimen — implementer map vào `globals.css`)

```css
.pd-spinner {
  animation: pd-spin 0.9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pd-spinner {
    animation: none !important;
  }
  .pd-spinner .pd-spinner-arc {
    /* static frame — no rotation */
    transform: rotate(-90deg);
  }
}
```

## Kiểm tra (AC PA-04)

1. Orca/browser: emulate `prefers-reduced-motion: reduce` (hoặc query `?rm=1` trên specimen để ép class `rm-reduce` song song media).
2. Probe: `getComputedStyle(spinner).animationName === 'none'` (hoặc duration 0s).
3. Ảnh tĩnh: [assets/portal-pa06-rm-vi-390x844.png](./assets/portal-pa06-rm-vi-390x844.png) — nhãn «Reduced motion» trên banner PD.

AntD `Spin` token motion không tự tắt CSS custom — cần override như trên.
