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
const globalsCssPath = path.join(webApp, 'globals.css');
const vemokiThemePath = path.join(
  repoRoot,
  'packages/ui/src/generated/vemoki-theme.css',
);

const tailwindPostcssEntry = require.resolve('@tailwindcss/postcss', {
  paths: [path.join(repoRoot, 'apps/web')],
});
const twRequire = createRequire(tailwindPostcssEntry);
const postcss = twRequire('postcss');
const tailwindcss = twRequire('@tailwindcss/postcss');

/** Variant utilities: `ui:<variant>:<util>` (literal in source for Tailwind @source). */
const UI_VARIANT_CLASS_RE =
  /ui:(?:[a-z]+(?:-\[[^\]]+\])?:)+[a-z][\w./%[\]-]*/gi;

function walkTsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue;
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectUiVariantClassesFromSource() {
  const classes = new Set();
  for (const file of walkTsFiles(uiSrc)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(UI_VARIANT_CLASS_RE)) {
      classes.add(match[0]);
    }
  }
  return [...classes].sort();
}

function tailwindClassToEscapedSelector(className) {
  return (
    '.' +
    className
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/=/g, '\\=')
      .replace(/\//g, '\\/')
      .replace(/%/g, '\\%')
  );
}

async function compileWebGlobalsCss() {
  let input = fs.readFileSync(globalsCssPath, 'utf8');
  input = input.replace(
    "@import '@ticket/ui/vemoki-theme.css';",
    `@import '${vemokiThemePath}';`,
  );
  const result = await postcss([tailwindcss()]).process(input, {
    from: globalsCssPath,
  });
  return result.css;
}

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
  it('emits CSS selectors for every literal ui: variant class in packages/ui/src', async () => {
    const variantClasses = collectUiVariantClassesFromSource();
    assert.ok(
      variantClasses.length >= 10,
      `expected variant classes from primitives source, got ${variantClasses.length}`,
    );

    const css = await compileWebGlobalsCss();

    const missing = [];
    for (const cls of variantClasses) {
      const needle = tailwindClassToEscapedSelector(cls);
      if (!css.includes(needle)) {
        missing.push(`${cls} (expected ${needle})`);
      }
    }
    assert.equal(
      missing.length,
      0,
      `compiled globals.css missing variant rules:\n${missing.join('\n')}`,
    );
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
