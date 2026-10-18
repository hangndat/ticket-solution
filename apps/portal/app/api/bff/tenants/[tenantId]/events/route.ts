import {
  buildCreateEventUpstreamBody,
  isEventVisibility,
} from '../../../../../../src/prep/create-event-body';
import { assertMutatingBrowser } from '../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

type Body = {
  slug?: string;
  name?: string;
  timezone?: string;
  visibility?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string;
  venueAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
  idempotencyKey?: string;
};

/** GET /api/bff/tenants/{tenantId}/events?cursor=&limit= */
export async function GET(request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('TENANT_REQUIRED', 'tenantId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const qs = new URLSearchParams();
  const cursor = url.searchParams.get('cursor')?.trim();
  const limit = url.searchParams.get('limit')?.trim();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', limit);
  const suffix = qs.toString() ? `?${qs}` : '';
  return forwardStaffBearer(`${PORTAL_UPSTREAM.events(tenantId)}${suffix}`, {
    method: 'GET',
  });
}

/** POST create event — Idempotency-Key required. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('TENANT_REQUIRED', 'tenantId must be a UUID.', 422);
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
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
  const payload = buildCreateEventUpstreamBody({
    slug,
    name,
    timezone: body.timezone,
    visibility: body.visibility?.trim(),
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    venueName: body.venueName,
    venueAddress: body.venueAddress,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
    contactUrl: body.contactUrl,
    redemptionOpensAt: body.redemptionOpensAt,
    redemptionClosesAt: body.redemptionClosesAt,
    checkInOpensAt: body.checkInOpensAt,
    checkInClosesAt: body.checkInClosesAt,
    maxTicketsPerAttendee: body.maxTicketsPerAttendee,
  });
  return forwardStaffBearer(PORTAL_UPSTREAM.events(tenantId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
