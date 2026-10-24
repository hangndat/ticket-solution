#!/usr/bin/env node
/**
 * PA-01 / PORTAL-CHROME-390 evidence: locale must match filename; chrome probes on title/tabs/form.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVID = __dirname;
const WT = path.resolve(__dirname, '../../../..');
const TEN = 'd9d9f001-0001-4000-8000-000000000001';
const EVT = 'd9d9f001-0002-4000-8000-000000000001';
const BASE = 'http://127.0.0.1:3013';
const PAGE = process.argv[2] || '9e9be2a1-9e1d-485b-bb30-dc32a5ea4b59';
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WT, encoding: 'utf8' }).trim();

function orcaRaw(cmd) {
  const j = JSON.parse(
    execFileSync('orca', ['exec', '--page', PAGE, '--command', cmd, '--json'], {
      encoding: 'utf8',
    }),
  );
  if (!j.ok) throw new Error(j.error?.message || 'orca failed');
  return j.result;
}
function orca(cmd) {
  const r = orcaRaw(cmd);
  return r.result !== undefined ? r.result : r;
}

const CHROME_PROBE =
  'eval (() => { const measure = (el) => { if (!el) return null; const cs = getComputedStyle(el); const ellipsed = cs.textOverflow === `ellipsis` || (cs.overflow === `hidden` && cs.whiteSpace === `nowrap`); const clipped = ellipsed && el.scrollWidth > el.clientWidth + 1; return { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clipped, text: (el.textContent || ``).trim().slice(0, 120) }; }; const titleEl = document.querySelector(`.portal-page-container .ant-page-header-heading-title`); const subEl = document.querySelector(`.portal-page-container .ant-page-header-heading-sub-title`); const activeTab = document.querySelector(`.portal-guests-tabs .ant-tabs-tab-active .ant-tabs-tab-btn`); const notifyTab = document.querySelector(`.portal-guests-tabs [data-node-key=notifications] .ant-tabs-tab-btn`); const filters = document.querySelector(`[data-testid=import-catalog-filters]`); const tenant = document.querySelector(`[data-testid=tenant-switcher]`); const event = document.querySelector(`[data-testid=event-switcher]`); const tBox = tenant ? tenant.getBoundingClientRect() : null; const eBox = event ? event.getBoundingClientRect() : null; const notifyAria = notifyTab ? (notifyTab.querySelector(`[aria-label]`)?.getAttribute(`aria-label`) || notifyTab.getAttribute(`aria-label`)) : null; return { lang: document.documentElement.lang, measured: { innerWidth, innerHeight, dpr: devicePixelRatio }, chrome: { pageTitle: measure(titleEl), pageSubTitle: subEl ? measure(subEl) : null, activeTab: measure(activeTab), notifyTabAria: notifyAria, filtersVisible: !!filters, contextStrip: { stacked: tBox && eBox ? Math.round(eBox.top) >= Math.round(tBox.bottom) - 2 : null, overflowX: document.documentElement.scrollWidth > innerWidth + 2 } } }; })()';

function setLocale(locale) {
  orca(
    `eval (() => { localStorage.setItem(\`vemoki_portal_locale\`, \`${locale}\`); document.cookie = \`vemoki_portal_locale=${locale}; path=/; max-age=31536000\`; document.documentElement.lang = \`${locale}\`; location.reload(); return true; })()`,
  );
  orca('wait 7000');
}

function setViewport(w, h) {
  orca(`set viewport ${w} ${h}`);
  orca('eval (() => { window.dispatchEvent(new Event(`resize`)); return true; })()');
  orca('wait 800');
  return orca('eval (() => ({ innerWidth, innerHeight, dpr: devicePixelRatio }))()');
}

function capture(outBase, locale, vp) {
  setViewport(vp.w, vp.h);
  setLocale(locale);
  setViewport(vp.w, vp.h);
  orca('wait 2500');
  const probe = orca(CHROME_PROBE);
  if (probe.lang !== locale) {
    throw new Error(`locale mismatch for ${outBase}: expected ${locale}, got ${probe.lang}`);
  }
  if (vp.w < 576) {
    const tabText = probe.chrome?.activeTab?.text || '';
    if (tabText.length > 12) {
      throw new Error(`import tab label too long at ${vp.w}px for ${outBase}: ${tabText}`);
    }
    const titleText = probe.chrome?.pageTitle?.text || '';
    if (titleText.includes('…') || titleText.endsWith('...')) {
      throw new Error(`page title ellipsized for ${outBase}: ${titleText}`);
    }
    const sub = probe.chrome?.pageSubTitle;
    if (sub?.text) {
      throw new Error(`page subtitle must be hidden at ${vp.w}px for ${outBase}: ${sub.text}`);
    }
  } else {
    const sub = probe.chrome?.pageSubTitle;
    if (sub?.clipped && sub?.whiteSpace === 'nowrap') {
      throw new Error(`page subtitle nowrap-clipped for ${outBase}: ${JSON.stringify(sub)}`);
    }
  }
  const notifyAria = probe.chrome?.notifyTabAria;
  if (locale === 'vi' && vp.w < 576 && (!notifyAria || !/Thông báo/i.test(notifyAria))) {
    throw new Error(`notifications tab needs full VI aria for ${outBase}: ${notifyAria}`);
  }
  const shot = orcaRaw('screenshot');
  copyFileSync(shot.path, path.join(EVID, `${outBase}.png`));
  writeFileSync(
    path.join(EVID, `${outBase}.json`),
    `${JSON.stringify(
      {
        sha: SHA,
        png: `${outBase}.png`,
        locale,
        viewportTarget: vp,
        measured: probe.measured,
        viewportMatch:
          probe.measured.innerWidth === vp.w && probe.measured.innerHeight === vp.h,
        probe: { pa01: probe },
      },
      null,
      2,
    )}\n`,
  );
  console.log('ok', outBase, probe.lang, probe.chrome?.pageTitle?.text);
}

if (!process.env.SKIP_STAFF_LOGIN) {
  execFileSync('node', [`${EVID}/_orca-staff-login.mjs`, PAGE], { stdio: 'inherit' });
}

orca(`goto ${BASE}/t/${TEN}/e/${EVT}/guests#import`);
orca('wait 3500');

for (const [loc, w] of [
  ['vi', 390],
  ['en', 390],
  ['vi', 360],
  ['en', 360],
  ['vi', 320],
  ['en', 320],
]) {
  capture(`header-pa01-${loc}-${w}x844`, loc, { w, h: 844 });
}
capture('header-pa01-vi-1024x900', 'vi', { w: 1024, h: 900 });
capture('header-pa01-en-1024x900', 'en', { w: 1024, h: 900 });
