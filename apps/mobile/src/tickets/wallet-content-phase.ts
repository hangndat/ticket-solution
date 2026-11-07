/** Empty means the server confirmed an empty owner list, never an unproven fetch. */
export function walletContentPhase(input: {
  ticketCount: number;
  busy: boolean;
  error: string | null;
  onlineLoaded: boolean;
  offline: boolean;
}): 'tickets' | 'loading' | 'error' | 'empty-online' | 'empty-offline' | 'idle' {
  if (input.ticketCount > 0) return 'tickets';
  if (input.error) return 'error';
  if (input.busy) return 'loading';
  if (input.offline) return 'empty-offline';
  if (input.onlineLoaded) return 'empty-online';
  return 'idle';
}
