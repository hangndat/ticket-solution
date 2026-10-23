#!/usr/bin/env node
/**
 * PR #833 — visual evidence: claim / invite / error / not-found / redeem spot-check.
 * Usage:
 *   WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
 *     node apps/web/scripts/pr833-claim-invite-evidence.mjs http://127.0.0.1:3456 before|after <sha>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

function die(msg, code = 1) {
  console.error(`pr833-claim-invite-evidence: ${msg}`);
  process.exit(code);
}

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const arch of [
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell-mac-x64',
    ]) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  return chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
}

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function shot(page, file, locator) {
  if (locator) {
    await locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: false });
  }
  const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function captureRoute(
  page,
  base,
  route,
  stateId,
  readySelector,
  outDir,
  phase,
  setup,
  shotLocator,
) {
  await page.goto(`${base}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (setup) await setup(page, base);
  if (readySelector) {
    await page.waitForSelector(readySelector, { timeout: 60_000 });
  }
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
  const md5s = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settleAnimations(page);
    md5s.push(
      await shot(
        page,
        join(outDir, `${stateId}-${vp.id}-${phase}.png`),
        shotLocator ? shotLocator(page) : null,
      ),
    );
  }
  return md5s;
}

async function loginAttendee(page, base, returnPath) {
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  await page.goto(`${base}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, {
    timeout: 45_000,
  });
  let prefer = process.env.KEYCLOAK_PUBLIC_HOST || '';
  if (!prefer) {
    try {
      const disc = await page.request.get(
        'http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration',
      );
      if (disc.ok()) {
        const body = await disc.json();
        prefer = new URL(body.issuer).hostname;
      }
    } catch {
      prefer = '';
    }
  }
  if (!prefer) prefer = '127.0.0.1';
  const kcUrl = new URL(page.url());
  if (kcUrl.port === '8080' && kcUrl.hostname !== prefer) {
    kcUrl.hostname = prefer;
    await page.goto(kcUrl.toString(), { waitUntil: 'domcontentloaded' });
  }
  const userField = page
    .locator('#username')
    .or(page.getByLabel(/username|email/i))
    .first();
  const passField = page.locator('#password').or(page.getByLabel(/password/i)).first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(user);
  await passField.fill(pass);
  await page
    .locator('#kc-login')
    .or(page.getByRole('button', { name: /sign in|log in/i }))
    .first()
    .click();
  const baseUrl = new URL(base);
  const appHosts = new Set(['127.0.0.1', 'localhost', baseUrl.hostname]);
  await page.waitForURL(
    (url) => appHosts.has(url.hostname) && url.pathname.startsWith(returnPath),
    { timeout: 60_000 },
  );
}

const ROUTES = [
  {
    route: '/claim',
    id: 'claim-empty',
    ready: '[data-testid="claim-token-empty"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/invite',
    id: 'invite-empty',
    ready: '[data-testid="invite-token-empty"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/invite',
    id: 'invite-token-invalid',
    ready: '[data-testid="invite-accept-result"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/invite');
      await page.getByLabel('Mã lời mời').fill('not-a-real-invite-token');
      await page.getByTestId('invite-accept-submit').click();
      await page.waitForSelector('[data-testid="invite-accept-result"]', {
        timeout: 30_000,
      });
    },
  },
  {
    route: '/invite',
    id: 'invite-already-used',
    ready: '[data-testid="invite-accept-result"]',
    shotLocator: (page) => page.getByTestId('invite-accept-result'),
    setup: async (page, base) => {
      const tokenFile =
        process.env.WEB_UAT_INVITE_USED_TOKEN_FILE ??
        resolve(join(ROOT, '.fe-uat-stack/pr833-invite-used.token'));
      const token = readFileSync(tokenFile, 'utf8').trim();
      await loginAttendee(page, base, '/invite');
      await page.getByLabel('Mã lời mời').fill(token);
      await page.getByTestId('invite-accept-submit').click();
      await page.waitForSelector('[data-testid="invite-accept-result"]', {
        timeout: 60_000,
      });
    },
  },
  {
    route: '/claim',
    id: 'claim-token-invalid',
    ready: '[data-testid="guest-claim-result"]',
    shotLocator: (page) => page.getByTestId('guest-claim-result'),
    setup: async (page, base) => {
      await loginAttendee(page, base, '/claim');
      await page.getByLabel('Mã lời mời').fill('not-a-valid-claim-token-833');
      const submit = page.locator('button:has-text("Nhận vé mời"):not([disabled])');
      await submit.waitFor({ state: 'visible', timeout: 30_000 });
      await submit.click();
      await page.waitForSelector('[data-testid="guest-claim-result"]', {
        timeout: 60_000,
      });
    },
  },
  {
    route: '/redeem',
    id: 'redeem-guest',
    ready: '[data-testid="redeem-auth-gate"], [data-testid="site-footer"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/redeem',
    id: 'redeem-form-empty',
    ready: '[data-testid="redeem-global-code"], input[name="code"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/redeem');
    },
  },
  {
    route: '/__not_real__',
    id: 'not-found',
    ready: '[data-testid="route-not-found"]',
    setup: async (page, base) => {
      await page.goto(`${base}/this-route-does-not-exist-833`, {
        waitUntil: 'domcontentloaded',
      });
    },
  },
];

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr833-claim-invite-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR833'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const md5s = [];

  try {
    for (const item of ROUTES) {
      const context = await browser.newContext();
      const statePage = await context.newPage();
      try {
        md5s.push(
          ...(await captureRoute(
            statePage,
            base,
            item.route,
            item.id,
            item.ready,
            outDir,
            phase,
            item.setup,
            item.shotLocator,
          )),
        );
      } catch (err) {
        die(`state ${item.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await context.close();
      }
    }
    writeFileSync(
      join(outDir, `manifest-${phase}.json`),
      JSON.stringify(
        {
          sha,
          phase,
          md5Count: md5s.length,
          skipped: [
            {
              id: 'error-boundary',
              reason:
                'Next.js app/error.tsx requires a runtime render throw; no stable public route in fixture stack (documented per DoD).',
            },
            {
              id: 'invite-accept-success',
              reason:
                'Pending invite accept UI matches invite-already-used outcome chrome in headless capture; live accept verified via createMembershipInvite seed + fe-uat-stack check-ui.',
            },
          ],
        },
        null,
        2,
      ),
    );
    const unique = new Set(md5s);
    if (unique.size < md5s.length) {
      die('duplicate md5 among captures — states must differ');
    }
    console.log(`done ${outDir} (${md5s.length} images)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => die(err?.message ?? String(err)));
