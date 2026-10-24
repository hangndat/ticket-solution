import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren
} from 'react';
import { AppState } from 'react-native';
import { scanCopy } from '@/components/screen-state-copy';
import {
  canReconcile,
  gateOpFromQueued,
  reconcileOp,
  normalizeGatePasteInput,
  runScan,
  type GateOp
} from '@/gate/gate-scan';
import {
  gateStaffEvents,
  meEventToScope,
  sameStaffGateScope,
  type StaffGateScope
} from '@/gate/staff-gate-events';
import { buildDeviceScanHistory } from '@/gate/staff-gate-device-history';
import { canApplyOfflineReplay, reconcileOfflineScanOps } from '@/gate/offline-scan-reconciliation';
import {
  invalidateGateWorkspaceLifecycle,
  isGateWorkspaceLifecycleCurrent,
  loadWorkspaceWithLifecycleGuard,
  scheduleGateWorkspaceLifecycleWork,
} from '@/gate/gate-workspace-lifecycle';
import type { DeviceScanHistoryRow } from '@/gate/staff-gate-device-history';
import { buildMachineLabel } from '@/gate/staff-gate-ops-sticky';
import {
  presentGateScanStatus,
  stampGateOpsRecordedAt
} from '@/gate/gate-scan-status-ui';
import {
  SCAN_TOAST_FADE_MS,
  SCAN_TOAST_VISIBLE_MS,
  cameraFeedbackLifecycle,
  needsStickyPendingOp,
  prominentCanReconcile,
  selectScanFeedbackOp,
  shouldDismissToastAttempt,
  shouldSuppressCameraRescan
} from '@/gate/staff-gate-scan-feedback';
import { randomId } from '@/lib/random-id';
import { resolveGateScanFallback } from '@/gate/staff-gate-scope';
import {
  applyWorkspaceSelection,
  mergeMeEventsIntoWorkspace,
  opsForScope,
  persistActiveScope,
  scopeStorageKey,
  sliceWorkspaceForScope,
  emptyStaffGateWorkspace
} from '@/gate/staff-gate-workspace';
import {
  loadStaffGateWorkspace,
  saveStaffGateWorkspace
} from '@/gate/staff-gate-workspace-store';
import { staffGateEventsFromProbe } from '@/gate/staff-gate-events-probe';
import { probeMeEvents } from '@/identity/fetch-me-events';
import {
  probeConnectivity,
  type ConnectivityState,
  type OfflineQueueSnapshot
} from '@/gate/offline-queue';
import { offlineScanQueue } from '@/gate/offline-queue-session';
import { getApiBaseUrl, getTenantId } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
import { endKeycloakSession } from '@/identity/oidc-login';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';

/** SEC-CACHE: clear Nhân viên chrome immediately after MEMBERSHIP_* / 401/403. */
function clearStaffChromeAfterAuthzDenial() {
  staffEligibility.reset();
  if (session.getSnapshot().status === 'verified') {
    void staffEligibility.refresh(session);
  }
}

/**
 * Gate needs a verified bearer + baked API base. If cold-start left the
 * keychain token in "unreachable → signed-out", re-probe /v1/me before deny.
 */
async function resolveGateAuth(): Promise<
  | { ok: true; bearer: string; apiBase: string }
  | { ok: false; message: string }
> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return {
      ok: false,
      message:
        'Thiếu địa chỉ API (EXPO_PUBLIC_API_BASE_URL). Không cho vào.'
    };
  }

  let bearer = await session.getCredential();
  if (!bearer) {
    await session.restore(verifyViaMe);
    bearer = await session.getCredential();
  }
  if (!bearer) {
    return {
      ok: false,
      message: 'Chưa có phiên đăng nhập — đăng xuất và đăng nhập lại trước khi quét.'
    };
  }
  return { ok: true, bearer, apiBase };
}

