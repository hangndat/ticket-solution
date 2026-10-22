#!/usr/bin/env node
/**
 * PR #824 F06 — Lighthouse mobile (390×844) median of ≥3 runs per route.
 * Usage:
 *   node apps/web/scripts/pr824-lighthouse-benchmark.mjs <baseUrl> <label> <outDir> [runs=3]
 * Requires prod server (next start). Marketing apex `/` uses x-forwarded-host: vemoki.com.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = (process.argv[2] ?? 'http://127.0.0.1:3456').replace(/\/$/, '');
const LABEL = process.argv[3] ?? 'unknown';
const OUT = resolve(process.argv[4] ?? join(ROOT, 'docs/reviews/assets/PR824/lighthouse'));
const RUNS = Math.max(3, Number(process.argv[5] ?? 3));

const ROUTES = [
  { id: 'root-vi', path: '/', host: 'vemoki.com' },
  { id: 'marketing-vi', path: '/marketing', host: null },
  { id: 'marketing-en', path: '/marketing/en', host: null },
];

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function lighthouseVersion() {
  return execFileSync('npx', ['lighthouse', '--version'], { encoding: 'utf8' }).trim();
}

function runOnce(url, extraHeaders) {
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
  if (extraHeaders) {
    args.push(`--extra-headers=${JSON.stringify(extraHeaders)}`);
  }
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
const allRuns = [];

for (const route of ROUTES) {
  const url = `${BASE}${route.path}`;
  const headers = route.host ? { 'x-forwarded-host': route.host } : undefined;
  const scores = [];
  for (let i = 0; i < RUNS; i += 1) {
    const runId = `${LABEL}-${route.id}-run${i + 1}`;
    process.stderr.write(`${runId} …\n`);
    const s = runOnce(url, headers);
    scores.push(s);
    writeFileSync(join(OUT, `${runId}.json`), JSON.stringify({ label: LABEL, route, run: i + 1, lighthouse: lhVersion, scores: s }, null, 2));
    allRuns.push({ route: route.id, run: i + 1, ...s });
  }
  const med = {
    performance: median(scores.map((s) => s.performance)),
    accessibility: median(scores.map((s) => s.accessibility)),
    bestPractices: median(scores.map((s) => s.bestPractices)),
    seo: median(scores.map((s) => s.seo)),
  };
  writeFileSync(
    join(OUT, `${LABEL}-${route.id}-median.json`),
    JSON.stringify({ label: LABEL, route, runs: RUNS, lighthouse: lhVersion, median: med, scores }, null, 2),
  );
  console.log(
    `${LABEL} ${route.id} median: perf=${med.performance} a11y=${med.accessibility} bp=${med.bestPractices} seo=${med.seo}`,
  );
}

const summary = {
  label: LABEL,
  base: BASE,
  lighthouse: lhVersion,
  runs: RUNS,
  generatedAt: new Date().toISOString(),
  rows: ROUTES.map((route) => {
    const med = JSON.parse(readFileSync(join(OUT, `${LABEL}-${route.id}-median.json`), 'utf8')).median;
    return { route: route.id, path: route.path, ...med };
  }),
  allRuns,
};

writeFileSync(join(OUT, `${LABEL}-summary.json`), JSON.stringify(summary, null, 2));
console.log(`wrote ${OUT}/${LABEL}-summary.json`);
