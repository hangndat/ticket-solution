import {
  buildCreateEventUpstreamBody,
  createEventUpstreamPath,
  eventsListUpstreamPath,
  isEventVisibility,
} from '../../../../../src/admin/create-event';
import { requireIdempotencyKey } from '../../../../../src/admin/event-bff-body';
import { assertMutatingBrowserAsync } from '../../../../../src/bff/csrf';
import { isUuid } from '../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  slug?: string;
  name?: string;
  timezone?: string;
  visibility?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string;
  venueAddress?: string;
  venue?: { name?: string; address?: string } | null;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
  contact?: { email?: string; phone?: string; url?: string } | null;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
  idempotencyKey?: string;
};

/**
 * POST /api/bff/admin/events → POST /v1/tenants/{tenantId}/events
 * C-E CreateEventBodyV2 + Idempotency-Key + CSRF.
 */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const tenantId = body.tenantId?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('TENANT_REQUIRED', 'tenantId must be a UUID.', 422);
  }
  const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const slug = body.slug?.trim() ?? '';
  const name = body.name?.trim() ?? '';
  if (!slug || !name) {
    return bffApiError(
      'EVENT_FIELDS_REQUIRED',
      'slug and name are required.',
      422,
    );
  }
  if (
    body.visibility !== undefined &&
    body.visibility !== null &&
    !isEventVisibility(body.visibility.trim())
  ) {
    return bffApiError(
      'INVALID_VISIBILITY',
      'visibility must be PUBLIC or UNLISTED.',
      422,
    );
  }
  if (
    body.maxTicketsPerAttendee !== undefined &&
    body.maxTicketsPerAttendee !== null &&
    (typeof body.maxTicketsPerAttendee !== 'number' ||
      !Number.isInteger(body.maxTicketsPerAttendee) ||
      body.maxTicketsPerAttendee < 1)
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'maxTicketsPerAttendee must be a positive integer or null.',
      422,
    );
  }

  const venueName =
    body.venueName?.trim() ||
    (body.venue && typeof body.venue === 'object'
      ? body.venue.name?.trim()
      : undefined);
  const venueAddress =
    body.venueAddress?.trim() ||
    (body.venue && typeof body.venue === 'object'
      ? body.venue.address?.trim()
      : undefined);
  const contactEmail =
    body.contactEmail?.trim() ||
    (body.contact && typeof body.contact === 'object'
      ? body.contact.email?.trim()
      : undefined);
  const contactPhone =
    body.contactPhone?.trim() ||
    (body.contact && typeof body.contact === 'object'
      ? body.contact.phone?.trim()
      : undefined);
  const contactUrl =
    body.contactUrl?.trim() ||
    (body.contact && typeof body.contact === 'object'
      ? body.contact.url?.trim()
      : undefined);

  const payload = buildCreateEventUpstreamBody({
    slug,
    name,
    timezone: body.timezone,
    visibility: body.visibility?.trim(),
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    venueName,
    venueAddress,
    contactEmail,
    contactPhone,
    contactUrl,
    redemptionOpensAt: body.redemptionOpensAt,
    redemptionClosesAt: body.redemptionClosesAt,
    checkInOpensAt: body.checkInOpensAt,
    checkInClosesAt: body.checkInClosesAt,
    maxTicketsPerAttendee: body.maxTicketsPerAttendee,
  });

  return forwardWithBearer(createEventUpstreamPath(tenantId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

/** GET /api/bff/admin/events?tenantId= → GET /v1/tenants/{tenantId}/events */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('TENANT_REQUIRED', 'tenantId must be a UUID.', 422);
  }
  return forwardWithBearer(eventsListUpstreamPath(tenantId), {
    method: 'GET',
  });
}
