// Same semantics as docs/agents/tools/ui-chrome-wrap-probe.js (embedded for Orca eval -b)
(() => {
  const root = document.querySelector('header') || document.body;
  const sel = 'header a, header button, nav a, nav button';
  const out = [];
  for (const el of root.querySelectorAll(sel)) {
    const text = el.innerText.trim().replace(/\s+/g, ' ');
    const box = el.getBoundingClientRect();
    if (!text || box.width === 0 || box.height === 0) continue;
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
  return {
    viewport: innerWidth,
    pageOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
    issues: out,
  };
})();
