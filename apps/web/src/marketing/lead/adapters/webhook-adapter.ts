import { readFile } from 'node:fs/promises';
import type { DeliveryResult, LeadRecord } from '../types';
import { resolveInterestPath } from './jsonl-adapter';

const WEBHOOK_DELAYS_MS = [0, 30_000, 300_000, 1_800_000, 7_200_000];
const WEBHOOK_FETCH_TIMEOUT_MS = 8_000;

export type WebhookFetch = typeof fetch;

const inFlightLeadIds = new Set<string>();
let resumeStarted = false;

function webhookUrlConfigured(): boolean {
  return Boolean(process.env.MARKETING_INTEREST_WEBHOOK_URL?.trim());
}

export async function postInterestWebhook(
  record: LeadRecord,
  attempt: number,
  fetchImpl: WebhookFetch = fetch,
): Promise<DeliveryResult> {
  const url = process.env.MARKETING_INTEREST_WEBHOOK_URL?.trim();
  if (!url) {
    return { adapter: 'webhook', ok: false, attempt, error: 'not_configured' };
  }

  const secret = process.env.MARKETING_INTEREST_WEBHOOK_SECRET?.trim();
  const body = {
    lead_id: record.lead_id,
    name: record.payload.name,
    email: record.payload.email,
    org: record.payload.org,
    role: record.payload.role,
    note: record.payload.note,
    org_kind: record.payload.org_kind,
    events_per_year: record.payload.events_per_year,
    typical_scale: record.payload.typical_scale,
    locale: record.locale,
    qualified: record.qualified,
    score: record.score,
    tier: record.tier,
    signals: record.signals,
    at: record.at,
  };

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-vemoki-interest-secret': secret } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(WEBHOOK_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        adapter: 'webhook',
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}`,
        attempt,
      };
    }
    return { adapter: 'webhook', ok: true, status: res.status, attempt };
  } catch (err) {
    return {
      adapter: 'webhook',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attempt,
    };
  }
}

export function scheduleWebhookRetries(
  record: LeadRecord,
  fetchImpl: WebhookFetch = fetch,
): void {
  const url = process.env.MARKETING_INTEREST_WEBHOOK_URL?.trim();
  if (!url) return;

  for (let i = 1; i < WEBHOOK_DELAYS_MS.length; i++) {
    const attempt = i + 1;
    const delay = WEBHOOK_DELAYS_MS[i]!;
    setTimeout(() => {
      void postInterestWebhook(record, attempt, fetchImpl).then((result) => {
        if (!result.ok) {
          console.warn(
            '[marketing-interest] webhook retry failed',
            attempt,
            result.error,
          );
        }
      });
    }, delay);
  }
}

async function runWebhookAttemptChain(
  record: LeadRecord,
  fetchImpl: WebhookFetch,
): Promise<void> {
  if (inFlightLeadIds.has(record.lead_id)) return;
  inFlightLeadIds.add(record.lead_id);
  try {
    const first = await postInterestWebhook(record, 1, fetchImpl);
    if (
      !first.ok &&
      first.error !== 'not_configured' &&
      process.env.MARKETING_INTEREST_DISABLE_RETRY_SCHEDULE !== '1'
    ) {
      scheduleWebhookRetries(record, fetchImpl);
    }
  } finally {
    inFlightLeadIds.delete(record.lead_id);
  }
}

async function resumePendingWebhookDeliveries(
  fetchImpl: WebhookFetch,
): Promise<void> {
  if (!webhookUrlConfigured()) return;
  if (process.env.MARKETING_INTEREST_DISABLE_RETRY_SCHEDULE === '1') return;

  const path = resolveInterestPath();
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return;
  }

  const seen = new Set<string>();
  for (const line of raw.trim().split('\n')) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as LeadRecord;
      if (parsed.webhook_delivery?.status !== 'pending') continue;
      if (seen.has(parsed.lead_id)) continue;
      seen.add(parsed.lead_id);
      void runWebhookAttemptChain(parsed, fetchImpl);
    } catch {
      /* skip corrupt line */
    }
  }
}

function ensurePendingResume(fetchImpl: WebhookFetch): void {
  if (resumeStarted) return;
  resumeStarted = true;
  void resumePendingWebhookDeliveries(fetchImpl);
}

/** Non-blocking — first attempt runs in the background; HTTP may return before webhook completes. */
export function enqueueWebhookDelivery(
  record: LeadRecord,
  fetchImpl: WebhookFetch = fetch,
): void {
  if (!webhookUrlConfigured()) return;
  ensurePendingResume(fetchImpl);
  void runWebhookAttemptChain(record, fetchImpl);
}

export async function deliverWebhook(
  record: LeadRecord,
  fetchImpl: WebhookFetch = fetch,
): Promise<DeliveryResult[]> {
  enqueueWebhookDelivery(record, fetchImpl);
  return [];
}
