// Đếm số dòng chữ của các control chrome trong khung sản phẩm.
// Dùng: orca exec --page <id> --command "eval -b <base64 của file này>"
// Trả về các control có >1 dòng (wrap) hoặc bị cắt ngang (overflow).
(() => {
  const root = document.querySelector('#site, .site, main, body');
  const sel =
    'header a, header button, nav a, nav button, button, .btn, label, [role=tab]';
  const out = [];
  for (const el of root.querySelectorAll(sel)) {
    const text = el.innerText.trim().replace(/\s+/g, ' ');
    const box = el.getBoundingClientRect();
    if (!text || box.width === 0 || box.height === 0) continue;
    // Bỏ control có con dạng block/flex (card, nhiều dòng theo thiết kế).
    if (
      [...el.querySelectorAll('*')].some(
        (c) => !getComputedStyle(c).display.startsWith('inline'),
      )
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set(
      [...range.getClientRects()]
        .filter((r) => r.width > 1)
        .map((r) => Math.round(r.top)),
    );
    const clipped = el.scrollWidth > el.clientWidth + 1;
    if (tops.size > 1 || clipped)
      out.push({ text: text.slice(0, 40), lines: tops.size, clipped });
  }
  const frame = document.querySelector('.browser');
  // frameWidth: bề rộng thật của khung mockup — có thể nhỏ hơn nhãn "Desktop 1280" nếu cửa sổ hẹp.
  return {
    viewport: innerWidth,
    frame: frame?.className ?? null,
    frameWidth: Math.round((frame ?? root).getBoundingClientRect().width),
    issues: out,
  };
})();
