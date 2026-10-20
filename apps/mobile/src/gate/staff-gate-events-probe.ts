import type { MeEventsResponse } from '@ticket/contracts';
import { scanCopy } from '../components/screen-state-copy.ts';
import type { MeEventsProbeResult } from '../identity/fetch-me-events.ts';

export type StaffGateEventsProbeOutcome =
  | { kind: 'eligible'; body: MeEventsResponse }
  | { kind: 'ineligible' }
  | { kind: 'probe-error'; message: string };

/**
 * Staff gate event discovery — only ineligible clears persisted workspace;
 * transient probe failures must not wipe saved scope/ops (#615).
 */
export function staffGateEventsFromProbe(
  result: MeEventsProbeResult,
): StaffGateEventsProbeOutcome {
  if (result.status === 'ok') {
    if (result.body.staffEligible !== true) {
      return { kind: 'ineligible' };
    }
    return { kind: 'eligible', body: result.body };
  }
  if (result.status === 'unauthorized') {
    return { kind: 'probe-error', message: scanCopy.eventPicker.sessionExpired };
  }
  if (result.status === 'unreachable') {
    return { kind: 'probe-error', message: scanCopy.eventPicker.error };
  }
  return { kind: 'probe-error', message: scanCopy.eventPicker.invalidResponse };
}
