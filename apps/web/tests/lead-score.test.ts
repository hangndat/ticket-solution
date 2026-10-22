import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreQualifiedLead } from '../src/marketing/lead/score-qualified';

const base = {
  name: 'A',
  email: 'a@example.com',
  org: 'O',
  role: 'other' as const,
  note: '',
  consent: true as const,
};

describe('scoreQualifiedLead', () => {
  it('marks agency + high events as qualified tier B', () => {
    const r = scoreQualifiedLead({
      ...base,
      role: 'agency',
      events_per_year: '21+',
      note: 'cần cổng multi-event',
    });
    assert.ok(r.score >= 60);
    assert.equal(r.qualified, true);
    assert.equal(r.tier, 'B');
    assert.ok(r.signals.includes('role_agency'));
    assert.ok(r.signals.includes('events_high'));
  });

  it('keeps low-signal other role below threshold', () => {
    const r = scoreQualifiedLead({ ...base, role: 'other' });
    assert.equal(r.qualified, false);
    assert.equal(r.tier, 'C');
  });
});
