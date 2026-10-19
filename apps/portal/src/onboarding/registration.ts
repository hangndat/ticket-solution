/**
 * P2-ONBOARD-PENDING — client helpers for self-serve registration (no secrets).
 * PENDING wins over BA ACTIVE-ngay (AC-PS5 / ADR §8).
 */

import type {
  PublicTenantRegistrationBody,
  PublicTenantRegistrationResponse,
} from '@ticket/contracts';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidRegistrationSlug(slug: string): boolean {
  return SLUG_RE.test(slug.trim().toLowerCase());
}

export function normalizeRegistrationBody(input: {
  slug?: string;
  name?: string;
  defaultTimezone?: string;
  contact?: string | null;
}): PublicTenantRegistrationBody | null {
  const slug = input.slug?.trim().toLowerCase() ?? '';
  const name = input.name?.trim() ?? '';
  if (!isValidRegistrationSlug(slug) || name.length < 1 || name.length > 200) {
    return null;
  }
  const body: PublicTenantRegistrationBody = { slug, name };
  const tz = input.defaultTimezone?.trim();
  if (tz) body.defaultTimezone = tz;
  if (input.contact !== undefined) {
    const contact =
      typeof input.contact === 'string' ? input.contact.trim() || null : null;
    body.contact = contact;
  }
  return body;
}

export function parseRegistrationResponse(
  status: number,
  json: unknown,
): PublicTenantRegistrationResponse | null {
  if ((status !== 200 && status !== 201) || !json || typeof json !== 'object') {
    return null;
  }
  const body = json as Record<string, unknown>;
  if (
    typeof body.registrationId !== 'string' ||
    typeof body.tenantId !== 'string' ||
    body.status !== 'PENDING'
  ) {
    return null;
  }
  return {
    registrationId: body.registrationId,
    tenantId: body.tenantId,
    status: 'PENDING',
  };
}

/** Fail-closed: never treat non-PENDING as activated org. */
export function isPendingActivationStatus(
  status: string | null | undefined,
): boolean {
  return status === 'PENDING';
}
