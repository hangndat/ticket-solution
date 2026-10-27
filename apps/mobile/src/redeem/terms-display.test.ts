import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTermsForDisplay } from './terms-display.ts';

test('published body wins over event terms', () => {
  const next = resolveTermsForDisplay(
    { version: 'p-1', bodyMarkdown: '  Published body  ' },
    { version: 'e-1', bodyMarkdown: 'Event body' },
  );
  assert.equal(next.version, 'p-1');
  assert.equal(next.body, 'Published body');
  assert.equal(next.emptyBodyNotice, null);
});

test('event.terms fills empty published body without inventing legal text', () => {
  const next = resolveTermsForDisplay(
    { version: 'p-1', bodyMarkdown: '   ' },
    { version: 'e-1', bodyMarkdown: 'Event terms body' },
  );
  assert.equal(next.version, 'p-1');
  assert.equal(next.body, 'Event terms body');
  assert.equal(next.emptyBodyNotice, null);
});

test('version without body still shows a real terms context', () => {
  const next = resolveTermsForDisplay({ version: 't-9', bodyMarkdown: '' });
  assert.equal(next.version, 't-9');
  assert.equal(next.body, null);
  assert.match(next.emptyBodyNotice ?? '', /phiên bản t-9/);
  assert.doesNotMatch(next.emptyBodyNotice ?? '', /hereby|liability|indemnif/i);
});

test('no version means no terms block even if leftover body exists', () => {
  const next = resolveTermsForDisplay(
    { version: '  ', bodyMarkdown: '' },
    { version: null, bodyMarkdown: 'orphan' },
  );
  assert.equal(next.version, null);
  assert.equal(next.body, 'orphan');
  assert.equal(next.emptyBodyNotice, null);
});
