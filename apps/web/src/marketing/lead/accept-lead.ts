import { randomUUID } from 'node:crypto';
import type { InterestPayload, MarketingLeadLocale } from '../interest-schema';
import {
  buildIdempotencyKey,
  lookupIdempotency,
  rememberIdempotency,
} from './idempotency';
import { scoreQualifiedLead } from './score-qualified';
import { resolveInterestPath } from './adapters/jsonl-adapter';
import { createDefaultLeadSink } from './sink';
import { emitLeadAnalytics } from './server-analytics';
import type { AcceptLeadResult, LeadRecord, LeadSink } from './types';

export type AcceptLeadOptions = {
  clientKey?: string;
  locale?: MarketingLeadLocale;
  idempotencyHeader?: string;
  sink?: LeadSink;
  /** When DNT/GPC is set on the submitting request — lead is stored, analytics skipped. */
  skipAnalytics?: boolean;
};

async function recordFromPayload(
  payload: InterestPayload,
  opts: AcceptLeadOptions,
  idempotency_key: string,
): Promise<LeadRecord> {
  const scored = scoreQualifiedLead(payload);
  const locale =
    payload.locale ?? opts.locale ?? ('vi' as MarketingLeadLocale);
  return {
    lead_id: randomUUID(),
    at: new Date().toISOString(),
    locale,
    payload,
    score: scored.score,
    tier: scored.tier,
    qualified: scored.qualified,
    signals: scored.signals,
    idempotency_key,
    source: 'marketing-interest',
    ...(opts.clientKey ? { client_key: opts.clientKey } : {}),
  };
}

export async function acceptMarketingLead(
  payload: InterestPayload,
  opts: AcceptLeadOptions = {},
): Promise<AcceptLeadResult> {
  const idempotency_key = buildIdempotencyKey(payload.email, {
    headerKey: opts.idempotencyHeader,
    clientSubmitId: payload.client_submit_id,
  });

  const existing = await lookupIdempotency(idempotency_key);
  const sink = opts.sink ?? createDefaultLeadSink();

  if (existing) {
    const path = resolveInterestPath();
    const record = await loadLeadById(existing.lead_id, path);
    if (record) {
      return {
        ok: true,
        record,
        duplicate: true,
        webhook_notified: false,
      };
    }
  }

  const record = await recordFromPayload(payload, opts, idempotency_key);

  if (process.env.MARKETING_INTEREST_WEBHOOK_URL?.trim()) {
    record.webhook_delivery = {
      status: 'pending',
      enqueued_at: new Date().toISOString(),
    };
  }

  try {
    await sink.persist(record);
    await rememberIdempotency(idempotency_key, record.lead_id);
  } catch (err) {
    console.error('[marketing-interest] persist failed', err);
    return { ok: false, code: 'STORE_FAILED' };
  }

  try {
    void sink.deliver(record);
  } catch (err) {
    console.warn('[marketing-interest] deliver enqueue failed (submission persisted):', err);
  }

  emitLeadAnalytics(record, false, { skip: opts.skipAnalytics });

  return {
    ok: true,
    record,
    duplicate: false,
    webhook_notified: false,
  };
}

async function loadLeadById(
  lead_id: string,
  path: string,
): Promise<LeadRecord | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(path, 'utf8');
    for (const line of raw.trim().split('\n').reverse()) {
      if (!line) continue;
      const parsed = JSON.parse(line) as LeadRecord;
      if (parsed.lead_id === lead_id) return parsed;
    }
  } catch {
    /* missing file */
  }
  return null;
}
