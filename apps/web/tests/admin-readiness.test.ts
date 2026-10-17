import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultConfigPayload } from '../src/admin/config-schema';
import {
  deriveAdminReadiness,
  readinessAllOk,
  readinessSummary,
} from '../src/admin/readiness';

describe('deriveAdminReadiness', () => {
  it('marks all unknown when no event context', () => {
    const items = deriveAdminReadiness({
      ticketTypeId: 'tt',
      sourceId: 'src',
      quotaDecision: { kind: 'quota', capacity: null, allocated: 0 },
      report: null,
      eventQuotaInput: '',
      configPayload: defaultConfigPayload(),
      configPublished: true,
      hasEventContext: false,
    });
    assert.ok(items.every((i) => i.status === 'unknown'));
    assert.match(readinessSummary(items), /Chưa chọn sự kiện/);
  });

  it('treats null capacity as valid unlimited quota', () => {
    const payload = defaultConfigPayload();
    payload.brand.organizationName = 'MFest';
    payload.brand.primaryColor = '#0B3D2E';
    const terms = payload.sections.find(
      (s: { kind: string }) => s.kind === 'terms',
    );
    if (terms) {
      (terms.body as { termsVersion: string }).termsVersion = 'v1';
      (terms.body as { text: string }).text = 'Điều khoản demo';
    }
    const items = deriveAdminReadiness({
      ticketTypeId: 'type-1',
      sourceId: 'source-1',
      quotaDecision: { kind: 'quota', capacity: null, allocated: 0 },
      report: null,
      eventQuotaInput: '',
      configPayload: payload,
      configPublished: false,
      hasEventContext: true,
    });
    const quota = items.find((i) => i.key === 'quota');
    assert.equal(quota?.status, 'ok');
    assert.match(quota?.detail ?? '', /Không giới hạn/);
    assert.equal(readinessAllOk(items), true);
  });

  it('does not invent OK for missing type/source', () => {
    const items = deriveAdminReadiness({
      ticketTypeId: '',
      sourceId: '',
      quotaDecision: null,
      report: null,
      eventQuotaInput: '',
      configPayload: defaultConfigPayload(),
      configPublished: false,
      hasEventContext: true,
    });
    assert.equal(items.find((i) => i.key === 'types')?.status, 'missing');
    assert.equal(items.find((i) => i.key === 'sources')?.status, 'missing');
    assert.equal(items.find((i) => i.key === 'quota')?.status, 'unknown');
    assert.equal(readinessAllOk(items), false);
    assert.match(readinessSummary(items), /Thiếu/);
  });
});
