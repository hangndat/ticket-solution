import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  WEB05_PUBLISHED_FORM_V1,
  WEB05_PUBLISHED_FORM_V2,
  WEB05_PUBLISHED_TERMS_V1,
  WEB05_PUBLISHED_TERMS_V2,
} from './web05-published-config.mjs';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);

export function loadWeb05ExpectedHashes() {
  const { hashFormDefinition, hashTermsContent } =
    requireBackend('./dist/index.js');
  const formHashV1 = hashFormDefinition(WEB05_PUBLISHED_FORM_V1);
  const termsHashV1 = hashTermsContent(WEB05_PUBLISHED_TERMS_V1);
  const formHashV2 = hashFormDefinition(WEB05_PUBLISHED_FORM_V2);
  const termsHashV2 = hashTermsContent(WEB05_PUBLISHED_TERMS_V2);
  return {
    v1: { form: formHashV1, terms: termsHashV1 },
    v2: { form: formHashV2, terms: termsHashV2 },
  };
}
