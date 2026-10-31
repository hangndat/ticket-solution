import { expect, type Page, type TestInfo } from 'playwright/test';

/** Installed via addInitScript before the audit history stack is built. */
export function auth07BfcacheProbeInit(): void {
  const w = window as Window & {
    __auth07Restored?: boolean;
    __auth07Bfcache?: {
      forwardPageshowPersisted: boolean | null;
      lastPageshowPersisted: boolean | null;
    };
  };
  w.__auth07Restored = false;
  w.__auth07Bfcache = {
    forwardPageshowPersisted: null,
    lastPageshowPersisted: null,
  };
  window.addEventListener('pageshow', (event) => {
    const probe = w.__auth07Bfcache!;
    probe.lastPageshowPersisted = event.persisted;
    if (event.persisted) w.__auth07Restored = true;
  });
}

export type Auth07BfcacheEvidence = {
  restoredFlag: boolean;
  forwardPersisted: boolean | null;
  lastPageshowPersisted: boolean | null;
  notRestoredReasons: string[] | null;
  notRestoredReasonsAvailable: boolean;
  navigationType: string | null;
  transferSize: number | null;
};

export async function resetAuth07PageshowObservation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __auth07Bfcache?: { lastPageshowPersisted: boolean | null } };
    if (w.__auth07Bfcache) w.__auth07Bfcache.lastPageshowPersisted = null;
  });
}

export async function readForwardPageshowPersisted(page: Page): Promise<boolean | null> {
  return page.evaluate(() => {
    const w = window as Window & { __auth07Bfcache?: { lastPageshowPersisted: boolean | null } };
    return w.__auth07Bfcache?.lastPageshowPersisted ?? null;
  });
}

function sanitizeReason(reason: unknown): string | null {
  if (typeof reason !== 'string' || !reason.trim()) return null;
  const trimmed = reason.trim();
  if (trimmed.length > 64 || !/^[\w.-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function readAuth07BfcacheEvidence(
  page: Page,
  forwardPersistedFromProbe?: boolean,
): Promise<Auth07BfcacheEvidence> {
  let last: Auth07BfcacheEvidence | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    last = await page.evaluate((forwardFromProbe) => {
    const w = window as Window & {
      __auth07Restored?: boolean;
      __auth07Bfcache?: {
        forwardPageshowPersisted: boolean | null;
        lastPageshowPersisted: boolean | null;
      };
    };
    const nav = performance.getEntriesByType('navigation').at(-1) as
      | (PerformanceNavigationTiming & { notRestoredReasons?: Array<{ reason?: string }> })
      | undefined;
    const raw = nav?.notRestoredReasons;
    const reasons =
      Array.isArray(raw) && raw.length
        ? raw
            .map((entry) => {
              const reason = entry?.reason;
              if (typeof reason !== 'string' || !reason.trim()) return null;
              const trimmed = reason.trim();
              if (trimmed.length > 64 || !/^[\w.-]+$/.test(trimmed)) return null;
              return trimmed;
            })
            .filter((value): value is string => value !== null)
        : null;
    const transferSize = typeof nav?.transferSize === 'number' ? nav.transferSize : null;
    let forwardPersisted =
      forwardFromProbe ??
      w.__auth07Bfcache?.forwardPageshowPersisted ??
      w.__auth07Bfcache?.lastPageshowPersisted ??
      null;
    if (
      forwardPersisted === null &&
      nav?.type === 'back_forward' &&
      transferSize !== null
    ) {
      forwardPersisted = transferSize === 0;
    }
    return {
      restoredFlag: w.__auth07Restored === true,
      forwardPersisted,
      lastPageshowPersisted: w.__auth07Bfcache?.lastPageshowPersisted ?? null,
      notRestoredReasons: reasons,
      notRestoredReasonsAvailable: !!nav && 'notRestoredReasons' in nav,
      navigationType: nav?.type ?? null,
      transferSize,
    };
  }, forwardPersistedFromProbe);
    if (last.notRestoredReasonsAvailable || attempt === 7) return last;
    await page.waitForTimeout(50);
  }
  return last!;
}

export async function assertAuth07AuditTableNotActorA(
  page: Page,
  actorA: { actorId: string },
): Promise<void> {
  const table = page.getByTestId('audit-table');
  if ((await table.count()) === 0) return;
  await expect(table).not.toContainText(actorA.actorId);
}

export function annotateAuth07BfcacheEvidence(
  testInfo: TestInfo,
  evidence: Auth07BfcacheEvidence,
  context: {
    actorAEpoch: string;
    actorBEpoch: string;
    cookieStaffEpoch: string | undefined;
  },
  options?: { phase?: 'control' | 'post-switch' },
): void {
  const tag = options?.phase === 'control' ? 'control' : options?.phase === 'post-switch' ? 'switch' : 'default';
  const restored =
    evidence.forwardPersisted === true ||
    (evidence.forwardPersisted === null && evidence.restoredFlag);
  testInfo.annotations.push({
    type: tag === 'default' ? 'portal-bfcache' : `portal-bfcache-${tag}`,
    description: restored ? 'restored' : 'new-document',
  });
  testInfo.annotations.push({
    type: tag === 'default' ? 'portal-bfcache-persisted' : `portal-bfcache-${tag}-persisted`,
    description:
      evidence.forwardPersisted === null
        ? 'forward-unobserved'
        : evidence.forwardPersisted
          ? 'true'
          : 'false',
  });
  if (
    evidence.forwardPersisted === false &&
    evidence.navigationType === 'back_forward' &&
    evidence.transferSize !== null &&
    evidence.transferSize > 0
  ) {
    testInfo.annotations.push({
      type: 'portal-bfcache-eviction-hint',
      description: 'network-back-forward',
    });
  }
  if (evidence.notRestoredReasonsAvailable) {
    const label =
      evidence.notRestoredReasons && evidence.notRestoredReasons.length
        ? evidence.notRestoredReasons.join(',')
        : 'empty';
    testInfo.annotations.push({ type: 'portal-bfcache-not-restored', description: label });
  } else {
    testInfo.annotations.push({ type: 'portal-bfcache-not-restored', description: 'unavailable' });
  }
  if (evidence.navigationType) {
    testInfo.annotations.push({ type: 'portal-bfcache-nav-type', description: evidence.navigationType });
  }
  if (evidence.transferSize !== null) {
    testInfo.annotations.push({
      type: 'portal-bfcache-transfer-size',
      description: String(evidence.transferSize),
    });
  }
  testInfo.annotations.push({
    type: tag === 'default' ? 'portal-bfcache-epoch' : `portal-bfcache-${tag}-epoch`,
    description: `cookie=${context.cookieStaffEpoch ?? 'missing'} expected=${context.actorBEpoch} prior=${context.actorAEpoch}`,
  });
}

/** Node-side mirror of browser sanitization for unit checks. */
export function sanitizeBfcacheReasonForTests(reason: unknown): string | null {
  return sanitizeReason(reason);
}
