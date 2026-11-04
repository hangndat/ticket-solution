#!/usr/bin/env node
// Sinh checklist tiến độ F04 theo từng domain, từ cùng nguồn với coverage.mjs.
// Dùng để dán vào body issue #1029-#1037 và để đo "còn lại bao nhiêu".
//
// Lưu ý quan trọng: coverage là *source coverage*, không phải execution PASS.
// Checkbox chỉ được tick thủ công khi AC đã chạy đủ lớp B/H/D/R mà PLAN yêu cầu
// trên checkout sạch ở đúng SHA. Script này không bao giờ tự tick.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const ledgerPath = join(here, 'f04-ledger.json');

const DOMAINS = [
  { key: 'AUTH', issue: 1029, label: 'OIDC và session' },
  { key: 'WEB', issue: 1037, label: 'attendee Web' },
  { key: 'PORT', issue: 1035, label: 'Portal' },
  { key: 'PLAT', issue: 1033, label: 'Platform MFA và quyền' },
  { key: 'DB', issue: 1030, label: 'transaction, RLS và lifecycle' },
  { key: 'GATE', issue: 1031, label: 'admission, replay và QR' },
  { key: 'JOB', issue: 1032, label: 'worker, outbox và recovery' },
  { key: 'SEC', issue: 1036, label: 'isolation và TLS' },
  { key: 'POL', issue: 1034, label: 'retention và privacy' },
];

function loadCoverage() {
  const raw = execFileSync(process.execPath, [join(here, 'coverage.mjs')], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

// Ledger acceptance: { "DB-01": { "accepted": true, "sha": "...", "run": "..." } }
function loadLedger() {
  if (!existsSync(ledgerPath)) return {};
  return JSON.parse(readFileSync(ledgerPath, 'utf8'));
}

function coverageStatus(entry) {
  const statuses = [...new Set(entry.evidence.map((e) => e.status))].sort();
  return statuses.length ? statuses.join('+') : 'unmapped';
}

function main() {
  const data = loadCoverage();
  const ledger = loadLedger();
  const asMarkdown = process.argv.includes('--markdown');
  const only = process.argv.find((a) => a.startsWith('--domain='));
  const wanted = only ? only.split('=')[1].toUpperCase() : null;

  const byDomain = new Map(DOMAINS.map((d) => [d.key, []]));
  for (const c of data.cases) {
    const key = c.caseId.replace(/-\d+$/, '');
    if (!byDomain.has(key)) {
      console.error(`Domain không khai báo trong f04-status.mjs: ${key}`);
      process.exit(2);
    }
    byDomain.get(key).push(c);
  }

  let acceptedTotal = 0;
  let scopedTotal = 0;
  const lines = [];

  for (const d of DOMAINS) {
    if (wanted && d.key !== wanted) continue;
    const cases = byDomain
      .get(d.key)
      .sort((a, b) => a.caseId.localeCompare(b.caseId));
    const scoped = cases.filter((c) => coverageStatus(c) !== 'out');
    const accepted = scoped.filter((c) => ledger[c.caseId]?.accepted === true);
    acceptedTotal += accepted.length;
    scopedTotal += scoped.length;

    lines.push(
      `### ${d.key} — ${d.label} · #${d.issue} — **${accepted.length}/${scoped.length} AC đã nghiệm thu**`,
      '',
    );
    for (const c of cases) {
      const st = coverageStatus(c);
      const acc = ledger[c.caseId]?.accepted === true;
      const sha = ledger[c.caseId]?.sha
        ? ` · SHA \`${ledger[c.caseId].sha}\``
        : '';
      const tag =
        st === 'out' ? ' — OUT of scope' : ` — coverage: \`${st}\`${sha}`;
      lines.push(`- [${acc ? 'x' : ' '}] ${c.caseId} (${c.priority})${tag}`);
    }
    lines.push('');
  }

  const header = [
    `<!-- generated: pnpm e2e:f04-status --markdown -->`,
    `**Tiến độ nghiệm thu F04: ${acceptedTotal}/${scopedTotal} AC** (JOB-08 OUT riêng).`,
    '',
    'Checkbox tick thủ công qua `tests/e2e/f04-ledger.json` khi AC chạy đủ lớp PLAN yêu cầu',
    'trên checkout sạch ở đúng SHA. `coverage` chỉ là source coverage, không phải PASS.',
    '',
  ];

  if (asMarkdown) {
    console.log([...header, ...lines].join('\n'));
    return;
  }

  const tally = {};
  for (const c of data.cases) {
    const st = coverageStatus(c);
    tally[st] = (tally[st] || 0) + 1;
  }
  console.log(
    JSON.stringify(
      {
        accepted: acceptedTotal,
        scoped: scopedTotal,
        groups: data.groups,
        coverageTally: tally,
      },
      null,
      2,
    ),
  );
}

main();
