import type { StaffGateScope } from './staff-gate-events.ts';

type View = { gateScope: StaffGateScope | null; sessionId: string | null };

/** Recheck the captured operation identity after every async boundary. */
export function gateWorkspaceOperationGuard(input: {
  startedUserId: string | null;
  startedView: View;
  startedGeneration: number;
  writeGeneration: number;
  isEpochCurrent: () => boolean;
  currentUserId: () => string | null;
  currentView: () => View;
  currentGeneration: () => number;
  isWriteGenerationCurrent: () => boolean;
}): () => boolean {
  return () => {
    const current = input.currentView();
    const scope = input.startedView.gateScope;
    return !!input.startedUserId && !!scope && !!current.gateScope &&
      input.isEpochCurrent() &&
      input.currentUserId() === input.startedUserId &&
      input.currentGeneration() === input.startedGeneration &&
      input.isWriteGenerationCurrent() &&
      current.gateScope.tenantId === scope.tenantId &&
      current.gateScope.eventId === scope.eventId &&
      current.sessionId === input.startedView.sessionId;
  };
}
