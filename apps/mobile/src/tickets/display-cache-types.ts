import type { TicketSummary } from '@ticket/contracts';

export type TicketDisplayCache = {
  userId: string;
  tenantId: string;
  syncedAt: string;
  tickets: TicketSummary[];
};
