/** Public transport contracts only. Do not import database models here. */
export const API_VERSION = 'v1' as const;
export interface HealthResponse {
  status: 'ok';
  service: 'api';
  version: string;
}
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  operationId?: string;
  retryable: boolean;
}

/** Authenticated caller identity after OIDC JWT verification (Keycloak). */
export interface MeResponse {
  userId: string;
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

/** Stable API error codes for identity (D1). */
export const IDENTITY_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  OIDC_MISCONFIGURED: 'OIDC_MISCONFIGURED',
} as const;

/** Stable API error codes for redemption / issue (D2). */
export const ISSUE_ERROR_CODES = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  CODE_INVALID: 'CODE_INVALID',
  CODE_CONSUMED: 'CODE_CONSUMED',
  CODE_DISABLED: 'CODE_DISABLED',
  EVENT_CLOSED: 'EVENT_CLOSED',
  REDEMPTION_WINDOW_CLOSED: 'REDEMPTION_WINDOW_CLOSED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  ATTENDEE_LIMIT: 'ATTENDEE_LIMIT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  RETRYABLE_CONFLICT: 'RETRYABLE_CONFLICT',
  CODE_HMAC_MISCONFIGURED: 'CODE_HMAC_MISCONFIGURED',
} as const;

export type IssueErrorCode =
  (typeof ISSUE_ERROR_CODES)[keyof typeof ISSUE_ERROR_CODES];

export interface RedeemRequestBody {
  code: string;
  formVersion?: string;
  termsVersion?: string;
}

export interface RedeemResponse {
  ticketId: string;
  requestId: string;
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: 'ACTIVE';
  credentialVersion: number;
  replayed: boolean;
}

export interface TicketSummary {
  ticketId: string;
  tenantId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: string;
  credentialVersion: number;
  createdAt: string;
}

export interface MeTicketsResponse {
  tickets: TicketSummary[];
}

export interface OperationStatusResponse {
  operationId: string;
  status: string;
  response: RedeemResponse | ApiError | null;
}

export interface PublicEvent {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  startsAt: string;
  timezone: string;
  location: string;
  brand: { primaryColor: string; organizationName: string };
}
