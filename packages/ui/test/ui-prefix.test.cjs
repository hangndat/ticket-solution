const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { describe, it } = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const uiSrc = path.join(repoRoot, 'packages/ui/src');
const webApp = path.join(repoRoot, 'apps/web/app');
const webSrc = path.join(repoRoot, 'apps/web/src');

const tailwindPostcssEntry = require.resolve('@tailwindcss/postcss', {
  paths: [path.join(repoRoot, 'apps/web')],
});
const twRequire = createRequire(tailwindPostcssEntry);
const postcss = twRequire('postcss');
const tailwindcss = twRequire('@tailwindcss/postcss');

describe('@ticket/ui withUiPrefix', () => {
  it('prefixes utilities as ui:<variant>:<util> after build', async () => {
    const { withUiPrefix } = await import('../dist/ui-tw.js');
    assert.equal(withUiPrefix('hover:opacity-95'), 'ui:hover:opacity-95');
    assert.equal(
      withUiPrefix('focus-visible:ring-focus'),
      'ui:focus-visible:ring-focus',
    );
    assert.equal(withUiPrefix('min-h-11'), 'ui:min-h-11');
    assert.equal(withUiPrefix('ui:hover:opacity-95'), 'ui:hover:opacity-95');
    assert.equal(
      withUiPrefix('hover:opacity-95 ui:min-h-11'),
      'ui:hover:opacity-95 ui:min-h-11',
    );
  });
});

describe('@ticket/ui Tailwind prefix(ui) compile', () => {
  it('emits variant selectors with ui prefix first', async () => {
    const themeCss = twRequire.resolve('tailwindcss/theme.css');
    const utilitiesCss = twRequire.resolve('tailwindcss/utilities.css');
    const vemokiTheme = path.join(
      repoRoot,
      'packages/ui/src/generated/vemoki-theme.css',
    );
    const uiSourceGlob = path.join(repoRoot, 'packages/ui/src/**/*.{ts,tsx}');
    const input = `@import '${vemokiTheme}';
@layer theme, base, components, utilities;
@import '${themeCss}' layer(theme) prefix(ui);
@import '${utilitiesCss}' layer(utilities) prefix(ui);
@source '${uiSourceGlob}';
`;
    const inputPath = path.join(repoRoot, 'apps/web/app/globals.css');
    const result = await postcss([tailwindcss()]).process(input, {
      from: inputPath,
    });
    const css = result.css;
    for (const needle of [
      '.ui\\:hover\\:',
      '.ui\\:focus-visible\\:',
      '.ui\\:disabled\\:',
      '.ui\\:placeholder\\:',
    ]) {
      assert.ok(
        css.includes(needle),
        `expected compiled CSS to contain ${needle}`,
      );
    }
  });
});

describe('@ticket/ui prefix guard', () => {
  it('rejects variant-before-ui: class strings in ui and web app sources', () => {
    const pattern = '[a-z\\]]:ui:';
    const dirs = [uiSrc, webApp, webSrc].filter((d) => fs.existsSync(d));
    let hits = '';
    for (const dir of dirs) {
      try {
        hits += execSync(`grep -rE "${pattern}" "${dir}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        if (err.status === 1) {
          continue;
        }
        throw err;
      }
    }
    assert.equal(
      hits.trim(),
      '',
      `found variant-before-ui: classes:\n${hits}`,
    );
  });
});
