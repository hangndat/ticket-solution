/** Map machine strip copy → mockup sticky «● Sẵn sàng» vs operational warning. */
export function scanStickyStatusFromMachineLabel(machineLabel: string): {
  ready: boolean;
  statusText: string;
} {
  if (machineLabel === 'Sẵn sàng quét') {
    return { ready: true, statusText: 'Sẵn sàng' };
  }
  return { ready: false, statusText: machineLabel };
}
