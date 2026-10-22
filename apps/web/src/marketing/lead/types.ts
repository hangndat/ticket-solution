import type { InterestPayload, MarketingLeadLocale } from '../interest-schema';

export type LeadTier = 'A' | 'B' | 'C';

export type WebhookDeliveryState = {
  status: 'pending' | 'delivered';
  enqueued_at: string;
};

export type LeadRecord = {
  lead_id: string;
  at: string;
  locale: MarketingLeadLocale;
  payload: InterestPayload;
  score: number;
  tier: LeadTier;
  qualified: boolean;
  signals: string[];
  idempotency_key: string;
  source: 'marketing-interest';
  client_key?: string;
  /** Set when webhook URL is configured — durable hint for crash recovery retries. */
  webhook_delivery?: WebhookDeliveryState;
};

export type DeliveryResult = {
  adapter: string;
  ok: boolean;
  status?: number;
  error?: string;
  attempt: number;
};

export interface LeadSink {
  /** Durably store — failure → reject HTTP */
  persist(record: LeadRecord): Promise<{ path?: string }>;

  /** Optional fan-out — failures logged, retried (non-blocking for UX) */
  deliver(record: LeadRecord): Promise<DeliveryResult[]>;
}

export type AcceptLeadResult =
  | {
      ok: true;
      record: LeadRecord;
      duplicate: boolean;
      webhook_notified: boolean;
    }
  | { ok: false; code: 'STORE_FAILED' };
