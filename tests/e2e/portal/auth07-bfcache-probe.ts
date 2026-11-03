import {
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from 'playwright/test';

export type Auth07BfcacheEvent = {
  kind: 'pageshow' | 'pagehide';
  persisted: boolean;
  url: string;
};

const AUTH07_BFCACHE_EVENT_BINDING = '__auth07BfcacheEvent';

/** Installed via addInitScript before the audit history stack is built. */
export function auth07BfcacheProbeInit(): void {
  type ProbeWindow = Window & {
    __auth07Restored?: boolean;
    __auth07Bfcache?: {
      forwardPageshowPersisted: boolean | null;
      lastPageshowPersisted: boolean | null;
      lastPagehidePersisted: boolean | null;
    };
    __auth07BfcacheEvent?: (event: Auth07BfcacheEvent) => unknown;
  };
  const w = window as ProbeWindow;
  w.__auth07Restored = false;
  w.__auth07Bfcache = {
    forwardPageshowPersisted: null,
    lastPageshowPersisted: null,
    lastPagehidePersisted: null,
  };
  const record = (kind: 'pageshow' | 'pagehide', event: PageTransitionEvent) => {
    const probe = w.__auth07Bfcache!;
    if (kind === 'pageshow') {
      probe.lastPageshowPersisted = event.persisted;
      if (event.persisted) w.__auth07Restored = true;
    } else {
      probe.lastPagehidePersisted = event.persisted;
    }
    // Spec-installed binding; optional so the probe still works without it.
    // Inline literal: Playwright serializes this function without module scope.
    const report = w['__auth07BfcacheEvent'];
    if (typeof report === 'function') {
      void Promise.resolve(
        report({ kind, persisted: event.persisted, url: location.href }),
      ).catch(() => undefined);
    }
  };
  window.addEventListener('pageshow', (event) => record('pageshow', event));
  window.addEventListener('pagehide', (event) => record('pagehide', event));
}

export type Auth07BfcacheTimeline = {
  mark(): number;
  since(mark: number): Auth07BfcacheEvent[];
};

/** Records pageshow/pagehide from every probe document for post-run evidence. */
export async function installAuth07BfcacheTimeline(
  context: BrowserContext,
): Promise<Auth07BfcacheTimeline> {
  const events: Auth07BfcacheEvent[] = [];
  await context.exposeBinding(
    AUTH07_BFCACHE_EVENT_BINDING,
    (_source, event: Auth07BfcacheEvent) => {
      if (events.length < 200) events.push(event);
    },
  );
  return { mark: () => events.length, since: (mark) => events.slice(mark) };
}

export type Auth07NavigationObservation = {
  path: string;
  pageshowPersisted: boolean | null;
  pagehidePersisted: boolean | null;
};

export async function readAuth07NavigationObservation(
  page: Page,
): Promise<Auth07NavigationObservation> {
  return page.evaluate(() => {
    const w = window as Window & {
      __auth07Bfcache?: {
        lastPageshowPersisted: boolean | null;
        lastPagehidePersisted: boolean | null;
      };
    };
    return {
      path: `${location.pathname}${location.search}`,
      pageshowPersisted: w.__auth07Bfcache?.lastPageshowPersisted ?? null,
      pagehidePersisted: w.__auth07Bfcache?.lastPagehidePersisted ?? null,
    };
  });
}

type NotRestoredReasonsNode = {
  reason?: string;
  reasons?: Array<{ reason?: string }>;
  children?: NotRestoredReasonsNode[] | null;
};

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
    const w = window as Window & {
      __auth07Bfcache?: {
        lastPageshowPersisted: boolean | null;
        lastPagehidePersisted: boolean | null;
      };
    };
    if (w.__auth07Bfcache) {
      w.__auth07Bfcache.lastPageshowPersisted = null;
      w.__auth07Bfcache.lastPagehidePersisted = null;
    }
  });
}

export async function readForwardPageshowPersisted(page: Page): Promise<boolean | null> {
  return page.evaluate(() => {
    const w = window as Window & { __auth07Bfcache?: { lastPageshowPersisted: boolean | null } };
    return w.__auth07Bfcache?.lastPageshowPersisted ?? null;
  });
}

const persistedLabel = (value: boolean | null): string =>
  value === null ? 'unobserved' : value ? 'true' : 'false';

/** Evidence for each goBack/goForward hop, read before the next reset. */
export function annotateAuth07BfcacheDirection(
  testInfo: TestInfo,
  phase: 'control' | 'post-switch',
  direction: 'back' | 'forward',
  observation: Auth07NavigationObservation,
): void {
  testInfo.annotations.push({
    type: `auth07-${phase}-${direction}`,
    description: `${observation.path} pageshow=${persistedLabel(observation.pageshowPersisted)} pagehide=${persistedLabel(observation.pagehidePersisted)}`,
  });
}

export function annotateAuth07BfcacheTimeline(
  testInfo: TestInfo,
  events: Auth07BfcacheEvent[],
  phase: 'control' | 'post-switch',
): void {
  const description = events
    .slice(-16)
    .map((event) => `${event.kind}:${new URL(event.url).pathname}=${event.persisted}`)
    .join(' ');
  testInfo.annotations.push({
    type: `auth07-timeline-${phase}`,
    description: description || 'none',
  });
}

/** Durable GAP record when the same-actor control is not actually restored. */
export function annotateAuth07ControlGap(
  testInfo: TestInfo,
  context: {
    browserVersion: string;
    back: Auth07NavigationObservation;
    forward: Auth07NavigationObservation;
    notRestoredReasons: string[] | null;
  },
): void {
  testInfo.annotations.push({
    type: 'auth07-control-gap',
    description: [
      'control-persisted!=true',
      `back-pageshow=${persistedLabel(context.back.pageshowPersisted)}`,
      `forward-pageshow=${persistedLabel(context.forward.pageshowPersisted)}`,
      `reasons=${context.notRestoredReasons?.join(',') ?? 'none'}`,
      `chromium=${context.browserVersion}`,
      'channel=chromium-new-headless',
      'source=pageshow,pagehide,notRestoredReasons',
    ].join(' '),
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
      | (PerformanceNavigationTiming & {
          notRestoredReasons?: NotRestoredReasonsNode | NotRestoredReasonsNode[];
        })
      | undefined;
    const raw = nav?.notRestoredReasons;
    const collected: string[] = [];
    const pushReason = (value: unknown): void => {
      if (typeof value !== 'string' || !value.trim()) return;
      const trimmed = value.trim();
      if (trimmed.length <= 64 && /^[\w.-]+$/.test(trimmed)) collected.push(trimmed);
    };
    const collect = (
      node: NotRestoredReasonsNode | null | undefined,
      depth: number,
    ): void => {
      if (!node || depth > 4) return;
      pushReason(node.reason);
      for (const entry of node.reasons ?? []) pushReason(entry?.reason);
      for (const child of node.children ?? []) collect(child, depth + 1);
    };
    // Chrome exposes a tree (reasons/children); older shapes used an array.
    if (Array.isArray(raw)) {
      for (const entry of raw) collect(entry, 0);
    } else {
      collect(raw, 0);
    }
    const reasons = collected.length ? [...new Set(collected)].slice(0, 8) : null;
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
