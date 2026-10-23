import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planReview } from './agent-review-publish.mjs';
const sha = 'a'.repeat(40), body = `Review SHA ${sha}: PASS. Tests pass; no findings.`;
const input = { repo: 'test/repo', pr: 12, issue: 13, sha, verdict: 'PASS', body };
test('canonical existing review prevents duplicate posts', () => {
  const first = planReview(input);
  const p = planReview({ ...input, prComments: [{ body: first.marker, html_url: 'https://github.com/test/repo/pull/12#issuecomment-123' }], issueComments: [{ body: first.pointerMarker }] });
  assert.equal(p.createCanonical, false); assert.equal(p.createPointer, false);
});
test('rejects missing SHA, invalid target and untrusted canonical links', () => {
  assert.throws(() => planReview({ ...input, body: 'PASS' }), /exact_sha/);
  assert.throws(() => planReview({ ...input, issue: 12 }), /invalid_target/);
  assert.throws(() => planReview({ ...input, repo: '../repo' }), /invalid_target/);
  const p = planReview(input);
  assert.throws(() => planReview({ ...input, prComments: [{ body: p.marker, html_url: 'https://evil.test' }] }), /canonical/);
});
test('CLI dry-run performs no mutation; apply twice is idempotent; Issue is link only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-publish-'));
  try {
    const state = join(dir, 'state.json'), report = join(dir, 'review.md');
    writeFileSync(state, JSON.stringify({ comments: {}, posts: 0 })); writeFileSync(report, body);
    writeFileSync(join(dir, 'gh'), `#!/usr/bin/env node
const fs=require('node:fs');const a=process.argv.slice(2),p=process.env.PUBLISH_STATE,s=JSON.parse(fs.readFileSync(p));
const endpoint=a.find(x=>x.startsWith('repos/'));let r;
if(endpoint.endsWith('/pulls/12'))r={head:{sha:'${sha}'}};
else if(a.includes('POST')){const n=endpoint.split('/')[4];if(n==='13'&&s.failPointerOnce){s.failPointerOnce=false;fs.writeFileSync(p,JSON.stringify(s));process.exit(1);}const v=JSON.parse(fs.readFileSync(0,'utf8'));s.posts++;r={body:v.body,html_url:'https://github.com/test/repo/'+(n==='12'?'pull/':'issues/')+n+'#issuecomment-'+s.posts};(s.comments[n]??=[]).push(r);fs.writeFileSync(p,JSON.stringify(s));}
else {const n=endpoint.split('/')[4];r=[s.comments[n]??[]];}
console.log(JSON.stringify(r));
`, { mode: 0o700 });
    const args = ['--repo','test/repo','--pr','12','--issue','13','--sha',sha,'--verdict','PASS','--body-file',report];
    const script = fileURLToPath(new URL('./agent-review-publish.mjs', import.meta.url));
    const run = extra => spawnSync(process.execPath, [script,...args,...extra], { encoding:'utf8', env:{...process.env,PATH:`${dir}:${process.env.PATH}`,PUBLISH_STATE:state} });
    assert.equal(run([]).status, 0); assert.equal(JSON.parse(readFileSync(state)).posts, 0);
    const applied = run(['--apply']); assert.equal(applied.status, 0, applied.stderr);
    const s = JSON.parse(readFileSync(state)); assert.equal(s.posts, 2);
    assert.ok(s.comments['12'][0].body.includes(body)); assert.ok(!s.comments['13'][0].body.includes('Tests pass'));
    assert.equal(run(['--apply']).status, 0); assert.equal(JSON.parse(readFileSync(state)).posts, 2);
    // A failed Issue pointer must not duplicate the already published PR report.
    writeFileSync(state, JSON.stringify({comments:{},posts:0,failPointerOnce:true}));
    assert.equal(run(['--apply']).status, 1);
    assert.equal(JSON.parse(readFileSync(state)).posts, 1);
    assert.equal(run(['--apply']).status, 0);
    const retried=JSON.parse(readFileSync(state));
    assert.equal(retried.posts, 2); assert.equal(retried.comments['12'].length, 1);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});
