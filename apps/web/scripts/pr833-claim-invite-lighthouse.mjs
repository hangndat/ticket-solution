#!/usr/bin/env node
/**
 * PR #833 — Lighthouse mobile /claim (390×844), median ≥3 runs.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = (process.argv[2] ?? 'http://127.0.0.1:3456').replace(/\/$/, '');
const LABEL = process.argv[3] ?? 'unknown';
const OUT = resolve(
  process.argv[4] ?? join(ROOT, 'docs/reviews/assets/PR833/lighthouse'),
);
const RUNS = Math.max(3, Number(process.argv[5] ?? 3));
const ROUTE_PATH = process.argv[6] ?? '/claim';

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function lighthouseVersion() {
  return execFileSync('npx', ['lighthouse', '--version'], { encoding: 'utf8' }).trim();
}

function runOnce(url) {
  const args = [
    'lighthouse',
    url,
    '--quiet',
    '--chrome-flags=--headless --disable-dev-shm-usage',
    '--form-factor=mobile',
    '--screen-emulation.mobile',
    '--screen-emulation.width=390',
    '--screen-emulation.height=844',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    '--output-path=stdout',
  ];
  const json = execFileSync('npx', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const report = JSON.parse(json);
  const c = report.categories;
  return {
    performance: Math.round((c.performance?.score ?? 0) * 100),
    accessibility: Math.round((c.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((c['best-practices']?.score ?? 0) * 100),
    seo: Math.round((c.seo?.score ?? 0) * 100),
  };
}

mkdirSync(OUT, { recursive: true });
const lhVersion = lighthouseVersion();
const route = { id: ROUTE_PATH.replace(/^\//, '') || 'claim', path: ROUTE_PATH };
const url = `${BASE}${route.path}`;
const scores = [];

for (let i = 0; i < RUNS; i += 1) {
  const runId = `${LABEL}-${route.id}-run${i + 1}`;
  process.stderr.write(`${runId} …\n`);
  const s = runOnce(url);
  scores.push(s);
  writeFileSync(
    join(OUT, `${runId}.json`),
    JSON.stringify(
      { label: LABEL, route, run: i + 1, lighthouse: lhVersion, scores: s },
      null,
      2,
    ),
  );
}

const medianScores = {
  performance: median(scores.map((s) => s.performance)),
  accessibility: median(scores.map((s) => s.accessibility)),
  bestPractices: median(scores.map((s) => s.bestPractices)),
  seo: median(scores.map((s) => s.seo)),
};

writeFileSync(
  join(OUT, `${LABEL}-${route.id}-median.json`),
  JSON.stringify(
    { label: LABEL, route, lighthouse: lhVersion, medianScores, runs: RUNS },
    null,
    2,
  ),
);
console.log(JSON.stringify({ label: LABEL, medianScores }, null, 2));
