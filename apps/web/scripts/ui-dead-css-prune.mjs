/**
 * Remove CSS rule blocks whose selectors only reference dead classes.
 * Mixed comma-separated selectors keep living parts only.
 *
 * Usage (from apps/web): node scripts/ui-dead-css-prune.mjs [--write] [css files...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const write = process.argv.includes('--write');
const cssArgs = process.argv.slice(2).filter((a) => a !== '--write');

function loadDeadSets() {
  const r = spawnSync('node', ['scripts/ui-dead-css.mjs', ...cssArgs], {
    cwd: webRoot,
    encoding: 'utf8',
  });
  const deadByFile = new Map();
  let current = null;
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^(app\/[\w.-]+\.css):/);
    if (m) {
      current = m[1];
      deadByFile.set(current, new Set());
      continue;
    }
    if (current && line.startsWith('  dead: ')) {
      const names = line.slice(8).trim().split(/\s+/).filter(Boolean);
      for (const n of names) deadByFile.get(current).add(n);
    }
  }
  return deadByFile;
}

/** False negatives from review shell (removed separately) or short-name collisions. */
const FORCE_DEAD = new Set(['mkt--mobile']);

function isDead(className, deadSet) {
  return deadSet.has(className) || FORCE_DEAD.has(className);
}

function classesInSelector(selector) {
  return [...selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
}

/** Drop selector if it references any dead class (scoped chains included). */
function selectorReferencesDead(selector, deadSet) {
  const classes = classesInSelector(selector);
  if (classes.length === 0) return false;
  return classes.some((c) => isDead(c, deadSet));
}

/** Split file into rule chunks (selector + `{` … `}` at brace depth 0). */
function splitRuleChunks(lines) {
  const chunks = [];
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
    chunks.push({ start, lines: chunk });
  }
  return chunks;
}

function pruneChunkLines(chunkLines, deadSet) {
  const text = chunkLines.join('\n');
  const openIdx = text.indexOf('{');
  if (openIdx === -1) return chunkLines;

  const selectorPart = text.slice(0, openIdx);
  const body = text.slice(openIdx);
  const trimmedSel = selectorPart.trim();

  if (trimmedSel.startsWith('@')) {
    if (!trimmedSel.startsWith('@media') && !trimmedSel.startsWith('@supports') && !trimmedSel.startsWith('@container')) {
      return chunkLines;
    }
    const innerOpen = body.indexOf('{');
    const innerClose = body.lastIndexOf('}');
    const innerText = body.slice(innerOpen + 1, innerClose);
    const innerLines = innerText.split('\n');
    const innerChunks = splitRuleChunks(innerLines);
    const prunedInner = [];
    for (const ic of innerChunks) {
      const kept = pruneChunkLines(ic.lines, deadSet);
      if (kept.length) prunedInner.push(...kept);
    }
    if (!prunedInner.length) return [];
    return [`${trimmedSel} {`, ...prunedInner, '}'];
  }

  const selectors = selectorPart
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const living = selectors.filter((s) => !selectorReferencesDead(s, deadSet));
  if (!living.length) return [];
  if (living.length === selectors.length) return chunkLines;
  const newSel = living.join(',\n');
  const bodyLines = body.split('\n');
  return [`${newSel}${bodyLines[0]}`, ...bodyLines.slice(1)];
}

function pruneFile(relPath, deadSet) {
  const abs = path.join(webRoot, relPath);
  const before = fs.readFileSync(abs, 'utf8');
  const lines = before.split('\n');
  const chunks = splitRuleChunks(lines);
  const out = [];
  for (const ch of chunks) {
    const kept = pruneChunkLines(ch.lines, deadSet);
    if (kept.length) {
      if (out.length) out.push('');
      out.push(...kept);
    }
  }
  const after = `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
  const removedLines = before.split('\n').length - after.split('\n').length;
  if (write) fs.writeFileSync(abs, after);
  console.log(`${relPath}: ${removedLines > 0 ? `-${removedLines} lines` : 'no change'}${write ? ' (written)' : ''}`);
  return removedLines;
}

const defaultCss = [
  'app/live-pulse-legacy.css',
  'app/attendee-uplift.css',
];
const cssList = cssArgs.length ? cssArgs : defaultCss;
const deadByFile = loadDeadSets();

let total = 0;
for (const rel of cssList) {
  const deadSet = deadByFile.get(rel) ?? new Set();
  total += pruneFile(rel, deadSet);
}
console.log(`total lines removed: ${total}`);
if (!write) console.log('(dry run — pass --write to apply)');
