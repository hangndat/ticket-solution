#!/usr/bin/env node
/** Renders portal loading spinner chrome for violet-primary evidence. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'loading-spinner-390.png');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
:root {
  --vemoki-primary: #7C4DED;
  --vemoki-ink: #172039;
  --vemoki-paper: #F6F8FC;
}
body { margin: 0; background: var(--vemoki-paper); font-family: system-ui, sans-serif; }
.portal-surface-loading { padding: 48px; text-align: center; }
.portal-surface-loading__spinner {
  width: 40px; height: 40px; margin: 0 auto;
  border: 3px solid color-mix(in srgb, var(--vemoki-primary) 25%, transparent);
  border-top-color: var(--vemoki-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.portal-surface-loading__label {
  margin: 16px 0 0;
  color: color-mix(in srgb, var(--vemoki-ink) 72%, transparent);
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="portal-surface-loading">
  <div class="portal-surface-loading__spinner" aria-hidden></div>
  <p class="portal-surface-loading__label">Đang tải…</p>
</div>
</body>
</html>`;

const tmp = join(HERE, '_loading-spinner-evidence.html');
writeFileSync(tmp, html);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WEB_UAT_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 220 } });
await page.goto(`file://${tmp}`);
await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
await browser.close();
console.log(`Wrote ${OUT}`);
