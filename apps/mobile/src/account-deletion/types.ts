/**
 * Mirrors coordinator-frozen account-deletion contract (platform plan §6).
 * Shared packages/contracts may land later — keep shapes identical.
 */

export type AccountDeletionState =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'AWAITING_POLICY'
  | 'COMPLETED'
  | 'REJECTED';

export type AccountDeletionPolicyStatus = 'UNRESOLVED' | 'CONFIGURED';

export type AccountDeletionRequest = {
  requestId: string;
  state: AccountDeletionState;
  /** ISO timestamp */
  requestedAt: string;
  policyStatus: AccountDeletionPolicyStatus;
};

export type AccountDeletionRegisterBody = {
  confirmation: true;
};

export const ACCOUNT_DELETION_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  OIDC_MISCONFIGURED: 'OIDC_MISCONFIGURED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
} as const;
