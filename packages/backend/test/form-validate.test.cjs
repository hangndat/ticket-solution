const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateFormAnswers,
  hashFormDefinition,
  ISSUE_ERROR_CODES,
} = require('../dist');
const { buildConsentSnapshot } = require('../dist');
const { FORM_LIMITS } = require('@ticket/contracts');

const form = {
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

test('form-validate: five field types valid + invalid paths', () => {
  const ok = validateFormAnswers(form, {
    full_name: '  Ada Lovelace  ',
    email: 'ada@example.com',
    phone: '+84 90 123 4567',
    shirt: 'm',
    agree: true,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.answers.full_name, 'Ada Lovelace');
  assert.equal(ok.answers.phone, '+84 90 123 4567');

  const bad = validateFormAnswers(form, {
    full_name: 'x'.repeat(FORM_LIMITS.maxTextLength + 1),
    email: 'not-an-email',
    phone: '1',
    shirt: 'forged',
    agree: false,
    unknown_field: 'nope',
  });
  assert.equal(bad.ok, false);
  const codes = new Set(bad.fields.map((f) => f.code));
  assert.ok(codes.has('TOO_LONG'));
  assert.ok(codes.has('INVALID_EMAIL'));
  assert.ok(codes.has('INVALID_PHONE'));
  assert.ok(codes.has('INVALID_OPTION'));
  assert.ok(codes.has('REQUIRED'));
  assert.ok(codes.has('UNKNOWN_FIELD'));
});

test('form-consent: stale form/terms and legacy empty when unpublished', () => {
  const published = {
    form,
    termsVersion: 'terms-v1',
    termsBody: 'Be kind',
    publishedConfigVersion: 1,
  };
  assert.throws(
    () =>
      buildConsentSnapshot(published, {
        formVersion: 'old',
        termsVersion: 'terms-v1',
        answers: { full_name: 'A', email: 'a@b.co', shirt: 's', agree: true },
        termsAccepted: true,
      }),
    (err) => err.code === ISSUE_ERROR_CODES.FORM_VERSION_STALE,
  );
  assert.throws(
    () =>
      buildConsentSnapshot(published, {
        formVersion: 'form-v1',
        termsVersion: 'terms-v1',
        answers: { full_name: 'A', email: 'a@b.co', shirt: 's', agree: true },
        termsAccepted: false,
      }),
    (err) => err.code === ISSUE_ERROR_CODES.TERMS_REQUIRED,
  );

  const legacy = buildConsentSnapshot(
    {
      form: null,
      termsVersion: null,
      termsBody: null,
      publishedConfigVersion: null,
    },
    {},
  );
  assert.equal(legacy.termsAccepted, null);
  assert.deepEqual(legacy.answers, {});
  assert.ok(hashFormDefinition(form).length === 64);
});
