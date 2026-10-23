import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertSafePlainText,
  parseConfigPayload,
} from '../src/content/config-schema';
import {
  fixtureConfigPayload,
  fixtureSectionKinds,
} from './fixtures/event-cb';

describe('config-schema (content)', () => {
  it('accepts contract fixture payload with six fixed kinds', () => {
    const parsed = parseConfigPayload(fixtureConfigPayload);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.payload.sections.length, 6);
    assert.deepEqual(
      parsed.payload.sections.map((s) => s.kind).sort(),
      [...fixtureSectionKinds].sort(),
    );
  });

  it('rejects arbitrary section kinds and unsafe plain text', () => {
    const badKind = parseConfigPayload({
      ...fixtureConfigPayload,
      sections: [
        ...fixtureConfigPayload.sections.slice(0, 5),
        {
          kind: 'customHtml',
          id: 'x',
          visible: true,
          order: 5,
          body: { html: '<b>x</b>' },
        },
      ],
    });
    assert.equal(badKind.ok, false);
    assert.ok(badKind.issues.some((i) => i.code === 'CONFIG_SECTION_KIND'));

    const xss = assertSafePlainText(
      'hero.text',
      'Hello <script>alert(1)</script>',
      4000,
    );
    assert.ok(xss);
    assert.equal(xss?.code, 'CONFIG_UNSAFE_MARKUP');
  });

  it('rejects non-object payload', () => {
    const parsed = parseConfigPayload(null);
    assert.equal(parsed.ok, false);
    assert.ok(
      parsed.issues.some((i) => i.code === 'CONFIG_PAYLOAD_REQUIRED'),
    );
  });
});
