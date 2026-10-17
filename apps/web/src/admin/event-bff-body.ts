/**
 * Shared allowlist parsers for C-E admin BFF bodies.
 * Only forwards exact contract fields — no generic JSON passthrough.
 */

import type {
  ArchiveEventBody,
  CancelEventBody,
  CloneEventBody,
  EventImpactPreviewRequest,
  PatchEventBody,
} from '@ticket/contracts';
import { isEventVisibility } from './create-event';
import {
  buildArchiveEventBody,
  buildCancelEventBody,
  buildCloneEventBody,
  buildImpactPreviewRequest,
  buildPatchEventBody,
} from './event-lifecycle';
import { bffApiError, isUuid } from '../bff/upstream';

export type ParsedScope = { tenantId: string; eventId: string };

export function requireScope(body: {
  tenantId?: string;
  eventId?: string;
}): Response | ParsedScope {
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return { tenantId, eventId };
}

export function requireIdempotencyKey(
  raw: string | undefined,
): Response | string {
  const key = raw?.trim() ?? '';
  if (!isUuid(key)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return key;
}

export function requireExpectedRevision(
  value: unknown,
): Response | number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return bffApiError(
      'INVALID_INPUT',
      'expectedRevision must be a non-negative integer.',
      422,
    );
  }
  return value;
}

function emptyToNull(value: string | undefined | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalCap(value: unknown): Response | number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return bffApiError(
      'INVALID_INPUT',
      'maxTicketsPerAttendee must be a positive integer or null.',
      422,
    );
  }
  return value;
}

type LooseBody = Record<string, unknown>;

export function parsePatchBody(
  body: LooseBody,
): Response | { patch: PatchEventBody; idempotencyKey: string } {
  const expectedRevision = requireExpectedRevision(body.expectedRevision);
  if (expectedRevision instanceof Response) return expectedRevision;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;

  const visibilityRaw =
    typeof body.visibility === 'string' ? body.visibility.trim() : undefined;
  if (visibilityRaw !== undefined && !isEventVisibility(visibilityRaw)) {
    return bffApiError(
      'INVALID_VISIBILITY',
      'visibility must be PUBLIC or UNLISTED.',
      422,
    );
  }

  const cap = optionalCap(body.maxTicketsPerAttendee);
  if (cap instanceof Response) return cap;

  const confirmIssuedImpact = body.confirmIssuedImpact === true;
  const notifyAttendees =
    typeof body.notifyAttendees === 'boolean'
      ? body.notifyAttendees
      : undefined;

  const patch = buildPatchEventBody({
    expectedRevision,
    name: typeof body.name === 'string' ? body.name : undefined,
    timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
    visibility: isEventVisibility(visibilityRaw) ? visibilityRaw : undefined,
    startsAt: emptyToNull(
      body.startsAt === null
        ? null
        : typeof body.startsAt === 'string'
          ? body.startsAt
          : undefined,
    ),
    endsAt: emptyToNull(
      body.endsAt === null
        ? null
        : typeof body.endsAt === 'string'
          ? body.endsAt
          : undefined,
    ),
    venueName: typeof body.venueName === 'string' ? body.venueName : undefined,
    venueAddress:
      typeof body.venueAddress === 'string' ? body.venueAddress : undefined,
    clearVenue: body.venue === null || body.clearVenue === true,
    contactEmail:
      typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
    contactPhone:
      typeof body.contactPhone === 'string' ? body.contactPhone : undefined,
    contactUrl:
      typeof body.contactUrl === 'string' ? body.contactUrl : undefined,
    clearContact: body.contact === null || body.clearContact === true,
    redemptionOpensAt: emptyToNull(
      body.redemptionOpensAt === null
        ? null
        : typeof body.redemptionOpensAt === 'string'
          ? body.redemptionOpensAt
          : undefined,
    ),
    redemptionClosesAt: emptyToNull(
      body.redemptionClosesAt === null
        ? null
        : typeof body.redemptionClosesAt === 'string'
          ? body.redemptionClosesAt
          : undefined,
    ),
    checkInOpensAt: emptyToNull(
      body.checkInOpensAt === null
        ? null
        : typeof body.checkInOpensAt === 'string'
          ? body.checkInOpensAt
          : undefined,
    ),
    checkInClosesAt: emptyToNull(
      body.checkInClosesAt === null
        ? null
        : typeof body.checkInClosesAt === 'string'
          ? body.checkInClosesAt
          : undefined,
    ),
    maxTicketsPerAttendee: cap,
    confirmIssuedImpact,
    notifyAttendees,
  });

  // Also accept nested venue/contact from exact PatchEventBody shape.
  if (body.venue && typeof body.venue === 'object' && !Array.isArray(body.venue)) {
    const venue = body.venue as { name?: string; address?: string };
    if (
      typeof venue.name === 'string' &&
      venue.name.trim() &&
      typeof venue.address === 'string' &&
      venue.address.trim()
    ) {
      patch.venue = {
        name: venue.name.trim(),
        address: venue.address.trim(),
      };
    }
  }
  if (
    body.contact &&
    typeof body.contact === 'object' &&
    !Array.isArray(body.contact)
  ) {
    const contact = body.contact as {
      email?: string;
      phone?: string;
      url?: string;
    };
    const next: NonNullable<PatchEventBody['contact']> = {};
    if (typeof contact.email === 'string' && contact.email.trim()) {
      next.email = contact.email.trim();
    }
    if (typeof contact.phone === 'string' && contact.phone.trim()) {
      next.phone = contact.phone.trim();
    }
    if (typeof contact.url === 'string' && contact.url.trim()) {
      next.url = contact.url.trim();
    }
    if (Object.keys(next).length > 0) patch.contact = next;
  }

  return { patch, idempotencyKey };
}

