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
