import type { CreateEventBodyV2 } from '@ticket/contracts';
import { buildCreateEventUpstreamBody } from '../prep/create-event-body';

export type EventWizardValues = {
  slug: string;
  name: string;
  timezone: string;
  visibility: 'PUBLIC' | 'UNLISTED';
  venueName?: string;
  venueAddress?: string;
  contactEmail?: string;
};

export const EVENT_WIZARD_FIELD_NAMES = [
  'name',
  'slug',
  'timezone',
  'visibility',
  'venueName',
  'venueAddress',
  'contactEmail',
] as const;

/** Kebab-case slug aligned with BE `assertValidSlug` pattern. */
export function suggestEventSlugFromName(name: string): string {
  const folded = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!folded) return '';
  return folded.length > 64 ? folded.slice(0, 64).replace(/-+$/g, '') : folded;
}

export function eventCreateUpstreamFromWizard(
  values: EventWizardValues,
): CreateEventBodyV2 {
  return buildCreateEventUpstreamBody(values);
}

export type WizardReviewRow = { label: string; value: string };

export function wizardReviewRows(
  body: CreateEventBodyV2,
  labels: {
    name: string;
    slug: string;
    timezone: string;
    visibility: string;
    venue: string;
    contact: string;
    empty: string;
  },
): WizardReviewRow[] {
  const venue =
    body.venue?.name && body.venue?.address
      ? `${body.venue.name} — ${body.venue.address}`
      : labels.empty;
  const contact = body.contact?.email?.trim()
    ? body.contact.email
    : labels.empty;
  return [
    { label: labels.name, value: body.name },
    { label: labels.slug, value: body.slug },
    { label: labels.timezone, value: body.timezone ?? labels.empty },
    { label: labels.visibility, value: body.visibility ?? labels.empty },
    { label: labels.venue, value: venue },
    { label: labels.contact, value: contact },
  ];
}

export async function collectEventWizardValues(form: {
  validateFields(names?: string[]): Promise<unknown>;
  getFieldsValue(all: true): EventWizardValues;
}): Promise<EventWizardValues> {
  await form.validateFields([...EVENT_WIZARD_FIELD_NAMES]);
  // Earlier wizard steps may be hidden; Ant Design skips unmounted items in validateFields().
  return form.getFieldsValue(true);
}
