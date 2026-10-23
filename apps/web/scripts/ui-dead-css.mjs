/**
 * Find CSS classes defined in uplift/legacy sheets that never appear in TS/TSX source.
 * Run from apps/web: node scripts/ui-dead-css.mjs [css files...]
 *
 * Limitations (manual review required):
 * - String match on source; short names (.dot, .seg, .on, .site, .browser) may false-negative.
 * - Template-string prefixes are listed as "dynamic" — verify before deleting.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['node_modules', '.next', 'dist'].includes(e.name) ? [] : walk(p);
    return [p];
  });

const sourceDirs = [
  path.join(webRoot, 'app'),
  path.join(webRoot, 'src'),
  path.resolve(webRoot, '../../packages/ui/src'),
];

const files = sourceDirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : [])).filter(
  (f) => /\.(tsx|ts|mjs)$/.test(f) && !/\.test\./.test(f),
);
const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const dyn = new Set([
  ...[...all.matchAll(/([a-z][\w-]*?(?:--|__|-))\$\{/g)].map((m) => m[1]),
  ...[...all.matchAll(/['"]([a-z][\w-]*(?:--|__|-))['"]\s*\+/g)].map((m) => m[1]),
]);

/** Classes referenced in source (literal className / class strings). */
function classUsedInSource(className) {
  const escaped = className.replace(/-/g, '\\-');
  if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(all)) return true;
  return false;
}

function classifyClasses(classes) {
  const dead = [];
  const dynamic = [];
  const alive = [];
  for (const c of classes) {
    if (classUsedInSource(c)) {
      alive.push(c);
      continue;
    }
    if ([...dyn].some((p) => c.startsWith(p))) {
      dynamic.push(c);
    } else {
      dead.push(c);
    }
  }
  return { dead, dynamic, alive };
}

/** Rough rule count: blocks ending at closing brace at line start indent. */
function countRulesInText(text) {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let rules = 0;
  let depth = 0;
  for (let i = 0; i < noComments.length; i++) {
    if (noComments[i] === '{') depth++;
    if (noComments[i] === '}') {
      depth--;
      if (depth === 0) rules++;
    }
  }
  return rules;
}

function linesForDeadRules(cssPath, deadSet) {
  const raw = fs.readFileSync(cssPath, 'utf8');
  const lines = raw.split('\n');
  let removedLines = 0;
  let deadRuleCount = 0;
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const start = i;
    let brace = 0;
    let started = false;
    const chunk = [];
    while (i < lines.length) {
      const line = lines[i];
      chunk.push(line);
      for (const ch of line) {
        if (ch === '{') {
          brace++;
          started = true;
        }
        if (ch === '}') brace--;
      }
      i++;
      if (started && brace === 0) break;
    }
    const selectorPart = chunk
      .join('\n')
      .split('{')[0]
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const classNames = [...selectorPart.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
    if (classNames.length === 0) {
      blocks.push({ start, end: i, remove: false, chunk });
      continue;
    }
    const allDead = classNames.every((c) => deadSet.has(c));
    blocks.push({ start, end: i, remove: allDead, chunk, classNames });
    if (allDead) {
      deadRuleCount++;
      removedLines += chunk.length;
    }
  }
  return { deadRuleCount, removedLinesEstimate: removedLines };
}

const defaultCss = [
  'app/live-pulse-legacy.css',
];

const cssList = process.argv.slice(2).length
  ? process.argv.slice(2)
  : defaultCss;

let exitCode = 0;

for (const cssRel of cssList) {
  const css = path.isAbsolute(cssRel) ? cssRel : path.join(webRoot, cssRel);
  if (!fs.existsSync(css)) {
    console.warn(`skip (missing): ${cssRel}`);
    continue;
  }
  const text = fs.readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = [...new Set([...text.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];
  const { dead, dynamic, alive } = classifyClasses(classes);
  const deadSet = new Set(dead);
  const { deadRuleCount, removedLinesEstimate } = linesForDeadRules(css, deadSet);
  const totalRules = countRulesInText(fs.readFileSync(css, 'utf8'));

  console.log(`${cssRel}: ${classes.length} classes | alive ${alive.length} | dead ${dead.length} | dynamic ${dynamic.length}`);
  console.log(`  rules (approx): ${totalRules} total, ~${deadRuleCount} fully-dead rules (~${removedLinesEstimate} lines if removed)`);
  if (dead.length) console.log(`  dead: ${dead.join(' ')}`);
  if (dynamic.length) console.log(`  dynamic (kiểm tay): ${dynamic.join(' ')}`);
  console.log('');
}

if (process.env.UI_DEAD_CSS_STRICT === '1') {
  for (const cssRel of cssList) {
    const css = path.isAbsolute(cssRel) ? cssRel : path.join(webRoot, cssRel);
    if (!fs.existsSync(css)) continue;
    const text = fs.readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const classes = [...new Set([...text.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];
    const { dead } = classifyClasses(classes);
    if (dead.length) exitCode = 1;
  }
}

process.exit(exitCode);
