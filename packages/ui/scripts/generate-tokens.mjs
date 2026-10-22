import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgRoot, '../..');
const tokensPath = path.join(repoRoot, 'brand/vemoki/tokens.json');
const outDir = path.join(pkgRoot, 'src/generated');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const { ink, paper, signal, focus } = tokens.colors;

if (!ink || !paper || !signal || !focus) {
  throw new Error('brand/vemoki/tokens.json missing canonical colors');
}

fs.mkdirSync(outDir, { recursive: true });

const themeCss = `/* Auto-generated from brand/vemoki/tokens.json — do not edit */
@theme {
  --color-ink: ${ink};
  --color-paper: ${paper};
  --color-signal: ${signal};
  --color-focus: ${focus};
}
`;

const rootSnapshot = `/* Snapshot for CI — canonical :root brand colors from tokens.json */
:root {
  --ink: ${ink};
  --paper: ${paper};
  --signal: ${signal};
  --focus: ${focus};
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