export function parseCloneBody(
  body: LooseBody,
): Response | { clone: CloneEventBody; idempotencyKey: string } {
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!slug || !name) {
    return bffApiError(
      'EVENT_FIELDS_REQUIRED',
      'slug and name are required for clone.',
      422,
    );
  }
  return {
    clone: buildCloneEventBody({
      slug,
      name,
      copyConfig: body.copyConfig === true,
    }),
    idempotencyKey,
  };
}

export function parseCancelBody(
  body: LooseBody,
): Response | { cancel: CancelEventBody; idempotencyKey: string } {
  const expectedRevision = requireExpectedRevision(body.expectedRevision);
  if (expectedRevision instanceof Response) return expectedRevision;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 500) {
    return bffApiError(
      'INVALID_INPUT',
      'reason must be 1..500 characters.',
      422,
    );
  }
  return {
    cancel: buildCancelEventBody({
      expectedRevision,
      reason,
      notifyAttendees:
        typeof body.notifyAttendees === 'boolean'
          ? body.notifyAttendees
          : undefined,
    }),
    idempotencyKey,
  };
}

export function parseArchiveBody(
  body: LooseBody,
): Response | { archive: ArchiveEventBody; idempotencyKey: string } {
  const expectedRevision = requireExpectedRevision(body.expectedRevision);
  if (expectedRevision instanceof Response) return expectedRevision;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  return {
    archive: buildArchiveEventBody(expectedRevision),
    idempotencyKey,
  };
}

export function parseImpactBody(
  body: LooseBody,
): Response | EventImpactPreviewRequest {
  const expectedRevision = requireExpectedRevision(body.expectedRevision);
  if (expectedRevision instanceof Response) return expectedRevision;
  const req = buildImpactPreviewRequest({
    expectedRevision,
    startsAt: emptyToNull(
      body.startsAt === null
        ? null
        : typeof body.startsAt === 'string'
          ? body.startsAt
          : undefined,
    ),
    endsAt: emptyToNull(
      body.endsAt === null
        ? null
        : typeof body.endsAt === 'string'
          ? body.endsAt
          : undefined,
    ),
    venueName: typeof body.venueName === 'string' ? body.venueName : undefined,
    venueAddress:
      typeof body.venueAddress === 'string' ? body.venueAddress : undefined,
    clearVenue: body.venue === null || body.clearVenue === true,
  });
  if (body.venue && typeof body.venue === 'object' && !Array.isArray(body.venue)) {
    const venue = body.venue as { name?: string; address?: string };
    if (
      typeof venue.name === 'string' &&
      venue.name.trim() &&
      typeof venue.address === 'string' &&
      venue.address.trim()
    ) {
      req.venue = {
        name: venue.name.trim(),
        address: venue.address.trim(),
      };
    }
  }
  return req;
}
