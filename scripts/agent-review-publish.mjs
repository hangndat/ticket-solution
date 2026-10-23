#!/usr/bin/env node
/** Publish one canonical review plus a short issue pointer. Read-only unless --apply. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function planReview({ repo, pr, issue, sha, verdict, body, prComments = [], issueComments = [] }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || repo.split('/').some(x => x === '.' || x === '..') || !Number.isSafeInteger(pr) || pr < 1 ||
      (issue !== null && (!Number.isSafeInteger(issue) || issue < 1 || issue === pr))) throw Error('invalid_target');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha) || !['PASS', 'FAIL', 'PASS with known gap'].includes(verdict)) throw Error('invalid_review');
  if (!body.trim() || !body.includes(sha)) throw Error('report_missing_exact_sha');
  const fingerprint = createHash('sha256').update(body).digest('hex');
  const marker = `<!-- agent-review:${sha}:${fingerprint} -->`;
  const canonical = prComments.find(c => c.body?.includes(marker));
  if (canonical && !validCanonical(canonical.html_url, repo, pr)) throw Error('invalid_canonical_url');
  const pointerMarker = `<!-- agent-review-ref:${sha}:${fingerprint} -->`;
  return { marker, pointerMarker, fingerprint, canonicalUrl: canonical?.html_url ?? null,
    createCanonical: !canonical, createPointer: issue !== null && !issueComments.some(c => c.body?.includes(pointerMarker)) };
}
function validCanonical(url, repo, pr) {
  return typeof url === 'string' && url.startsWith(`https://github.com/${repo}/pull/${pr}#issuecomment-`) && /^\d+$/.test(url.split('#issuecomment-')[1]);
}
function gh(args, input) {
  try {
    return JSON.parse(execFileSync('gh', args, { input, encoding: 'utf8', maxBuffer: 8e6, stdio: ['pipe', 'pipe', 'pipe'] }));
  } catch { throw Error('github_request_failed'); }
}
function comments(repo, number) {
  const pages = gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/comments?per_page=100`]);
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw Error('invalid_comments_response');
  return pages.flat();
}
export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log('node scripts/agent-review-publish.mjs --repo owner/name --pr N [--issue N] --sha FULL_SHA --verdict "PASS|FAIL|PASS with known gap" --body-file PATH [--apply]\nDefault: read-only plan. --apply posts one canonical PR review comment and a short linked Issue status; repeated identical reports are idempotent. No Project edits or Git commits.');
    return;
  }
  const flags = {};
  const known = new Set(['repo', 'pr', 'issue', 'sha', 'verdict', 'body-file']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (k === 'apply' && argv[i] === '--apply') { flags.apply = true; continue; }
    if (!known.has(k) || !argv[i].startsWith('--') || flags[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('invalid_arguments');
    flags[k] = argv[++i];
  }
  const repo = flags.repo;
  const pr = Number(flags.pr), issue = flags.issue === undefined ? null : Number(flags.issue);
  const sha = flags.sha, verdict = flags.verdict;
  let body;
  try { body = readFileSync(flags['body-file'], 'utf8'); } catch { throw Error('report_unreadable'); }
  // Validate inputs before making any request.
  planReview({ repo, pr, issue, sha, verdict, body });
  const pull = gh(['api', `repos/${repo}/pulls/${pr}`]);
  if (pull.head?.sha !== sha) throw Error('pr_head_mismatch');
  const plan = planReview({ repo, pr, issue, sha, verdict, body,
    prComments: comments(repo, pr), issueComments: issue === null ? [] : comments(repo, issue) });
  let canonicalUrl = plan.canonicalUrl;
  let createdCanonical = false, createdPointer = false;
  if (flags.apply && plan.createCanonical) {
    const result = gh(['api', '--method', 'POST', `repos/${repo}/issues/${pr}/comments`, '--input', '-'], JSON.stringify({ body: `${body.trim()}\n\n${plan.marker}` }));
    if (!validCanonical(result.html_url, repo, pr)) throw Error('invalid_created_canonical_url');
    canonicalUrl = result.html_url; createdCanonical = true;
  }
  if (flags.apply && plan.createPointer) {
    if (!canonicalUrl) throw Error('canonical_missing');
    gh(['api', '--method', 'POST', `repos/${repo}/issues/${issue}/comments`, '--input', '-'], JSON.stringify({ body: `Review PR #${pr} · SHA \`${sha}\` · ${verdict}.\n[Báo cáo canonical](${canonicalUrl}). Đây là kết quả review; trạng thái nghiệm thu theo đủ gate.\n\n${plan.pointerMarker}` }));
    createdPointer = true;
  }
  console.log(JSON.stringify({ schema: 'agent-review-publish/v1', applied: Boolean(flags.apply), sha,
    canonicalUrl, createCanonical: plan.createCanonical, createPointer: plan.createPointer,
    createdCanonical, createdPointer, reportSha256: plan.fingerprint }));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { main(); } catch (e) { console.error(JSON.stringify({ error: e.message })); process.exitCode = 1; }
}
