/**
 * Ownership mirror of packages/contracts C-N notification kinds / payload
 * versions (hangndat/d4-contracts-feature-freeze). Push data must stay
 * minimal — no QR / PII. Clients re-authz before routing.
 */

export const NOTIFICATION_KINDS = [
  'TicketIssued',
  'InvitationReady',
  'EventChanged',
  'EventCancelled',
  'EventReminder',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Allowlisted payloadVersion per kind — reject unknown versions. */
export const NOTIFICATION_PAYLOAD_VERSIONS = {
  TicketIssued: [1],
  InvitationReady: [1],
  EventChanged: [1],
  EventCancelled: [1],
  EventReminder: [1],
} as const satisfies Record<NotificationKind, readonly number[]>;

export const DEFAULT_NOTIFICATION_ACTION =
  'expo.modules.notifications.actions.DEFAULT';