export type StaffGateWorkspaceValue = {
  ready: boolean;
  busy: boolean;
  ops: GateOp[];
  sessionId: string | null;
  toastOp: GateOp | null;
  toastVisible: boolean;
  pendingOp: GateOp | null;
  connectivity: ConnectivityState;
  gateScope: StaffGateScope | null;
  gateEventChoices: StaffGateScope[];
  gateEventsLoading: boolean;
  gateEventsError: string | null;
  eventPickerOpen: boolean;
  setEventPickerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  queueSnap: OfflineQueueSnapshot;
  machineLabel: string;
  deviceHistory: DeviceScanHistoryRow[];
  scanDisabled: boolean;
  queueAttention: boolean;
  toastStatus: ReturnType<typeof presentGateScanStatus>;
  /** Outcome for manual entry: prefers sticky pendingOp after toast timer. */
  persistentScanStatus: ReturnType<typeof presentGateScanStatus>;
  selectGateScope: (scope: StaffGateScope) => void;
  submitScan: (payload: string) => Promise<void>;
  handleCameraScan: (data: string) => void;
  reconcile: () => Promise<void>;
  syncNow: () => Promise<void>;
  dismissPendingAction: () => void;
  refreshGateEvents: () => Promise<void>;
  logoutStaff: () => Promise<void>;
};

const StaffGateWorkspaceContext = createContext<StaffGateWorkspaceValue | null>(
  null,
);

export function useStaffGateWorkspace(): StaffGateWorkspaceValue {
  const ctx = useContext(StaffGateWorkspaceContext);
  if (!ctx) {
    throw new Error('useStaffGateWorkspace requires StaffGateWorkspaceProvider');
  }
  return ctx;
}

