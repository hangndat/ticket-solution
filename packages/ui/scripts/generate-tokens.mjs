import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgRoot, '../..');
const tokensPath = path.join(repoRoot, 'brand/vemoki/tokens.json');
const outDir = path.join(pkgRoot, 'src/generated');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const colors = tokens.colors ?? {};
const { ink, paper, signal, focus, line, muted, destructive, admit, unknown } = colors;

const requiredColors = {
  ink,
  paper,
  signal,
  focus,
  line,
  muted,
  destructive,
  admit,
  unknown,
};
for (const [key, value] of Object.entries(requiredColors)) {
  if (!value) {
    throw new Error(`brand/vemoki/tokens.json missing colors.${key}`);
  }
}

const radius = tokens.radius ?? {};
const shadow = tokens.shadow ?? {};
const space = tokens.space ?? {};
const breakpoints = tokens.breakpoints ?? {};

fs.mkdirSync(outDir, { recursive: true });

const themeLines = [
  `  --color-ink: ${ink};`,
  `  --color-paper: ${paper};`,
  `  --color-signal: ${signal};`,
  `  --color-focus: ${focus};`,
  `  --color-line: ${line};`,
  `  --color-muted: ${muted};`,
  `  --color-destructive: ${destructive};`,
  `  --color-admit: ${admit};`,
  `  --color-unknown: ${unknown};`,
  `  --font-display: Sora, ui-sans-serif, system-ui, sans-serif;`,
  `  --font-sans: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;`,
  `  --animate-spin: spin 1s linear infinite;`,
];

for (const [key, value] of Object.entries(radius)) {
  themeLines.push(`  --radius-${key}: ${value};`);
}
for (const [key, value] of Object.entries(shadow)) {
  themeLines.push(`  --shadow-${key}: ${value};`);
}
for (const [key, value] of Object.entries(space)) {
  const px = typeof value === 'number' ? `${value}px` : value;
  themeLines.push(`  --spacing-${key}: ${px};`);
}
for (const [key, value] of Object.entries(breakpoints)) {
  const px = typeof value === 'number' ? `${value}px` : value;
  themeLines.push(`  --breakpoint-${key}: ${px};`);
}

const themeCss = `/* Auto-generated from brand/vemoki/tokens.json — do not edit */
@theme {
${themeLines.join('\n')}
}

/*
 * Legacy contract — unprefixed custom properties on :root for live-pulse / marketing CSS.
 * Tailwind v4 prefix(ui) renames @theme vars to --ui-* on :root; legacy uses var(--color-*),
 * var(--spacing-*), etc. This block is independent of prefix and stays valid when D-1 drops prefix.
 */
:root {
${themeLines.join('\n')}
}
`;

const snapshotLines = [
  `  --ink: ${ink};`,
  `  --paper: ${paper};`,
  `  --signal: ${signal};`,
  `  --focus: ${focus};`,
  `  --line: ${line};`,
  `  --muted: ${muted};`,
  `  --destructive: ${destructive};`,
  `  --admit: ${admit};`,
  `  --unknown: ${unknown};`,
];

const rootSnapshot = `/* Snapshot for CI — canonical :root brand colors from tokens.json */
:root {
${snapshotLines.join('\n')}
}
`;

const themePath = path.join(outDir, 'vemoki-theme.css');
const snapshotPath = path.join(outDir, 'vemoki-root.snapshot.css');

for (const [filePath, content] of [
  [themePath, themeCss],
  [snapshotPath, rootSnapshot],
]) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) {
    continue;
  }
  fs.writeFileSync(filePath, content);
}

console.log('Generated Vemoki token CSS from', tokensPath);
