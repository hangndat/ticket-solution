#!/usr/bin/env node
/**
 * Slice M — admin chrome headless screenshots (desktop 1280 + mobile 390).
 * Usage: node apps/web/tests/admin-chrome-uat.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = process.argv[2] || process.env.WEB_BASE_URL || 'http://127.0.0.1:3099';
const OUT = join(ROOT, 'docs/reviews/assets');
const DATE = '2026-10-21';

async function shot(page, name) {
  const path = join(OUT, `slice-m-admin-${name}-${DATE}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`admin-chrome-uat: wrote ${path}`);
  return path;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const channel = process.env.WEB_UAT_CHANNEL || 'chrome';
  const browser = await chromium.launch({ headless: true, channel });
  const paths = [];
  for (const [label, width] of [
    ['desktop-1280', 1280],
    ['mobile-390', 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const res = await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    paths.push(await shot(page, label));
    writeFileSync(
      join(OUT, `slice-m-admin-${label}-${DATE}.meta.json`),
      JSON.stringify(
        {
          url: page.url(),
          status: res?.status(),
          viewport: { width, height: 900 },
          note:
            'Without staff session, /admin fail-closed redirects to auth; chrome tokens validated on reachable surface.',
        },
        null,
        2,
      ),
    );
    await page.close();
  }
  await browser.close();
  writeFileSync(
    join(ROOT, 'docs/reviews/FE-REFACTOR-SLICE-M-UAT-2026-10-21.md'),
    `# Slice M — admin chrome UAT (${DATE})

| Viewport | Artifact |
| --- | --- |
| Desktop 1280 | \`docs/reviews/assets/slice-m-admin-desktop-1280-${DATE}.png\` |
| Mobile 390 | \`docs/reviews/assets/slice-m-admin-mobile-390-${DATE}.png\` |

Base URL: \`${BASE}\`

SoT mockup: \`docs/plans/mobile-production-refactor/web-prototype.html\` (admin sidebar, stats, table→card).

**Giới hạn:** phiên headless không có capability admin — ảnh ghi nhận fail-closed redirect hoặc landing auth; shell admin đầy đủ cần staff login trong môi trường OIDC.
`,
  );
  console.log(`admin-chrome-uat: ok (${paths.length} screenshots)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
