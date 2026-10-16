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
