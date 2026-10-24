#!/usr/bin/env node
/**
 * FA-PORTAL evidence capture via Orca CLI (stdout: progress only).
 * Requires: portal :3013, API :3001, fixture TOTP files.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(__dirname, '../../../..');
const EVID = __dirname;
const SHA = execSync('git rev-parse HEAD', { cwd: WT, encoding: 'utf8' }).trim();
const TEN = 'd9d9f001-0001-4000-8000-000000000001';
const EVT = 'd9d9f001-0002-4000-8000-000000000001';
const BASE = 'http://127.0.0.1:3013';
const LONG_NAME =
  'Công ty Biểu diễn Nghệ thuật MFest Việt Nam — Tên hiển thị dài cho kiểm tra ellipsis PA-01';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function gotoPage(page, url) {
  sh(
    `orca exec --page ${page} --command "goto ${url}" --json >/dev/null`,
  );
}

function orca(page, command) {
  const escaped = command.replace(/"/g, '\\"');
  const raw = sh(
    `orca exec --page ${page} --command "${escaped}" --json 2>/dev/null`,
  );
  const j = JSON.parse(raw);
  if (!j.ok) throw new Error(j.error?.message || 'orca exec failed');
  return j.result?.result ?? j.result;
}

function refreshTotp() {
  sh(`node ${WT}/.orca-metrics/fix-all/private/totp-current.mjs`);
  return readFileSync(
    `${WT}/.orca-metrics/fix-all/private/totp-code.txt`,
    'utf8',
  ).trim();
}

function loginStaff(page) {
  sh(
    `orca exec --page ${page} --command "goto ${BASE}/api/auth/logout" --json >/dev/null`,
  );
  orca(page, 'wait 2000');
  sh(
    `orca exec --page ${page} --command "goto ${BASE}/api/auth/login?return=/" --json >/dev/null`,
  );
  orca(page, 'wait 3000');
  const snap = JSON.parse(
    sh(`orca exec --page ${page} --command "snapshot" --json 2>/dev/null`),
  );
  if (!String(snap.result?.origin || '').includes('8080')) {
    throw new Error('Expected Keycloak login page after logout');
  }
  orca(page, 'fill @e2 "staff@example.com"');
  orca(page, 'fill @e4 "staff-demo"');
  orca(page, 'click @e3');
  orca(page, 'wait 2500');
  const totp = refreshTotp();
  orca(page, `fill @e4 "${totp}"`);
  orca(page, 'click @e5');
  orca(page, 'wait 5000');
}

function setViewport(page, w, h) {
  orca(page, `set viewport ${w} ${h}`);
  return orca(page, 'eval (() => ({ innerWidth, innerHeight, dpr: devicePixelRatio }))()');
}

function pa01Probe(page) {
  return orca(
    page,
    `eval (() => {
      const tenant = document.querySelector('[data-testid="tenant-switcher"]');
      const event = document.querySelector('[data-testid="event-switcher"]');
      const brand = document.querySelector('[data-testid="portal-brand"]');
      const tBox = tenant?.getBoundingClientRect();
      const eBox = event?.getBoundingClientRect();
      const stacked = tBox && eBox ? Math.round(eBox.top) >= Math.round(tBox.bottom) - 2 : null;
      const overflowX = document.documentElement.scrollWidth > innerWidth + 2;
      const brandStyle = brand ? getComputedStyle(brand) : null;
      return {
        viewport: { w: innerWidth, h: innerHeight },
        locale: document.documentElement.lang,
        layout: { stacked, overflowX },
        brand: {
          whiteSpace: brandStyle?.whiteSpace,
          scrollWidth: brand?.scrollWidth,
          clientWidth: brand?.clientWidth,
        },
      };
    })()`,
  );
}

function shot(page, outBase, vp, extra = {}) {
  const pngPath = orca(page, 'screenshot').path;
  const pngName = `${outBase}.png`;
  copyFileSync(pngPath, path.join(EVID, pngName));
  const sidecar = {
    sha: SHA,
    png: pngName,
    viewportTarget: vp,
    measured: extra.measured,
    viewportMatch:
      extra.measured?.innerWidth === vp.w &&
      extra.measured?.innerHeight === vp.h,
    probe: extra.probe ?? null,
    ...extra.meta,
  };
  writeFileSync(
    path.join(EVID, `${outBase}.json`),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
  console.log(`wrote ${pngName} match=${sidecar.viewportMatch}`);
}

function main() {
  mkdirSync(EVID, { recursive: true });
  for (const f of [
    'portal-postauth-guests-import-vi-390.png',
    'portal-postauth-audit-vi-390.png',
    'portal-postauth-guests-export-vi-390.png',
    'portal-postauth-event-overview-vi-1024.png',
  ]) {
    try {
      rmSync(path.join(EVID, f));
    } catch {
      /* ignore */
    }
  }

  const page = JSON.parse(
    sh(
      `orca tab create --url about:blank --worktree path:${WT} --json`,
    ),
  ).result.browserPageId;
  console.log('page', page);

  loginStaff(page);

  // Long org display name for PA-01
  sh(
    `orca exec --page ${page} --command "goto ${BASE}/t/${TEN}/settings" --json >/dev/null`,
  );
  orca(page, 'wait 3500');
  orca(
    page,
    `eval (() => { const input = document.querySelector('input[id*="displayName"], input[name="displayName"]') || document.querySelector('[data-testid="portal-brand"]')?.closest('main')?.querySelector('input'); if (input) { input.focus(); input.value = ${JSON.stringify(LONG_NAME)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true; } return false; })()`,
  );
  orca(
    page,
    `eval (() => { const btn = [...document.querySelectorAll('button')].find((b) => /Lưu|Save/.test(b.textContent || '')); btn?.click(); return !!btn; })()`,
  );
  orca(page, 'wait 3000');

  // PA-01 VI @390
  let measured = setViewport(page, 390, 844);
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/guests#import`);
  orca(page, 'wait 3500');
  measured = setViewport(page, 390, 844);
  const pa01vi = pa01Probe(page);
  shot(page, 'header-pa01-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: pa01vi,
  });

  // PA-01 VI @1024
  measured = setViewport(page, 1024, 900);
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}`);
  orca(page, 'wait 3500');
  measured = setViewport(page, 1024, 900);
  shot(page, 'header-pa01-vi-1024x900', { w: 1024, h: 900 }, {
    measured,
    probe: pa01Probe(page),
  });

  // PA-01 EN @1024
  orca(page, 'click @e5');
  orca(page, 'wait 500');
  orca(
    page,
    `eval (() => { document.querySelector('[data-testid=portal-locale-en]')?.click(); return true; })()`,
  );
  orca(page, 'wait 2000');
  measured = setViewport(page, 1024, 900);
  shot(page, 'header-pa01-en-1024x900', { w: 1024, h: 900 }, {
    measured,
    probe: pa01Probe(page),
    meta: { localeSwitch: 'en' },
  });

  // PA-03 import @390
  measured = setViewport(page, 390, 844);
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/guests#import`);
  orca(page, 'wait 3000');
  measured = setViewport(page, 390, 844);
  const pa03import = orca(
    page,
    `eval (() => ({ catalog: !!document.querySelector('[data-testid=import-catalog-filters]'), hash: location.hash }))()`,
  );
  shot(page, 'portal-guests-import-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: { pa03: pa03import },
  });

  // PA-03 pending
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/guests#pending`);
  orca(page, 'wait 3000');
  const pa03pending = orca(
    page,
    `eval (() => ({ catalog: !!document.querySelector('[data-testid=import-catalog-filters]'), hash: location.hash }))()`,
  );
  writeFileSync(
    path.join(EVID, 'probe-guests-pending.json'),
    `${JSON.stringify({ sha: SHA, probe: { pa03: pa03pending } }, null, 2)}\n`,
  );

  // PA-04
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}`);
  orca(page, 'wait 3500');
  const pa04 = orca(
    page,
    `eval (() => ({ formatted: document.querySelector('[data-testid=pa04-formatted-instant]')?.textContent?.trim(), utc: !!document.querySelector('.utc-badge') }))()`,
  );
  measured = setViewport(page, 390, 844);
  shot(page, 'portal-pa04-datetime-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: { pa04 },
  });

  // PA-05 export
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/guests#export`);
  orca(page, 'wait 3000');
  const pa05 = orca(
    page,
    `eval (() => ({ aria: document.querySelector('[data-testid=export-id-input]')?.getAttribute('aria-label') }))()`,
  );
  measured = setViewport(page, 390, 844);
  shot(page, 'portal-guests-export-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: { pa05 },
  });

  // Audit R-06
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/audit#audit`);
  orca(page, 'wait 3500');
  const audit = orca(
    page,
    `eval (() => ({ panel: !!document.querySelector('[data-testid=audit-log-panel]'), table: !!document.querySelector('[data-testid=audit-table]') }))()`,
  );
  measured = setViewport(page, 390, 844);
  shot(page, 'portal-audit-log-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: { mrR08: audit },
  });

  // PA-02 notifications
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}/guests#notifications`);
  orca(page, 'wait 3000');
  const pa02 = orca(
    page,
    `eval (() => ({ accepted: document.body.innerText.includes('ACCEPTED'), notDelivered: document.body.innerText.includes('không đồng nghĩa') || document.body.innerText.includes('does not prove delivery') }))()`,
  );
  writeFileSync(
    path.join(EVID, 'probe-pa02-notifications.json'),
    `${JSON.stringify({ sha: SHA, probe: { pa02 } }, null, 2)}\n`,
  );

  // PA-06 reduced motion
  orca(page, 'set media prefers-reduced-motion reduce');
  gotoPage(page, `${BASE}/t/${TEN}/e/${EVT}`);
  orca(page, 'wait 3500');
  const pa06 = orca(
    page,
    `eval (() => {
      const spin = document.querySelector('.ant-spin-dot, .ant-spin');
      const cs = spin ? getComputedStyle(spin) : null;
      const root = getComputedStyle(document.documentElement);
      return {
        rmMedia: matchMedia('(prefers-reduced-motion: reduce)').matches,
        spinAnimation: cs?.animationName,
        spinDuration: cs?.animationDuration,
      };
    })()`,
  );
  measured = setViewport(page, 390, 844);
  shot(page, 'portal-pa06-rm-vi-390x844', { w: 390, h: 844 }, {
    measured,
    probe: { pa06 },
  });

  // Staff platform deny (no platform OIDC session)
  measured = setViewport(page, 1024, 900);
  gotoPage(page, `${BASE}/platform`);
  orca(page, 'wait 4000');
  const staffPlatform = orca(
    page,
    `eval (() => ({ grants: !!document.querySelector('[data-testid=platform-grants-panel]'), text: document.body.innerText.slice(0, 400) }))()`,
  );
  shot(page, 'portal-platform-staff-deny-vi-1024x900', { w: 1024, h: 900 }, {
    measured,
    probe: { staffPlatform },
    meta: { journey: 'staff-session-no-platform-cookie' },
  });

  // Platform operator OIDC + TOTP
  gotoPage(page, `${BASE}/api/auth/platform/login?return=/platform`);
  orca(page, 'wait 3000');
  try {
    orca(page, 'fill @e2 "staff@example.com"');
    orca(page, 'fill @e4 "staff-demo"');
    orca(page, 'click @e3');
    orca(page, 'wait 2500');
    const totp2 = refreshTotp();
    orca(page, `fill @e4 "${totp2}"`);
    orca(page, 'click @e5');
    orca(page, 'wait 6000');
  } catch (e) {
    console.log('platform login step note', e.message);
  }
  gotoPage(page, `${BASE}/platform`);
  orca(page, 'wait 5000');
  const operator = orca(
    page,
    `eval (() => ({ grants: !!document.querySelector('[data-testid=platform-grants-panel]'), tenants: !!document.querySelector('[data-testid=platform-tenants-table]'), body: document.body.innerText.slice(0, 500) }))()`,
  );
  measured = setViewport(page, 1024, 900);
  // open grant-create tab if tabs exist
  try {
    orca(page, 'click @e26');
    orca(page, 'wait 2000');
  } catch {
    /* tab ref varies */
  }
  shot(page, 'portal-platform-grants-vi-1024x900', { w: 1024, h: 900 }, {
    measured,
    probe: { operator },
    meta: { journey: 'platform-oidc-mfa' },
  });

  writeFileSync('/tmp/fa-portal-page.id', page);
  console.log('done page', page);
}

main();
