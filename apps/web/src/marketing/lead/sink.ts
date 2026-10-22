import { appendLeadJsonl } from './adapters/jsonl-adapter';
import { deliverWebhook, type WebhookFetch } from './adapters/webhook-adapter';
import type { LeadSink } from './types';

export function createDefaultLeadSink(
  fetchImpl: WebhookFetch = fetch,
): LeadSink {
  return {
    async persist(record) {
      return appendLeadJsonl(record);
    },
    async deliver(record) {
      return deliverWebhook(record, fetchImpl);
    },
  };
}
