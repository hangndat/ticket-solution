import {
  REDEMPTION_COMMAND,
  type ApiError,
  type OperationStatusResponse,
  type RedeemResponse,
} from '@ticket/contracts';
import { decideRedeemBody, type RedeemDecision } from './decide';
import { fetchJson, type FetchJsonResult } from './fetch-json';

export const REQUEST_TIMEOUT_MS = 20_000;
export const POLL_INTERVAL_MS = 1_500;
export const POLL_MAX_MS = 30_000;
/** Cap consecutive network failures inside one poll window so busy cannot stick forever. */
export const POLL_MAX_CONSECUTIVE_NETWORK = 5;

export type PollOutcome = 'success' | 'error' | 'timeout' | 'cancelled';

export type PollOperationDeps = {
  fetchJsonImpl?: (
    input: RequestInfo,
    init: RequestInit,
    timeoutMs: number,
  ) => Promise<FetchJsonResult>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  isCancelled?: () => boolean;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  pollMaxMs?: number;
  maxConsecutiveNetwork?: number;
};

export type PollOperationHandlers = {
  onStart: () => void;
  onRaw: (json: unknown) => void;
  onTransient: (kind: 'timeout' | 'network') => void;
  onDecision: (decision: RedeemDecision) => void;
  /** Always invoked once when the poll loop ends (success/error/timeout/cancel). */
  onFinally: () => void;
};

function isRedeemResponse(value: unknown): value is RedeemResponse {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.ticketId === 'string' &&
    typeof o.requestId === 'string' &&
    o.state === 'ACTIVE'
  );
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return typeof o.code === 'string' && typeof o.message === 'string';
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Poll GET /api/bff/operations/{key} until terminal status, budget, or cancel.
 * Uses frozen REDEMPTION_COMMAND. Network/abort never leave the caller stuck.
 */
export async function pollOperation(
  key: string,
  tenantId: string,
  eventId: string,
  handlers: PollOperationHandlers,
  deps: PollOperationDeps = {},
): Promise<PollOutcome> {
  const fetchImpl = deps.fetchJsonImpl ?? fetchJson;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const requestTimeoutMs = deps.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const pollMaxMs = deps.pollMaxMs ?? POLL_MAX_MS;
  const maxNetwork = deps.maxConsecutiveNetwork ?? POLL_MAX_CONSECUTIVE_NETWORK;

  handlers.onStart();
  let outcome: PollOutcome = 'timeout';
  let consecutiveNetwork = 0;

  try {
    const started = now();
    while (now() - started < pollMaxMs) {
      if (deps.isCancelled?.()) {
        outcome = 'cancelled';
        return outcome;
      }

      const qs = new URLSearchParams({
        tenantId,
        eventId,
        command: REDEMPTION_COMMAND,
      });
      const result = await fetchImpl(
        `/api/bff/operations/${encodeURIComponent(key)}?${qs}`,
        { method: 'GET' },
        requestTimeoutMs,
      );

      if (deps.isCancelled?.()) {
        outcome = 'cancelled';
        return outcome;
      }

      if (result.networkError) {
        consecutiveNetwork += 1;
        handlers.onTransient('network');
        if (consecutiveNetwork >= maxNetwork) {
          outcome = 'timeout';
          return outcome;
        }
        await sleep(pollIntervalMs);
        continue;
      }

      consecutiveNetwork = 0;
      handlers.onRaw(result.json);

      if (result.timedOut) {
        handlers.onTransient('timeout');
        await sleep(pollIntervalMs);
        continue;
      }

      const op = result.json as OperationStatusResponse | ApiError;
      if (isApiError(op) && !('status' in (op as object))) {
        // The POST can still be committing when the first lookup runs.
        // A retryable NOT_FOUND does not settle the operation or its key.
        if (result.status === 404 && op.code === 'NOT_FOUND' && op.retryable) {
          await sleep(pollIntervalMs);
          continue;
        }
        handlers.onDecision(
          decideRedeemBody(result.status, op, key, false),
        );
        outcome = 'error';
        return outcome;
      }

      if (op && typeof op === 'object' && 'status' in op) {
        const status = (op as OperationStatusResponse).status;
        const response = (op as OperationStatusResponse).response;
        if (status === 'COMPLETED' && response) {
          const decision = decideRedeemBody(200, response, key, false);
          if (decision.kind === 'unknown') {
            // Keep polling when envelope is incomplete.
          } else {
            handlers.onDecision(decision);
            outcome =
              decision.kind === 'issued' || decision.kind === 'pending'
                ? 'success'
                : 'error';
            return outcome;
          }
        }
        if (status === 'FAILED' && response) {
          handlers.onDecision(decideRedeemBody(200, response, key, false));
          outcome = 'error';
          return outcome;
        }
      }

      await sleep(pollIntervalMs);
    }

    handlers.onTransient('timeout');
    outcome = 'timeout';
    return outcome;
  } finally {
    handlers.onFinally();
  }
}

export { isApiError, isRedeemResponse };
