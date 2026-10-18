import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PUBLISHED_SECTION_KINDS } from './types.ts';

test('PUBLISHED_SECTION_KINDS matches contracts published-events source', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const contractsConfig = join(
    here,
    '../../../../packages/contracts/src/config.ts',
  );
  const source = readFileSync(contractsConfig, 'utf8');
  for (const kind of PUBLISHED_SECTION_KINDS) {
    assert.match(
      source,
      new RegExp(`['"]${kind}['"]`),
      `contracts config missing kind ${kind}`,
    );
  }
  assert.deepEqual([...PUBLISHED_SECTION_KINDS], [
    'hero',
    'info',
    'redeem',
    'guide',
    'faq',
    'terms',
  ]);
});
