/**
 * Epic #770 — marketing uplift full-page evidence (desktop 1280 + mobile 390).
 * Usage: pnpm --filter @ticket/web start &  node apps/web/tests/marketing-uplift-evidence.mjs http://127.0.0.1:3000
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base =
  process.argv[2]?.replace(/\/$/, '') ?? 'http://127.0.0.1:3000';
const outDir = path.resolve(
  process.cwd(),
  'docs/reviews/assets/ui-uplift-marketing-impl',
);

const shots = [
  { name: 'marketing-desktop-1280-vi', path: '/marketing', width: 1280, height: 800 },
  { name: 'marketing-mobile-390-vi', path: '/marketing', width: 390, height: 844 },
  { name: 'marketing-desktop-1280-en', path: '/marketing/en', width: 1280, height: 800 },
  { name: 'marketing-mobile-390-en', path: '/marketing/en', width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });
  await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector('[data-testid="product-preview-frame"]', {
    timeout: 60_000,
  });
  const file = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('wrote', file);
  await page.close();
}
await browser.close();

await writeFile(
  path.join(outDir, 'README.txt'),
  `Captured from ${base} at ${new Date().toISOString()}\n`,
);
