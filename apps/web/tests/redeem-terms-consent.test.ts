import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parsePublishedRedeemSchema } from '../src/redeem/published-schema';

const redeemDir = join(process.cwd(), 'app/redeem');
const redeemSrc = join(process.cwd(), 'src/redeem');

test('redeem form wires published terms consent UI', () => {
  const form = readFileSync(join(redeemDir, 'redeem-form.tsx'), 'utf8');
  assert.match(form, /RedeemTermsConsent/);
  assert.match(form, /publishedSchemaReady/);
  assert.match(form, /redeem-product-schema-notice/);
  assert.match(form, /loadedSlugPairRef/);
});

test('RedeemTermsConsent exposes stable test id for UAT', () => {
  const source = readFileSync(
    join(redeemSrc, 'redeem-terms-consent.tsx'),
    'utf8',
  );
  assert.match(source, /data-testid="redeem-terms-consent"/);
  assert.match(source, /id="terms-accepted"/);
});

test('parsePublishedRedeemSchema accepts terms with empty bodyMarkdown', () => {
  const schema = parsePublishedRedeemSchema({
    id: '22222222-2222-4222-8222-222222222222',
    schemaVersion: 1,
    publishedConfigVersion: 1,
    terms: { version: 'terms-v1', bodyMarkdown: '' },
  });
  assert.ok(schema);
  assert.equal(schema?.terms?.version, 'terms-v1');
  assert.equal(schema?.terms?.bodyMarkdown, '');
});
