/**
 * Stable operation command strings (canonical request hash + operations unique key).
 * Consumers MUST use these literals — do not invent aliases per client.
 */

/** Redeem / claim issuance command — single source for web, iOS, and API. */
export const REDEMPTION_COMMAND = 'redemption.redeem' as const;

/**
 * Backend historically exported `REDEEM_COMMAND` with the same value.
 * Prefer {@link REDEMPTION_COMMAND}; this alias stays for reconciliation.
 */
export const REDEEM_COMMAND = REDEMPTION_COMMAND;

export const REDEMPTION_APPROVE_COMMAND = 'redemption.approve' as const;
export const REDEMPTION_DENY_COMMAND = 'redemption.deny' as const;

export const EVENT_CREATE_COMMAND = 'event.create' as const;
export const EVENT_UPDATE_COMMAND = 'event.update' as const;
export const EVENT_CLONE_COMMAND = 'event.clone' as const;
export const EVENT_ARCHIVE_COMMAND = 'event.archive' as const;
export const EVENT_CANCEL_COMMAND = 'event.cancel' as const;

export const CONFIG_SAVE_COMMAND = 'event.config.save' as const;
export const CONFIG_PUBLISH_COMMAND = 'event.config.publish' as const;
export const CONFIG_ROLLBACK_COMMAND = 'event.config.rollback' as const;

export const IMPORT_CREATE_COMMAND = 'import.create' as const;
export const IMPORT_PREVIEW_COMMAND = 'import.preview' as const;
export const IMPORT_COMMIT_COMMAND = 'import.commit' as const;

export const INVITATION_DISPATCH_COMMAND = 'invitation.dispatch' as const;
export const INVITATION_CLAIM_COMMAND = 'invitation.claim' as const;

export const NOTIFICATION_TEMPLATE_PUBLISH_COMMAND =
  'notification.template.publish' as const;
export const NOTIFICATION_REMINDER_CREATE_COMMAND =
  'notification.reminder.create' as const;
export const NOTIFICATION_REMINDER_CANCEL_COMMAND =
  'notification.reminder.cancel' as const;
export const NOTIFICATION_RETRY_COMMAND = 'notification.retry' as const;

/** D7 offline Gate sync batch (see packages/contracts/src/offline-sync.ts). */
export const OFFLINE_SYNC_COMMAND = 'gate.offline_sync' as const;

export type OperationCommand =
  | typeof REDEMPTION_COMMAND
  | typeof REDEMPTION_APPROVE_COMMAND
  | typeof REDEMPTION_DENY_COMMAND
  | typeof EVENT_CREATE_COMMAND
  | typeof EVENT_UPDATE_COMMAND
  | typeof EVENT_CLONE_COMMAND
  | typeof EVENT_ARCHIVE_COMMAND
  | typeof EVENT_CANCEL_COMMAND
  | typeof CONFIG_SAVE_COMMAND
  | typeof CONFIG_PUBLISH_COMMAND
  | typeof CONFIG_ROLLBACK_COMMAND
  | typeof IMPORT_CREATE_COMMAND
  | typeof IMPORT_PREVIEW_COMMAND
  | typeof IMPORT_COMMIT_COMMAND
  | typeof INVITATION_DISPATCH_COMMAND
  | typeof INVITATION_CLAIM_COMMAND
  | typeof NOTIFICATION_TEMPLATE_PUBLISH_COMMAND
  | typeof NOTIFICATION_REMINDER_CREATE_COMMAND
  | typeof NOTIFICATION_REMINDER_CANCEL_COMMAND
  | typeof NOTIFICATION_RETRY_COMMAND
  | typeof OFFLINE_SYNC_COMMAND;
