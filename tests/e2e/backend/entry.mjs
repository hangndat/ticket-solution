#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.mjs';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const caseId = option('--case');
const suite = option('--suite');
const list = args.includes('--list');
if (
  args.some(
    (x) =>
      !['--case', '--suite', '--list', '--help', '--no-build'].includes(x) &&
      x !== caseId &&
      x !== suite,
  ) ||
  (suite && !['D', 'H', 'R', 'U'].includes(suite)) ||
  (caseId && !catalog[caseId])
) {
  console.error(
    'Usage: node tests/e2e/backend/entry.mjs [--list] [--case DB-01] [--suite D|H|R|U] [--no-build]',
  );
  process.exit(2);
}
if (args.includes('--help')) {
  console.log(
    'Usage: node tests/e2e/backend/entry.mjs [--list] [--case DB-01] [--suite D|H|R|U] [--no-build]',
  );
  process.exit(0);
}
const coverage = JSON.parse(
  readFileSync(resolve(root, 'tests/e2e/backend/coverage.json'), 'utf8'),
);
const selected = coverage.filter((x) => !caseId || x.caseId === caseId);
if (list) {
  console.log(
    JSON.stringify(
      selected.map((x) => ({
        ...x,
        selectors: (catalog[x.caseId] ?? []).filter(
          (s) => !suite || s.layer === suite,
        ),
      })),
      null,
      2,
    ),
  );
  process.exit(0);
}
const selectors = [
  ...new Map(
    selected
      .flatMap((x) => catalog[x.caseId] ?? [])
      .filter((s) => typeof s === 'object' && s !== null && typeof s.file === 'string')
      .filter((s) => !suite || s.layer === suite)
      .map((s) => [`${s.file}#${s.name}`, s]),
  ).values(),
];
const literalPattern = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (!selectors.length) {
  console.error(
    `No executable selectors for ${caseId ?? 'all'} ${suite ?? ''}. See --list and coverage.json.`,
  );
  process.exit(2);
}
const run = (cmd, argv, cwd = root) => {
  const result = spawnSync(cmd, argv, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (selectors.some((s) => s.layer === 'D')) {
  const docker = spawnSync(
    'docker',
    ['info', '--format', '{{.ServerVersion}}'],
    { stdio: 'ignore' },
  );
  if (docker.status !== 0) {
    console.error(
      'D requires local Docker daemon; tests create and remove isolated PostgreSQL containers.',
    );
    process.exit(2);
  }
}
// Existing suites import dist; --no-build is for a verified current build.
if (!args.includes('--no-build')) {
  run('pnpm', ['--filter', '@ticket/contracts', 'build']);
  run('pnpm', ['--filter', '@ticket/backend', 'build']);
  if (selectors.some((s) => s.file.startsWith('apps/api/')))
    run('pnpm', ['--filter', '@ticket/api', 'build']);
  if (selectors.some((s) => s.file.startsWith('apps/worker/')))
    run('pnpm', ['--filter', '@ticket/worker', 'build']);
  if (selectors.some((s) => s.file === 'tests/e2e/backend/reissue-worker-mailpit.test.cjs'))
    run('pnpm', ['--filter', '@ticket/worker', 'build']);
}
for (const s of selectors) {
  if (!existsSync(resolve(root, s.file)))
    throw new Error(`Missing selected test: ${s.file}`);
  const pkg = s.file.startsWith('packages/backend/')
    ? 'packages/backend'
    : s.file.startsWith('apps/api/')
      ? 'apps/api'
      : s.file.startsWith('apps/worker/')
        ? 'apps/worker'
        : '.';
  const localFile = resolve(root, s.file);
  console.log(`[${s.layer}] ${s.file} :: ${s.name}`);
  run(
    process.execPath,
    ['--test', `--test-name-pattern=${literalPattern(s.name)}`, localFile],
    resolve(root, pkg),
  );
}
