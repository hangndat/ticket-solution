#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const plan = readFileSync(new URL('PLAN.md', root), 'utf8');
const planned = [
  ...plan.matchAll(
    /^\|\s*((?:AUTH|WEB|PORT|PLAT|DB|GATE|JOB|SEC|POL)-\d{2})\s*\|\s*(P[01])\s*\|/gm,
  ),
].map((m) => ({ caseId: m[1], priority: m[2] }));
const slices = ['web', 'portal', 'backend', 'http', 'harness'];
const reports = slices.flatMap((slice) =>
  JSON.parse(readFileSync(new URL(`${slice}/coverage.json`, root), 'utf8')).map(
    (entry) => ({ slice, ...entry }),
  ),
);
const cases = planned.map((entry) => ({
  ...entry,
  evidence: reports.filter((report) => report.caseId === entry.caseId),
}));
const unknown = reports.filter(
  (entry) => !planned.some((item) => item.caseId === entry.caseId),
);
const invalidStatus = reports.filter(
  (entry) =>
    !['implemented', 'covered', 'blocked', 'out'].includes(entry.status),
);
if (
  planned.length !== 86 ||
  new Set(planned.map((x) => x.caseId)).size !== 86 ||
  unknown.length ||
  invalidStatus.length
) {
  console.error(
    'Coverage inventory/status does not match the reviewed 86-case plan',
  );
  process.exit(2);
}
// Source coverage is deliberately separate from execution PASS/FAIL. A mapped
// selector or one implemented slice cannot prove all acceptance criteria.
console.log(
  JSON.stringify(
    {
      groups: planned.length,
      p0: planned.filter((x) => x.priority === 'P0').length,
      p1: planned.filter((x) => x.priority === 'P1').length,
      unmapped: cases.filter((x) => !x.evidence.length).map((x) => x.caseId),
      cases,
    },
    null,
    2,
  ),
);
