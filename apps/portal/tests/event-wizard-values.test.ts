import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectEventWizardValues,
  eventCreateUpstreamFromWizard,
  suggestEventSlugFromName,
  wizardReviewRows,
  type EventWizardValues,
} from '../src/client/event-wizard-values';

test('suggestEventSlugFromName folds Vietnamese and punctuation to kebab', () => {
  assert.equal(suggestEventSlugFromName('Lễ hội Âm nhạc 2026!'), 'le-hoi-am-nhac-2026');
  assert.equal(suggestEventSlugFromName('   '), '');
});

test('eventCreateUpstreamFromWizard matches CreateEventBodyV2 allowlist', () => {
  const values: EventWizardValues = {
    name: 'Festival',
    slug: 'festival',
    timezone: 'Asia/Ho_Chi_Minh',
    visibility: 'PUBLIC',
    venueName: 'Hall',
    venueAddress: '1 Street',
    contactEmail: 'ops@example.com',
  };
  const body = eventCreateUpstreamFromWizard(values);
  assert.deepEqual(body, {
    name: 'Festival',
    slug: 'festival',
    timezone: 'Asia/Ho_Chi_Minh',
    visibility: 'PUBLIC',
    venue: { name: 'Hall', address: '1 Street' },
    contact: { email: 'ops@example.com' },
  });
});

test('wizardReviewRows reflects upstream body sent on create', () => {
  const body = eventCreateUpstreamFromWizard({
    name: 'Demo',
    slug: 'demo',
    timezone: 'UTC',
    visibility: 'UNLISTED',
    contactEmail: 'a@b.co',
  });
  const labels = {
    name: 'Name',
    slug: 'Slug',
    timezone: 'TZ',
    visibility: 'Vis',
    venue: 'Venue',
    contact: 'Contact',
    empty: '—',
  };
  const rows = wizardReviewRows(body, labels);
  assert.equal(rows.find((r) => r.label === 'Slug')?.value, 'demo');
  assert.equal(rows.find((r) => r.label === 'Venue')?.value, '—');
  assert.equal(rows.find((r) => r.label === 'Contact')?.value, 'a@b.co');
});

test('collectEventWizardValues validates all wizard fields then reads preserved values', async () => {
  const preserved: EventWizardValues = {
    name: 'Festival',
    slug: 'festival',
    timezone: 'UTC',
    visibility: 'UNLISTED',
    venueName: 'Main',
  };
  let validated: string[] | undefined;
  const values = await collectEventWizardValues({
    validateFields: async (names) => {
      validated = names;
      return {};
    },
    getFieldsValue: (all) => {
      assert.equal(all, true);
      return preserved;
    },
  });
  assert.deepEqual(validated, [
    'name',
    'slug',
    'timezone',
    'visibility',
    'venueName',
    'venueAddress',
    'contactEmail',
  ]);
  assert.deepEqual(values, preserved);
});
