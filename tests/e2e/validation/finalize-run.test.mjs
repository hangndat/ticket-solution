import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeRun } from '../harness/finalize-run.mjs';

test('cleanup decides evidence after the original test result', async () => {
  const make = (status) => ({
    status,
    results: [{ layer: 'HTTP', exitCode: status === 'PASS' ? 0 : 1 }],
    reason: 'original result',
    sourceProvenance: { evidenceExactShaEligible: true },
  });
  const positive = await finalizeRun(make('PASS'), async () => null);
  assert.equal(positive.summary.status, 'PASS');
  assert.equal(positive.exitCode, 0);
  assert.equal(positive.summary.cleanup.status, 'PASS');
  assert.equal(
    positive.summary.sourceProvenance.evidenceExactShaEligible,
    true,
  );
  for (const status of ['PASS', 'FAIL', 'BLOCKED']) {
    const result = await finalizeRun(make(status), async () => {
      throw new Error('injected cleanup failure');
    });
    assert.equal(result.summary.status, status === 'PASS' ? 'FAIL' : status);
    assert.equal(result.exitCode, 2);
    assert.equal(result.summary.results[0].exitCode, status === 'PASS' ? 0 : 1);
    assert.equal(result.summary.reason, 'original result');
    assert.equal(result.summary.cleanup.status, 'FAIL');
    assert.match(result.cleanupError, /injected cleanup failure/);
    assert.equal(
      result.summary.sourceProvenance.evidenceExactShaEligible,
      false,
    );
    assert.equal(result.summary.sourceProvenance.evidenceEligible, false);
    assert.equal(
      result.summary.sourceProvenance.nonEvidenceReason,
      'CLEANUP_FAILED',
    );
  }
});
