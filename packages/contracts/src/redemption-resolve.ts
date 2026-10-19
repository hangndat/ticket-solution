/**
 * Global single-code resolve (read-only) + resolve token for issue binding.
 */

import type { FormDefinition } from './redemption-forms';
import type { PublishedTerms } from './published-events';

export const REDEMPTION_RESOLVE_HEADER = 'x-redemption-resolve-token' as const;

export const REDEMPTION_FLOW = {
  GLOBAL: 'global',
  TENANT_BOUND: 'tenant_bound',
} as const;

export type RedemptionFlow =
  (typeof REDEMPTION_FLOW)[keyof typeof REDEMPTION_FLOW];

export const RESOLVE_ERROR_CODES = {
  RESOLVE_DISABLED: 'RESOLVE_DISABLED',
  RESOLVE_TOKEN_REQUIRED: 'RESOLVE_TOKEN_REQUIRED',
  RESOLVE_TOKEN_STALE: 'RESOLVE_TOKEN_STALE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ResolveErrorCode =
  (typeof RESOLVE_ERROR_CODES)[keyof typeof RESOLVE_ERROR_CODES];

export interface RedemptionResolveRequestBody {
  code: string;
}

export interface RedemptionResolvePublished {
  form: FormDefinition | null;
  terms: PublishedTerms | null;
  schemaVersion: number;
  publishedConfigVersion: number;
}

export interface RedemptionResolveResponse {
  tenantId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  tenantDisplayName: string;
  eventTitle: string;
  ticketTypeLabel: string;
  approvalMode: 'AUTO' | 'MANUAL';
  redemptionWindow: {
    opensAt: string | null;
    closesAt: string | null;
    open: boolean;
  };
  published: RedemptionResolvePublished;
  resolveToken: string;
  resolveExpiresAt: string;
  redemptionFlow: typeof REDEMPTION_FLOW.GLOBAL;
}

export const REDEMPTION_RESOLVE_ENDPOINT =
  'POST /redemptions/resolve' as const;
