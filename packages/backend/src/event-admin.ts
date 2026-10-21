/**
 * Barrel re-export — public API unchanged for `index.ts` consumers.
 */
export {
  createEvent,
  getEvent,
  listEvents,
  updateEvent,
  cloneEvent,
  archiveEvent,
  cancelEvent,
  previewEventImpact,
  CREATOR_EVENT_PERMISSIONS,
  type EventMutationResult,
  type EventSummary,
} from './event-lifecycle';
export type { ArchiveEventBody } from '@ticket/contracts';
export { deterministicEventId } from './event-row';
export {
  createTicketType,
  createIssuanceSource,
  listTicketTypes,
  listIssuanceSources,
} from './event-catalog';
