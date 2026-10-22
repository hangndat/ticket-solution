const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const webAppCssDir = path.join(repoRoot, 'apps/web/app');
const themeCss = fs.readFileSync(
  path.join(__dirname, '../src/generated/vemoki-theme.css'),
  'utf8',
);
const snapshotCss = fs.readFileSync(
  path.join(__dirname, '../src/generated/vemoki-root.snapshot.css'),
  'utf8',
);

/** Vars set outside generated CSS (next/font, runtime branding). */
const EXTERNAL_DEFINED = new Set([
  '--font-display',
  '--font-body',
  '--font-sans',
  '--shadow-md',
  '--cfg-brand',
]);

const VAR_USE_RE = /var\(\s*(--[a-zA-Z0-9-]+)\s*(,|\))/g;
const VAR_DEF_RE = /--([a-zA-Z0-9-]+)\s*:/g;

function collectDefined(css) {
  const names = new Set();
  for (const match of css.matchAll(VAR_DEF_RE)) {
    names.add(`--${match[1]}`);
  }
  return names;
}

/** var() without a fallback value — must resolve via theme or another definition. */
function collectUsed(css) {
  const names = new Set();
  for (const match of css.matchAll(VAR_USE_RE)) {
    if (match[2] === ',') continue;
    names.add(match[1]);
  }
  return names;
}

const globalDefined = new Set([
  ...collectDefined(themeCss),
  ...collectDefined(snapshotCss),
  ...EXTERNAL_DEFINED,
]);

describe('apps/web/app/*.css var() references', () => {
  it('every var(--*) used in top-level app CSS has a definition', () => {
    const files = fs
      .readdirSync(webAppCssDir)
      .filter((name) => name.endsWith('.css'))
      .map((name) => path.join(webAppCssDir, name));

    const appCssDefined = new Set(globalDefined);
    for (const filePath of files) {
      for (const name of collectDefined(fs.readFileSync(filePath, 'utf8'))) {
        appCssDefined.add(name);
      }
    }

    const missing = [];
    for (const filePath of files) {
      const css = fs.readFileSync(filePath, 'utf8');
      for (const varName of collectUsed(css)) {
        if (appCssDefined.has(varName)) continue;
        missing.push(`${path.basename(filePath)}: ${varName}`);
      }
    }

    assert.deepEqual(
      missing,
      [],
      `Undefined CSS variables (define in vemoki-theme :root contract or locally):\n${missing.join('\n')}`,
    );
  });
});
