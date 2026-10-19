/**
 * First-run checklist progress (local only — P2a style).
 * Keyed by userId + tenantId; never claim server ACTIVE from this store.
 */

export const ONBOARDING_PROGRESS_VERSION = 1 as const;

export type OnboardingProgress = {
  version: typeof ONBOARDING_PROGRESS_VERSION;
  /** Org profile / branding step confirmed */
  orgDone: boolean;
  /** Manager invite submitted (server may still be PENDING delivery) */
  inviteDone: boolean;
  /** Owner dismissed readiness → enter portal chrome */
  completed: boolean;
};

const EMPTY: OnboardingProgress = {
  version: ONBOARDING_PROGRESS_VERSION,
  orgDone: false,
  inviteDone: false,
  completed: false,
};

function storageKey(userId: string, tenantId: string): string {
  return `portal:onboarding:v${ONBOARDING_PROGRESS_VERSION}:${userId}:${tenantId}`;
}

export function defaultOnboardingProgress(): OnboardingProgress {
  return { ...EMPTY };
}

export function readOnboardingProgress(
  userId: string | null | undefined,
  tenantId: string,
): OnboardingProgress {
  if (typeof window === 'undefined' || !userId?.trim() || !tenantId.trim()) {
    return defaultOnboardingProgress();
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId, tenantId));
    if (!raw) return defaultOnboardingProgress();
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    if (parsed.version !== ONBOARDING_PROGRESS_VERSION) {
      return defaultOnboardingProgress();
    }
    return {
      version: ONBOARDING_PROGRESS_VERSION,
      orgDone: parsed.orgDone === true,
      inviteDone: parsed.inviteDone === true,
      completed: parsed.completed === true,
    };
  } catch {
    return defaultOnboardingProgress();
  }
}

export function writeOnboardingProgress(
  userId: string,
  tenantId: string,
  next: OnboardingProgress,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(userId, tenantId),
      JSON.stringify({
        version: ONBOARDING_PROGRESS_VERSION,
        orgDone: next.orgDone === true,
        inviteDone: next.inviteDone === true,
        completed: next.completed === true,
      } satisfies OnboardingProgress),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function patchOnboardingProgress(
  userId: string,
  tenantId: string,
  patch: Partial<Omit<OnboardingProgress, 'version'>>,
): OnboardingProgress {
  const current = readOnboardingProgress(userId, tenantId);
  const next: OnboardingProgress = {
    version: ONBOARDING_PROGRESS_VERSION,
    orgDone: patch.orgDone ?? current.orgDone,
    inviteDone: patch.inviteDone ?? current.inviteDone,
    completed: patch.completed ?? current.completed,
  };
  writeOnboardingProgress(userId, tenantId, next);
  return next;
}

/** Steps index 0..3 for AntD Steps (org → team → event → readiness). */
export function firstRunCurrentStep(input: {
  progress: OnboardingProgress;
  hasEvent: boolean;
}): number {
  if (!input.progress.orgDone) return 0;
  if (!input.progress.inviteDone) return 1;
  if (!input.hasEvent) return 2;
  if (!input.progress.completed) return 3;
  return 3;
}

export function shouldShowFirstRun(input: {
  tenantStatus: string;
  progress: OnboardingProgress;
  hasEvent: boolean;
}): boolean {
  if (input.tenantStatus !== 'ACTIVE') return false;
  if (input.progress.completed) return false;
  // Empty ACTIVE org or unfinished checklist → Progressive Steps
  return (
    !input.progress.orgDone ||
    !input.progress.inviteDone ||
    !input.hasEvent ||
    !input.progress.completed
  );
}
