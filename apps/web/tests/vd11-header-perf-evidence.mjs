/**
 * VD-11 header CLS + nav transition timing (local prod server).
 * Usage:
 *   pnpm --filter @ticket/web build && pnpm --filter @ticket/web start &
 *   node apps/web/tests/vd11-header-perf-evidence.mjs http://127.0.0.1:3000
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd11-perf');
mkdirSync(OUT, { recursive: true });

const NAV_HOPS = [
  { from: '/', to: '/redeem', click: '[data-testid="nav-redeem"]' },
  { from: '/redeem', to: '/', click: '[data-testid="nav-events"]' },
  { from: '/', to: '/redeem', click: '[data-testid="nav-redeem"]' },
];

async function measureHeaderBox(page) {
  const header = page.locator('[data-testid="site-header"]');
  await header.waitFor({ state: 'visible', timeout: 30_000 });
  return header.boundingBox();
}

async function readLayoutShiftSum(page) {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType('layout-shift');
    let cls = 0;
    for (const entry of entries) {
      if (!entry.hadRecentInput) cls += entry.value;
    }
    return cls;
  });
}

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const report = {
  base: BASE,
  capturedAt: new Date().toISOString(),
  headerBoxes: [],
  navigations: [],
  notes: [],
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="site-header"]', { timeout: 45_000 });
await page.waitForTimeout(800);
report.clsBaselineAfterLoad = await readLayoutShiftSum(page);
report.headerBoxes.push({ route: '/', box: await measureHeaderBox(page) });
await page.screenshot({
  path: join(OUT, 'header-home-1440.png'),
  clip: { x: 0, y: 0, width: 1440, height: 120 },
});

for (const hop of NAV_HOPS) {
  const headerBefore = await measureHeaderBox(page);
  const clsBefore = await readLayoutShiftSum(page);
  const t0 = Date.now();
  const navLink = page.locator(hop.click);
  if ((await navLink.count()) === 0) {
    report.notes.push(`skip ${hop.to}: missing ${hop.click} (guest session?)`);
    continue;
  }
  await navLink.click();
  await page.waitForURL(`**${hop.to}`, { timeout: 30_000 });
  const transitionMs = Date.now() - t0;
  if (!page.url().includes(hop.to)) {
    report.notes.push(`skip metrics ${hop.to}: landed on ${page.url()}`);
    continue;
  }
  await page.waitForSelector('[data-testid="site-header"]', {
    state: 'visible',
    timeout: 30_000,
  });
  await page.waitForTimeout(400);
  const headerAfter = await measureHeaderBox(page);
  const clsAfter = await readLayoutShiftSum(page);
  const cls = Math.max(0, clsAfter - clsBefore);
  const deltaY =
    headerBefore && headerAfter
      ? Math.abs(headerAfter.y - headerBefore.y)
      : null;
  const deltaH =
    headerBefore && headerAfter
      ? Math.abs(headerAfter.height - headerBefore.height)
      : null;
  report.navigations.push({
    ...hop,
    transitionMs,
    clsDuringHop: cls,
    headerDeltaY: deltaY,
    headerDeltaHeight: deltaH,
  });
  report.headerBoxes.push({ route: hop.to, box: headerAfter });
  await page.screenshot({
    path: join(OUT, `header-${hop.to.replace(/\//g, '_') || 'root'}-1440.png`),
    clip: { x: 0, y: 0, width: 1440, height: 120 },
  });
}

const inpSample = await page.evaluate(() => {
  const entries = performance.getEntriesByType('event');
  const long = entries.filter(
    (e) => e.duration > 0 && e.name === 'click',
  );
  return long.slice(-5).map((e) => ({
    name: e.name,
    durationMs: e.duration,
  }));
});
report.inpClickSample = inpSample;

writeFileSync(join(OUT, 'metrics.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

await browser.close();