export function StaffGateWorkspaceProvider({
  active,
  children
}: PropsWithChildren<{ active: boolean }>) {
  const [ops, setOps] = useState<GateOp[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toastOp, setToastOp] = useState<GateOp | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [pendingOp, setPendingOp] = useState<GateOp | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityState>('unknown');
  const [gateScope, setGateScope] = useState<StaffGateScope | null>(null);
  const [gateEventChoices, setGateEventChoices] = useState<StaffGateScope[]>(
    [],
  );
  const [gateEventsLoading, setGateEventsLoading] = useState(false);
  const [gateEventsError, setGateEventsError] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const lock = useRef(false);
  const workspaceRef = useRef(emptyStaffGateWorkspace());
  const toastAttemptRef = useRef<string | null>(null);
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastCameraPayloadRef = useRef<string | null>(null);
  const viewRef = useRef({ gateScope, sessionId, ops });
  const feedbackGenerationRef = useRef(0);
  const foregroundLifecycleRef = useRef(0);
  const foregroundSyncChainRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceWriteRef = useRef<Promise<void>>(Promise.resolve());
  viewRef.current = { gateScope, sessionId, ops };

  const saveWorkspace = useCallback((userId: string) => {
    const workspace = workspaceRef.current;
    const write = workspaceWriteRef.current.catch(() => undefined).then(() =>
      saveStaffGateWorkspace(userId, workspace),
    );
    workspaceWriteRef.current = write;
    return write;
  }, []);

  const clearToastTimers = useCallback(() => {
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
      toastHideTimerRef.current = null;
    }
    if (toastCleanupTimerRef.current) {
      clearTimeout(toastCleanupTimerRef.current);
      toastCleanupTimerRef.current = null;
    }
  }, []);

  const clearScanFeedback = useCallback(() => {
    clearToastTimers();
    toastAttemptRef.current = null;
    setToastOp(null);
    setToastVisible(false);
    setPendingOp(null);
    lastCameraPayloadRef.current = null;
  }, [clearToastTimers]);

  const dismissPendingAction = useCallback(() => {
    setPendingOp(null);
    lastCameraPayloadRef.current = null;
  }, []);

  const applyScanResult = useCallback(
    (op: GateOp | null, attemptId: string) => {
      if (!op) {
        clearScanFeedback();
        return;
      }
      setToastOp(op);
      setToastVisible(true);
      toastAttemptRef.current = attemptId;
      clearToastTimers();
      setPendingOp(needsStickyPendingOp(op) ? op : null);

      toastHideTimerRef.current = setTimeout(() => {
        if (!shouldDismissToastAttempt(attemptId, toastAttemptRef.current)) {
          return;
        }
        setToastVisible(false);
        toastCleanupTimerRef.current = setTimeout(() => {
          if (toastAttemptRef.current !== attemptId) return;
          setToastOp(null);
          if (!needsStickyPendingOp(op)) {
            toastAttemptRef.current = null;
            lastCameraPayloadRef.current = null;
          }
        }, SCAN_TOAST_FADE_MS + 40);
      }, SCAN_TOAST_VISIBLE_MS);
    },
    [clearScanFeedback, clearToastTimers],
  );

  useEffect(() => {
    return () => {
      clearToastTimers();
    };
  }, [clearToastTimers]);

  const queueSnap = useSyncExternalStore(
    offlineScanQueue.subscribe,
    offlineScanQueue.getSnapshot,
    offlineScanQueue.getSnapshot,
  );

  const verifiedUserId = useSyncExternalStore(
    session.subscribe,
    () => {
      const snap = session.getSnapshot();
      return snap.status === 'verified' ? snap.userId : null;
    },
    () => null,
  );

  const persist = useCallback(
    async (
      next: GateOp[],
      active: GateOp | null,
      nextSessionId: string | null,
    ) => {
      const stamped = stampGateOpsRecordedAt(next, ops);
      viewRef.current = { gateScope, sessionId: nextSessionId, ops: stamped };
      setOps(stamped);
      setSessionId(nextSessionId);
      if (!verifiedUserId || !gateScope) return;
      workspaceRef.current = persistActiveScope(
        workspaceRef.current,
        gateScope,
        stamped,
        nextSessionId,
      );
      await saveWorkspace(verifiedUserId);
    },
    [verifiedUserId, gateScope, ops, saveWorkspace],
  );

  const replayAndReconcile = useCallback(async (bearer: string, apiBase: string, userId: string) => {
    const generation = feedbackGenerationRef.current;
    const startedView = viewRef.current;
    await offlineScanQueue.replay({ bearer, apiBase });
    const identity = session.getSnapshot();
    if (!canApplyOfflineReplay({
      replayUserId: userId,
      verifiedUserId: identity.status === 'verified' ? identity.userId : null,
      queueOwnerUserId: offlineScanQueue.ownerUserIdOrNull(),
      startedGeneration: generation,
      currentGeneration: feedbackGenerationRef.current,
      startedScope: startedView.gateScope,
      currentScope: viewRef.current.gateScope,
      startedSessionId: startedView.sessionId,
      currentSessionId: viewRef.current.sessionId,
    })) return;
    const { gateScope: scope, sessionId: activeSession, ops: currentOps } = viewRef.current;
    if (!scope || !activeSession) return;
    const nextOps = reconcileOfflineScanOps(currentOps, offlineScanQueue.getSnapshot().items);
    if (nextOps.every((op, index) => op === currentOps[index])) return;
    const key = scopeStorageKey(scope);
    if (workspaceRef.current.sessionsByScope[key] !== activeSession) return;
    viewRef.current = { gateScope: scope, sessionId: activeSession, ops: nextOps };
    workspaceRef.current = persistActiveScope(workspaceRef.current, scope, nextOps, activeSession);
    setOps(nextOps);
    setPendingOp((current) => {
      if (current) {
        if (current.staffSessionId !== activeSession) return current;
        return nextOps.find((op) => op.id === current.id && op.clientEventId === current.clientEventId) ?? current;
      }
      return nextOps.find((op, index) => op.staffSessionId === activeSession && op !== currentOps[index] && currentOps[index]?.phase === 'queued') ?? null;
    });
    await saveWorkspace(userId);
  }, [saveWorkspace]);

  const refreshConnectivityAndSync = useCallback(async () => {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      setConnectivity('unknown');
      return;
    }
    const state = await probeConnectivity(apiBase);
    setConnectivity(state);
    if (state !== 'online') return;
    const snap = session.getSnapshot();
    if (snap.status !== 'verified') return;
    await offlineScanQueue.bindUser(snap.userId);
    const bearer = await session.getCredential();
    if (!bearer) return;
    await replayAndReconcile(bearer, apiBase, snap.userId);
  }, [replayAndReconcile]);

  const refreshGateEvents = useCallback(async () => {
    const startedGeneration = feedbackGenerationRef.current;
    if (!verifiedUserId) {
      feedbackGenerationRef.current += 1;
      workspaceRef.current = emptyStaffGateWorkspace();
      viewRef.current = { gateScope: null, sessionId: null, ops: [] };
      setGateScope(null);
      setGateEventChoices([]);
      setGateEventsError(null);
      setGateEventsLoading(false);
      return;
    }
    setGateEventsLoading(true);
    setGateEventsError(null);
    const auth = await resolveGateAuth();
    if (!auth.ok) {
      setGateEventsLoading(false);
      setGateEventsError(auth.message);
      return;
    }
    const probe = await probeMeEvents(auth.bearer);
    const identity = session.getSnapshot();
    if (feedbackGenerationRef.current !== startedGeneration || identity.status !== 'verified' || identity.userId !== verifiedUserId) {
      setGateEventsLoading(false);
      return;
    }
    const outcome = staffGateEventsFromProbe(probe);
    if (outcome.kind === 'probe-error') {
      setGateEventsLoading(false);
      setGateEventsError(outcome.message);
      return;
    }
    if (outcome.kind === 'ineligible') {
      feedbackGenerationRef.current += 1;
      workspaceRef.current = { ...workspaceRef.current, selected: null };
      viewRef.current = { gateScope: null, sessionId: null, ops: [] };
      setGateScope(null);
      setGateEventChoices([]);
      setOps([]);
      setSessionId(null);
      clearScanFeedback();
      setGateEventsLoading(false);
      setGateEventsError(scanCopy.eventPicker.empty);
      await saveWorkspace(verifiedUserId);
      return;
    }
    const body = outcome.body;
    const choices = gateStaffEvents(body.items).map(meEventToScope);
    setGateEventChoices(choices);
    const merged = mergeMeEventsIntoWorkspace(
      workspaceRef.current,
      body.items,
      workspaceRef.current.selected,
    );
    workspaceRef.current = merged.workspace;
    if (merged.scope) {
      const currentView = viewRef.current;
      const slice = sliceWorkspaceForScope(merged.workspace, merged.scope);
      setGateScope(merged.scope);
      setOps(slice.ops);
      setSessionId(slice.sessionId);
      viewRef.current = { gateScope: merged.scope, sessionId: slice.sessionId, ops: slice.ops };
      if (!currentView.gateScope || !sameStaffGateScope(currentView.gateScope, merged.scope) || currentView.sessionId !== slice.sessionId) {
        feedbackGenerationRef.current += 1;
        clearScanFeedback();
      }
      setGateEventsError(null);
    } else {
      feedbackGenerationRef.current += 1;
      viewRef.current = { gateScope: null, sessionId: null, ops: [] };
      setGateScope(null);
      setOps([]);
      setSessionId(null);
      clearScanFeedback();
      setGateEventsError(scanCopy.eventPicker.empty);
    }
    setGateEventsLoading(false);
    await saveWorkspace(verifiedUserId);
  }, [verifiedUserId, clearScanFeedback, saveWorkspace]);

  const runForegroundSync = useCallback(() => {
    return scheduleGateWorkspaceLifecycleWork(
      foregroundLifecycleRef,
      foregroundSyncChainRef,
      async (lifecycleToken) => {
        if (!isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)) {
          return;
        }
        await refreshGateEvents();
        if (!isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)) {
          return;
        }
        await refreshConnectivityAndSync();
      },
    );
  }, [refreshConnectivityAndSync, refreshGateEvents]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setReady(false);
    feedbackGenerationRef.current += 1;
    invalidateGateWorkspaceLifecycle(foregroundLifecycleRef);
    void scheduleGateWorkspaceLifecycleWork(
      foregroundLifecycleRef,
      foregroundSyncChainRef,
      async (lifecycleToken) => {
        if (!isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)) {
          return;
        }
        if (!verifiedUserId) {
          feedbackGenerationRef.current += 1;
          workspaceRef.current = emptyStaffGateWorkspace();
          viewRef.current = { gateScope: null, sessionId: null, ops: [] };
          setOps([]);
          clearScanFeedback();
          setSessionId(null);
          offlineScanQueue.invalidateMemory();
          if (
            !cancelled &&
            isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
          ) {
            setReady(true);
          }
          return;
        }
        const loaded = await loadWorkspaceWithLifecycleGuard(
          foregroundLifecycleRef,
          lifecycleToken,
          () => loadStaffGateWorkspace(verifiedUserId),
        );
        if (
          !loaded ||
          cancelled ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        workspaceRef.current = loaded;
        await offlineScanQueue.bindUser(verifiedUserId);
        if (
          cancelled ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        await refreshGateEvents();
        if (
          cancelled ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        await refreshConnectivityAndSync();
        if (
          !cancelled &&
          isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          setReady(true);
        }
      },
    );
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void runForegroundSync();
      }
    });
    return () => {
      cancelled = true;
      feedbackGenerationRef.current += 1;
      invalidateGateWorkspaceLifecycle(foregroundLifecycleRef);
      sub.remove();
    };
  }, [
    active,
    runForegroundSync,
    verifiedUserId,
    clearScanFeedback,
  ]);

  const selectGateScope = useCallback(
    (next: StaffGateScope) => {
      if (!verifiedUserId) return;
      if (gateScope && sameStaffGateScope(gateScope, next)) {
        setEventPickerOpen(false);
        return;
      }
      const ws = applyWorkspaceSelection(
        workspaceRef.current,
        next,
        gateScope,
        ops,
        sessionId,
      );
      workspaceRef.current = ws;
      const slice = sliceWorkspaceForScope(ws, next);
      feedbackGenerationRef.current += 1;
      viewRef.current = { gateScope: next, sessionId: slice.sessionId, ops: slice.ops };
      setGateScope(next);
      setOps(slice.ops);
      setSessionId(slice.sessionId);
      clearScanFeedback();
      setEventPickerOpen(false);
      void saveWorkspace(verifiedUserId);
    },
    [gateScope, verifiedUserId, ops, sessionId, clearScanFeedback, saveWorkspace],
  );

  const submitScan = useCallback(async (payload: string) => {
    const code = payload.trim();
    if (!code || lock.current) return;
    const attemptId = randomId();
    feedbackGenerationRef.current += 1;
    toastAttemptRef.current = attemptId;
    clearToastTimers();
    setToastOp(null);
    setToastVisible(false);
    setPendingOp(null);
    lock.current = true;
    const auth = await resolveGateAuth();
    if (!auth.ok) {
      applyScanResult(
        {
          id: attemptId,
          ticketId: '',
          tenantId: '',
          eventId: '',
          staffSessionId: '',
          phase: 'denied',
          message: auth.message
        },
        attemptId,
      );
      lock.current = false;
      return;
    }
    const scanFallback = resolveGateScanFallback(gateScope);
    if (!scanFallback.tenantId || !scanFallback.eventId) {
      applyScanResult(
        {
          id: attemptId,
          ticketId: '',
          tenantId: '',
          eventId: '',
          staffSessionId: '',
          phase: 'denied',
          message: gateEventsError ?? scanCopy.eventPicker.empty
        },
        attemptId,
      );
      lock.current = false;
      return;
    }
    setBusy(true);
    try {
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        applyScanResult(
          {
            id: attemptId,
            ticketId: '',
            tenantId: '',
            eventId: '',
            staffSessionId: '',
            phase: 'denied',
            message:
              'Phiên staff chưa xác minh — đăng nhập lại trước khi quét. Không cho vào.'
          },
          attemptId,
        );
        return;
      }
      await offlineScanQueue.bindUser(snap.userId);
      const preferOffline = connectivity === 'offline';
      const result = await runScan({
        raw: code,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        ops: opsForScope(ops, gateScope),
        staffSessionId: sessionId,
        fallback: scanFallback,
        preferOfflineQueue: preferOffline
      });
      const nextSessionId = result.staffSessionId ?? sessionId;
      if (result.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }

      if (result.networkUnavailable && result.parsed && result.staffSessionId) {
        const queued = await offlineScanQueue.enqueue({
          ticketId: result.parsed.ticketId,
          tenantId: result.parsed.tenantId,
          eventId: result.parsed.eventId,
          staffSessionId: result.staffSessionId
        });
        setConnectivity('offline');
        const currentOp = gateOpFromQueued({
          id: queued.clientEventId,
          ticketId: queued.ticketId,
          tenantId: queued.tenantId,
          eventId: queued.eventId,
          staffSessionId: queued.staffSessionId,
          clientEventId: queued.clientEventId,
          message: queued.lastMessage
        });
        await persist(
          [currentOp, ...result.ops],
          currentOp,
          result.staffSessionId,
        );
        applyScanResult(currentOp, attemptId);
        return;
      }

      if (result.networkUnavailable) {
        setConnectivity('offline');
      } else if (preferOffline === false) {
        setConnectivity('online');
      }

      await persist(result.ops, result.current, nextSessionId);
      applyScanResult(result.current, attemptId);
      if (!result.networkUnavailable) {
        void replayAndReconcile(auth.bearer, auth.apiBase, snap.userId);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [
    applyScanResult,
    connectivity,
    gateEventsError,
    gateScope,
    ops,
    persist,
    replayAndReconcile,
    sessionId,
  ]);

  const handleCameraScan = useCallback((data: string) => {
    const code = normalizeGatePasteInput(data);
    if (!code || lock.current) return;
    const lifecycle = cameraFeedbackLifecycle(busy, toastVisible, pendingOp);
    if (
      shouldSuppressCameraRescan(
        code,
        lastCameraPayloadRef.current,
        lifecycle,
      )
    ) {
      return;
    }
    lastCameraPayloadRef.current = code;
    void submitScan(code);
  }, [busy, pendingOp, submitScan, toastVisible]);

  const reconcile = useCallback(async () => {
    const target = pendingOp;
    if (!target || !canReconcile(target)) return;
    const attemptId = randomId();
    toastAttemptRef.current = attemptId;
    clearToastTimers();
    setToastOp(null);
    setToastVisible(false);
    const auth = await resolveGateAuth();
    if (!auth.ok) return;
    setBusy(true);
    try {
      const reconciled = await reconcileOp({
        op: target,
        bearer: auth.bearer,
        apiBase: auth.apiBase
      });
      if (reconciled.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }
      const next = reconciled.op;
      const rest = ops.filter((op) => op.id !== target.id);
      await persist([next, ...rest], next, sessionId);
      applyScanResult(next, attemptId);
    } finally {
      setBusy(false);
    }
  }, [applyScanResult, clearToastTimers, ops, pendingOp, persist, sessionId]);

  const syncNow = useCallback(async () => {
    const auth = await resolveGateAuth();
    if (!auth.ok) return;
    const snap = session.getSnapshot();
    if (snap.status !== 'verified') return;
    setBusy(true);
    try {
      await offlineScanQueue.bindUser(snap.userId);
      setConnectivity(await probeConnectivity(auth.apiBase));
      await replayAndReconcile(auth.bearer, auth.apiBase, snap.userId);
    } finally {
      setBusy(false);
    }
  }, [replayAndReconcile]);

  const logoutStaff = useCallback(async () => {
    feedbackGenerationRef.current += 1;
    const snap = session.getSnapshot();
    const userId = snap.status === 'verified' ? snap.userId : null;
    await logoutAndClearWalletArtifacts({
      userId,
      tenantId: getTenantId()
    });
    await endKeycloakSession();
  }, []);

  const feedbackOp = busy ? null : selectScanFeedbackOp(pendingOp, toastOp);

  const toastStatus = presentGateScanStatus({
    busy,
    op: busy ? null : toastOp,
    canReconcile: prominentCanReconcile(pendingOp ?? toastOp)
  });

  const persistentScanStatus = presentGateScanStatus({
    busy,
    op: feedbackOp,
    canReconcile: prominentCanReconcile(pendingOp ?? toastOp)
  });

  const machineLabel = buildMachineLabel({
    busy,
    ready,
    gateEventsLoading,
    gateScope,
    pendingOp,
    queuePendingCount: queueSnap.pendingCount
  });

  const deviceHistory = useMemo(
    () => buildDeviceScanHistory(gateScope, ops, queueSnap.items),
    [gateScope, ops, queueSnap.items],
  );

  const scanDisabled =
    busy || !ready || !gateScope || gateEventsLoading;

  const queueAttention =
    queueSnap.pendingCount > 0 || queueSnap.conflictCount > 0;

  const value = useMemo(
    (): StaffGateWorkspaceValue => ({
      ready,
      busy,
      ops,
      sessionId,
      toastOp,
      toastVisible,
      pendingOp,
      connectivity,
      gateScope,
      gateEventChoices,
      gateEventsLoading,
      gateEventsError,
      eventPickerOpen,
      setEventPickerOpen,
      queueSnap,
      machineLabel,
      deviceHistory,
      scanDisabled,
      queueAttention,
      toastStatus,
      persistentScanStatus,
      selectGateScope,
      submitScan,
      handleCameraScan,
      reconcile,
      syncNow,
      dismissPendingAction,
      refreshGateEvents,
      logoutStaff
    }),
    [
      ready,
      busy,
      ops,
      sessionId,
      toastOp,
      toastVisible,
      pendingOp,
      connectivity,
      gateScope,
      gateEventChoices,
      gateEventsLoading,
      gateEventsError,
      eventPickerOpen,
      queueSnap,
      machineLabel,
      deviceHistory,
      scanDisabled,
      queueAttention,
      toastStatus,
      persistentScanStatus,
      selectGateScope,
      submitScan,
      handleCameraScan,
      reconcile,
      syncNow,
      dismissPendingAction,
      refreshGateEvents,
      logoutStaff,
    ],
  );

  return (
    <StaffGateWorkspaceContext.Provider value={active ? value : null}>
      {children}
    </StaffGateWorkspaceContext.Provider>
  );
}
