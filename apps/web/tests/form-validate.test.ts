import assert from 'node:assert/strict';
import test from 'node:test';
import { FORM_LIMITS, type FormDefinition } from '@ticket/contracts';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '../src/redeem/form-validate';

const fiveFields: FormDefinition = {
  formVersion: 'form-v1',
  fields: [
    { id: 'full_name', label: 'Full name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'phone', label: 'Phone', type: 'phone', required: false },
    {
      id: 'shirt',
      label: 'Shirt',
      type: 'select',
      required: true,
      options: [
        { id: 's', label: 'S' },
        { id: 'm', label: 'M' },
      ],
    },
    { id: 'agree', label: 'Agree', type: 'checkbox', required: true },
  ],
};

test('valid answers cover all five field types', () => {
  const result = validateFormAnswers(fiveFields, {
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+84 90 123 4567',
    shirt: 'm',
    agree: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.answers.full_name, 'Ada Lovelace');
    assert.equal(result.answers.agree, true);
  }
});

test('rejects forged select, false checkbox, bad email, unknown field, oversize text', () => {
  const result = validateFormAnswers(fiveFields, {
    full_name: 'x'.repeat(FORM_LIMITS.maxTextLength + 1),
    email: 'not-an-email',
    phone: '1',
    shirt: 'forged-option',
    agree: false,
    unknown_field: 'nope',
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    const codes = new Set(result.issues.map((i) => i.code));
    assert.ok(codes.has('TOO_LONG'));
    assert.ok(codes.has('INVALID_EMAIL'));
    assert.ok(codes.has('INVALID_PHONE'));
    assert.ok(codes.has('INVALID_OPTION'));
    assert.ok(codes.has('REQUIRED'));
    assert.ok(codes.has('UNKNOWN_FIELD'));
  }
});

test('requireTermsConsent only when published termsVersion present', () => {
  assert.equal(requireTermsConsent({ termsVersion: null, termsAccepted: false }), null);
  const missing = requireTermsConsent({
    termsVersion: 'terms-v1',
    termsAccepted: false,
  });
  assert.equal(missing?.code, 'TERMS_REQUIRED');
  assert.equal(
    requireTermsConsent({ termsVersion: 'terms-v1', termsAccepted: true }),
    null,
  );
});

test('empty definition rejects unexpected answers', () => {
  const result = validateFormAnswers(null, { surprise: 'x' });
  assert.equal(result.ok, false);
});
