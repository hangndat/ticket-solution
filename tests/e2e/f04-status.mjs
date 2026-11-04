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

// Current evidence and historical evidence stay separate in the ledger.
function loadLedger() {
  if (!existsSync(ledgerPath)) return {};
  return JSON.parse(readFileSync(ledgerPath, 'utf8'));
}

function validateLedger(ledger, cases) {
  const known = new Map(cases.map((c) => [c.caseId, c]));
  if (known.size !== cases.length) throw new Error('coverage.mjs có ID AC trùng lặp');

  for (const [caseId, entry] of Object.entries(ledger)) {
    if (caseId.startsWith('_')) continue;
    if (!known.has(caseId)) throw new Error(`Ledger có ID không tồn tại: ${caseId}`);
    if (entry?.accepted === true && coverageStatus(known.get(caseId)) === 'out') {
      throw new Error(`Ledger đánh dấu accepted cho ID OUT: ${caseId}`);
    }
  }

  const historical = ledger._historical;
  if (!historical) return new Set();
  const records = historical.records ?? [];
  if (!Array.isArray(records) || records.length !== historical.recordCount) {
    throw new Error(`Historical recordCount không khớp: ${historical.recordCount} khai báo, ${records.length} bản ghi`);
  }
  const recordIds = records.map((record) => record.id);
  if (new Set(recordIds).size !== recordIds.length) throw new Error('Historical ledger có ID bị lặp');
  for (const record of records) {
    const caseId = record.id;
    if (!known.has(caseId)) throw new Error(`Historical ledger có ID không tồn tại: ${caseId}`);
    if (coverageStatus(known.get(caseId)) === 'out') {
      throw new Error(`Historical ledger đánh dấu accepted cho ID OUT: ${caseId}`);
    }
    if (record?.accepted !== true || !record.integrationSha?.length || !record.layers || !record.runReference) {
      throw new Error(`Historical evidence thiếu provenance: ${caseId}`);
    }
  }
  return new Set(recordIds);
}

function coverageStatus(entry) {
  const statuses = [...new Set(entry.evidence.map((e) => e.status))].sort();
  return statuses.length ? statuses.join('+') : 'unmapped';
}

function main() {
  const data = loadCoverage();
  const ledger = loadLedger();
  const historicalIds = validateLedger(ledger, data.cases);
  const asMarkdown = process.argv.includes('--markdown');
  const only = process.argv.find((a) => a.startsWith('--domain='));
  const wanted = only ? only.split('=')[1].toUpperCase() : null;
  if (wanted && !DOMAINS.some((d) => d.key === wanted)) {
    console.error(`Domain không hợp lệ: ${wanted}`);
    process.exit(2);
  }

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
  let historicalAccepted = 0;
  let currentEvidence = 0;
  let scopedTotal = 0;
  const lines = [];

  for (const d of DOMAINS) {
    if (wanted && d.key !== wanted) continue;
    const cases = byDomain
      .get(d.key)
      .sort((a, b) => a.caseId.localeCompare(b.caseId));
    const scoped = cases.filter((c) => coverageStatus(c) !== 'out');
    const accepted = scoped.filter((c) => historicalIds.has(c.caseId) || ledger[c.caseId]?.accepted === true);
    const historical = scoped.filter((c) => historicalIds.has(c.caseId));
    const current = scoped.filter((c) => ledger[c.caseId]?.accepted === true);
    acceptedTotal += accepted.length;
    historicalAccepted += historical.length;
    currentEvidence += current.length;
    scopedTotal += scoped.length;

    lines.push(
      `### ${d.key} — ${d.label} · #${d.issue} — **${accepted.length}/${scoped.length} AC tích lũy** (lịch sử ${historical.length}, evidence hiện tại ${current.length})`,
      '',
    );
    for (const c of cases) {
      const st = coverageStatus(c);
      const isHistorical = historicalIds.has(c.caseId);
      const hasCurrentEvidence = ledger[c.caseId]?.accepted === true;
      const acc = isHistorical || hasCurrentEvidence;
      const sha = ledger[c.caseId]?.sha
        ? ` · SHA \`${ledger[c.caseId].sha}\``
        : '';
      const evidenceTag = [
        isHistorical ? 'đã nghiệm thu lịch sử trên SHA nguồn' : '',
        hasCurrentEvidence ? 'có evidence hiện tại trong ledger' : '',
      ].filter(Boolean).join('; ');
      const tag = st === 'out'
        ? ' — OUT of scope'
        : ` — coverage: \`${st}\`${sha}${evidenceTag ? ` · ${evidenceTag}` : ''}`;
      lines.push(`- [${acc ? 'x' : ' '}] ${c.caseId} (${c.priority})${tag}`);
    }
    lines.push('');
  }

  const header = [
    `<!-- generated: pnpm e2e:f04-status --markdown -->`,
    `**F04: ${acceptedTotal}/${scopedTotal} AC có evidence tích lũy** (lịch sử ${historicalAccepted}, evidence hiện tại ${currentEvidence}, còn ${scopedTotal - acceptedTotal}; JOB-08 OUT).`,
    '',
    'Số tích lũy hợp nhất evidence lịch sử đã review và evidence hiện tại; ID trùng chỉ tính một lần.',
    'Nó trải trên nhiều SHA và không chứng minh full regression trên HEAD. `coverage` chỉ là source coverage.',
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
        historicalAccepted,
        currentEvidence,
        remaining: scopedTotal - acceptedTotal,
        interpretation: 'accepted là hợp ID có evidence lịch sử và hiện tại trên nhiều SHA; không phải full regression trên HEAD.',
        groups: data.groups,
        coverageTally: tally,
      },
      null,
      2,
    ),
  );
}

main();
