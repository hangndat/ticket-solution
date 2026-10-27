import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormDefinition } from './contract.ts';
import { requireTermsConsent, validateFormAnswers } from './form-validate.ts';

const form: FormDefinition = {
  formVersion: 'f-1',
  fields: [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'phone', label: 'Phone', type: 'phone', required: false },
    {
      id: 'size',
      label: 'Size',
      type: 'select',
      required: true,
      options: [
        { id: 's', label: 'S' },
        { id: 'm', label: 'M' },
      ],
    },
    { id: 'newsletter', label: 'Newsletter', type: 'checkbox', required: true },
  ],
};

test('valid five-field answers pass', () => {
  const result = validateFormAnswers(form, {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+84 90 123 4567',
    size: 'm',
    newsletter: true,
  });
  assert.equal(result.ok, true);
});

test('required select/checkbox/missing and forged option fail', () => {
  const missing = validateFormAnswers(form, {
    name: 'Ada',
    email: 'ada@example.com',
  });
  assert.equal(missing.ok, false);

  const forged = validateFormAnswers(form, {
    name: 'Ada',
    email: 'ada@example.com',
    size: 'xl',
    newsletter: true,
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) {
    assert.ok(forged.issues.some((i) => i.fieldId === 'size'));
  }

  const unchecked = validateFormAnswers(form, {
    name: 'Ada',
    email: 'ada@example.com',
    size: 's',
    newsletter: false,
  });
  assert.equal(unchecked.ok, false);
});

test('unknown field keys are rejected', () => {
  const result = validateFormAnswers(form, {
    name: 'Ada',
    email: 'ada@example.com',
    size: 's',
    newsletter: true,
    hacker: 'x',
  });
  assert.equal(result.ok, false);
});

test('terms consent required when version present', () => {
  const missing = requireTermsConsent({
    termsVersion: 't-1',
    termsAccepted: false,
  });
  assert.equal(missing?.code, 'TERMS_REQUIRED');
  assert.equal(
    requireTermsConsent({ termsVersion: 't-1', termsAccepted: true }),
    null,
  );
  assert.equal(
    requireTermsConsent({ termsVersion: null, termsAccepted: false }),
    null,
  );
});
