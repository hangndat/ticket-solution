/** Machine idle key from machineOperationalLabel — never rendered as copy. */
export const MACHINE_IDLE_LABEL = 'Sẵn sàng quét';

export type ScanStickyStatus = {
  /** green dot (ready) vs muted/other. */
  ready: boolean;
  /** muted = neutral «Chưa mở phiên»; warn = operational state from machine label. */
  tone: 'ready' | 'muted' | 'busy';
  statusText: string;
};

/**
 * Single-line status: one idle indicator for the whole screen.
 * No session → «Chưa mở phiên»; session + idle → «Sẵn sàng · <gate>»;
 * busy/denied/queued/etc keep the machine label unchanged.
 */
export function scanStickyStatus(input: {
  machineLabel: string;
  hasSession: boolean;
  gateName?: string | null;
}): ScanStickyStatus {
  if (input.machineLabel === MACHINE_IDLE_LABEL) {
    if (!input.hasSession) {
      return { ready: false, tone: 'muted', statusText: 'Chưa mở phiên' };
    }
    const gate = input.gateName?.trim();
    return {
      ready: true,
      tone: 'ready',
      statusText: gate ? `Sẵn sàng · ${gate}` : 'Sẵn sàng',
    };
  }
  return { ready: false, tone: 'busy', statusText: input.machineLabel };
}
