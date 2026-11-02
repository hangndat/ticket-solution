import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import { gateWorkspaceOperationGuard } from '@/gate/gate-workspace-operation-guard';
import { canApplyOfflineReplay, rebaseOfflineReplayOps, reconcileOfflineScanOps } from '@/gate/offline-scan-reconciliation';
import { reconcileOpsWithHistoricalReceipts } from '@/gate/offline-sync-receipt';
import { OFFLINE_SYNC_ERROR_CODES } from '@/gate/offline-sync-contract';
import { openReplacementGateSession } from '@/gate/gate-session-renewal';
import {
  effectiveSelectedGate,
  fetchEventGates,
  gatesStateKey,
  resolveOpenSessionUi,
  type GatesLoadState,
  type OpenSessionUi,
  type StaffGate,
} from '@/gate/staff-gate-gates';
import {
  applyKnownOperationImportToOps,
  findScopedGateOpByClientEventId,
  importKnownOperationErrorMessage,
  importKnownOperationFromReceipt,
  parseKnownClientEventIdInput,
  type ImportKnownOperationOutcome,
} from '@/gate/gate-known-op-recovery';
import {
  findTerminalReplayFeedbackOp,
  resolvePendingOpAfterOfflineReplay,
} from '@/gate/staff-gate-replay-pending';
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
  shouldShowCameraToast,
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
  gateIdForSession,
  gateNameFromList,
  recordSessionGate,
  emptyStaffGateWorkspace
} from '@/gate/staff-gate-workspace';
import {
  allowStaffGateWorkspaceWrites,
  gateWorkspaceWriteGeneration,
  isGateWorkspaceWriteGenerationCurrent,
  loadStaffGateWorkspace,
  saveStaffGateWorkspace,
  subscribeStaffGateWorkspaceInvalidation
} from '@/gate/staff-gate-workspace-store';
import { projectStaffGateOwnedSnapshot } from '@/gate/staff-gate-owned-snapshot';
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
import type { SessionEpoch } from '@/identity/session-boundary';
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

/** O31: gate picker + explicit «Mở phiên cổng» state for the active event. */
export type StaffGateGatesValue = {
  status: 'loading' | 'ready' | 'error';
  gates: StaffGate[];
  selectedGateId: string | null;
  /** Gate of the open session; null when none or opened without a gate. */
  sessionGateName: string | null;
  openUi: OpenSessionUi;
  opening: boolean;
  openError: string | null;
  selectGate: (gateId: string) => void;
  openSession: () => Promise<void>;
  reloadGates: () => Promise<void>;
};

export type StaffGateWorkspaceValue = {
  gates: StaffGateGatesValue;
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
  workspaceLoadError?: boolean;
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
  submitScan: (payload: string, source?: 'qr' | 'manual') => Promise<void>;
  handleCameraScan: (data: string) => void;
  reconcile: () => Promise<void>;
  syncNow: () => Promise<void>;
  /** Staff tab focus: connectivity replay on the shared foreground lifecycle chain. */
  focusSync: () => Promise<void>;
  importKnownOperation: (
    rawClientEventId: string,
  ) => Promise<ImportKnownOperationOutcome>;
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
  const [workspaceLoadError, setWorkspaceLoadError] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [gatesLoad, setGatesLoad] = useState<GatesLoadState | null>(null);
  const [selectedGate, setSelectedGate] = useState<{ key: string; id: string } | null>(null);
  const [sessionGateState, setSessionGateState] = useState<{
    sessionId: string;
    gateId: string | null;
  } | null>(null);
  const [sessionOpening, setSessionOpening] = useState(false);
  const [sessionOpenError, setSessionOpenError] = useState<{ key: string; message: string } | null>(null);
  const lock = useRef(false);
  const lockOwnerRef = useRef<string | null>(null);
  const workspaceRef = useRef(emptyStaffGateWorkspace());
  const ownerRef = useRef<SessionEpoch | null>(null);
  const ownerWriteGenerationRef = useRef(0);
  const [owner, setOwner] = useState<SessionEpoch | null>(null);
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
  const recoveryAttemptedSessionsRef = useRef(new Set<string>());
  useLayoutEffect(() => {
    viewRef.current = { gateScope, sessionId, ops };
  }, [gateScope, sessionId, ops]);

  const saveWorkspace = useCallback((userId: string) => {
    const workspace = workspaceRef.current;
    const epoch = session.captureEpoch();
    const write = workspaceWriteRef.current.catch(() => undefined).then(() =>
      saveStaffGateWorkspace(userId, workspace, () => session.isEpochCurrent(epoch) && epoch?.userId === userId),
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

  useEffect(() => subscribeStaffGateWorkspaceInvalidation((userId) => {
    const identity = session.getSnapshot();
    if (identity.status !== 'verified' || identity.userId !== userId) return;
    feedbackGenerationRef.current += 1;
    invalidateGateWorkspaceLifecycle(foregroundLifecycleRef);
    workspaceRef.current = emptyStaffGateWorkspace();
    viewRef.current = { gateScope: null, sessionId: null, ops: [] };
    setOps([]);
    setSessionId(null);
    setGateScope(null);
    setReady(false);
    setBusy(false);
    lock.current = false;
    lockOwnerRef.current = null;
    clearScanFeedback();
  }), [clearScanFeedback]);

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
      toastAttemptRef.current = attemptId;
      clearToastTimers();
      setPendingOp(needsStickyPendingOp(op) ? op : null);

      if (shouldShowCameraToast(op, false)) {
        setToastOp(op);
        setToastVisible(true);
      } else {
        setToastOp(null);
        setToastVisible(false);
      }

      if (!shouldShowCameraToast(op, false)) {
        return;
      }

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

  const identitySnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const verifiedUserId = identitySnapshot.status === 'verified' ? identitySnapshot.userId : null;


  const gatesKey =
    verifiedUserId && gateScope ? gatesStateKey(verifiedUserId, gateScope) : null;
  const gatesForKey = gatesLoad && gatesLoad.key === gatesKey ? gatesLoad : null;
  const effectiveSelected = effectiveSelectedGate(
    gatesForKey?.gates ?? [],
    selectedGate && selectedGate.key === gatesKey ? selectedGate.id : null,
  );
  const sessionGate =
    sessionGateState && sessionGateState.sessionId === sessionId ? sessionGateState : null;

  const persist = useCallback(
    async (
      next: GateOp[],
      active: GateOp | null,
      nextSessionId: string | null,
      shouldApply: () => boolean = () => true,
    ) => {
      if (!shouldApply() || !session.isEpochCurrent(ownerRef.current)) return;
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

  const replayAndReconcile = useCallback(async (bearer: string, apiBase: string, userId: string, epoch: SessionEpoch | null) => {
    const generation = feedbackGenerationRef.current;
    const startedView = viewRef.current;
    const replayGuard = () => {
      const identity = session.getSnapshot();
      return session.isEpochCurrent(epoch) && epoch?.userId === userId && canApplyOfflineReplay({
        replayUserId: userId,
        verifiedUserId: identity.status === 'verified' ? identity.userId : null,
        queueOwnerUserId: offlineScanQueue.ownerUserIdOrNull(),
        startedGeneration: generation,
        currentGeneration: feedbackGenerationRef.current,
        startedScope: startedView.gateScope,
        currentScope: viewRef.current.gateScope,
        startedSessionId: startedView.sessionId,
        currentSessionId: viewRef.current.sessionId,
      });
    };
    if (!replayGuard()) return;
    const replayResult = await offlineScanQueue.replay({ bearer, apiBase, shouldContinue: replayGuard });
    const identity = session.getSnapshot();
    if (!session.isEpochCurrent(epoch)) return;
    if (
      replayResult.authzDenial &&
      identity.status === 'verified' &&
      identity.userId === userId &&
      offlineScanQueue.ownerUserIdOrNull() === userId
    ) {
      clearStaffChromeAfterAuthzDenial();
      return;
    }
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
    const queueItems = offlineScanQueue.getSnapshot().items;
    const orderRejected = replayResult.results.some((result) =>
      result.status === 'REJECTED' &&
      result.code === OFFLINE_SYNC_ERROR_CODES.REPLAY_ORDER_INVALID &&
      queueItems.some((row) => row.clientEventId === result.clientEventId && row.staffSessionId === activeSession && row.tenantId === scope.tenantId && row.eventId === scope.eventId),
    );
    let nextOps = reconcileOfflineScanOps(currentOps, queueItems);
    const receiptGuard = () => {
      const identity = session.getSnapshot();
      return session.isEpochCurrent(epoch) && canApplyOfflineReplay({
        replayUserId: userId,
        verifiedUserId:
          identity.status === 'verified' ? identity.userId : null,
        queueOwnerUserId: offlineScanQueue.ownerUserIdOrNull(),
        startedGeneration: generation,
        currentGeneration: feedbackGenerationRef.current,
        startedScope: startedView.gateScope,
        currentScope: viewRef.current.gateScope,
        startedSessionId: startedView.sessionId,
        currentSessionId: viewRef.current.sessionId,
      });
    };
    nextOps = await reconcileOpsWithHistoricalReceipts({
      ops: nextOps,
      queueItems,
      bearer,
      apiBase,
      shouldContinue: receiptGuard,
      onAuthzDenied: () => clearStaffChromeAfterAuthzDenial(),
    });
    if (!receiptGuard()) return;
    // Replay examined a snapshot. Import and new scans may have changed the
    // active list while a receipt was in flight, so apply only its changed IDs.
    const latestOps = viewRef.current.ops;
    const mergedOps = rebaseOfflineReplayOps(currentOps, nextOps, latestOps);
    const key = scopeStorageKey(scope);
    if (workspaceRef.current.sessionsByScope[key] !== activeSession) return;
    if (!receiptGuard()) return;
    if (!mergedOps.every((op, index) => op === latestOps[index])) {
      viewRef.current = { gateScope: scope, sessionId: activeSession, ops: mergedOps };
      workspaceRef.current = persistActiveScope(workspaceRef.current, scope, mergedOps, activeSession);
      setOps(mergedOps);
      setPendingOp((current) =>
        resolvePendingOpAfterOfflineReplay({
          currentPending: current,
          currentOps,
          nextOps: mergedOps,
          activeSession,
        }),
      );
      const replayFeedback = findTerminalReplayFeedbackOp(latestOps, mergedOps);
      if (replayFeedback) applyScanResult(replayFeedback, randomId());
      await saveWorkspace(userId);
    }
    if (!orderRejected || recoveryAttemptedSessionsRef.current.has(activeSession) || !receiptGuard()) return;
    recoveryAttemptedSessionsRef.current.add(activeSession);
    const priorGateId = gateIdForSession(workspaceRef.current, scope, activeSession);
    const renewal = await openReplacementGateSession({
      bearer, apiBase, tenantId: scope.tenantId, eventId: scope.eventId,
      gateId: priorGateId,
      shouldContinue: receiptGuard,
    });
    if (renewal.kind === 'auth') clearStaffChromeAfterAuthzDenial();
    if (renewal.kind === 'stale' || !receiptGuard()) return;
    // The old operation keeps its original session; only future scans use the
    // new server-issued session. A failed renewal requires online setup later.
    const nextSession = renewal.kind === 'ok' ? renewal.sessionId : null;
    feedbackGenerationRef.current += 1;
    const latestAtRenewal = viewRef.current.ops;
    viewRef.current = { gateScope: scope, sessionId: nextSession, ops: latestAtRenewal };
    if (renewal.kind === 'ok') {
      workspaceRef.current = recordSessionGate(workspaceRef.current, scope, renewal.sessionId, renewal.gateId);
      setSessionGateState({ sessionId: renewal.sessionId, gateId: renewal.gateId });
    }
    workspaceRef.current = persistActiveScope(workspaceRef.current, scope, latestAtRenewal, nextSession);
    setSessionId(nextSession);
    await saveWorkspace(userId);
  }, [applyScanResult, saveWorkspace]);

  const refreshConnectivityAndSync = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch) return;
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      setConnectivity('unknown');
      return;
    }
    const state = await probeConnectivity(apiBase);
    if (!session.isEpochCurrent(epoch)) return;
    setConnectivity(state);
    if (state !== 'online') return;
    await offlineScanQueue.bindUser(epoch.userId);
    if (!session.isEpochCurrent(epoch)) return;
    const bearer = await session.getCredential();
    if (!bearer || !session.isEpochCurrent(epoch)) return;
    await replayAndReconcile(bearer, apiBase, epoch.userId, epoch);
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
      setWorkspaceLoadError(false);
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
      setSessionGateState(slice.sessionId && slice.gateId ? { sessionId: slice.sessionId, gateId: slice.gateId } : null);
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

  const runFocusConnectivitySync = useCallback(() => {
    return scheduleGateWorkspaceLifecycleWork(
      foregroundLifecycleRef,
      foregroundSyncChainRef,
      async (lifecycleToken) => {
        if (!isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)) {
          return;
        }
        await refreshConnectivityAndSync();
      },
    );
  }, [refreshConnectivityAndSync]);

  useEffect(() => {
    const activationEpoch = session.captureEpoch();
    if (active && verifiedUserId && activationEpoch?.userId === verifiedUserId) {
      allowStaffGateWorkspaceWrites(verifiedUserId, activationEpoch.generation);
    }
    let cancelled = false;
    ownerRef.current = null;
    workspaceRef.current = emptyStaffGateWorkspace();
    viewRef.current = { gateScope: null, sessionId: null, ops: [] };
    lock.current = false;
    lockOwnerRef.current = null;
    queueMicrotask(() => {
      if (cancelled) return;
      clearScanFeedback();
      setOwner(null);
      setOps([]);
      setSessionId(null);
      setGateScope(null);
      setGateEventChoices([]);
      setGateEventsError(null);
      setWorkspaceLoadError(false);
      setGateEventsLoading(false);
      setEventPickerOpen(false);
      setConnectivity('unknown');
      setBusy(false);
      setReady(false);
    });
    feedbackGenerationRef.current += 1;
    invalidateGateWorkspaceLifecycle(foregroundLifecycleRef);
    if (!active) {
      // Unknown/unreachable hides the old in-memory snapshot. Its v2 key stays
      // intact so a later verified return to the same user can recover M10.
      offlineScanQueue.invalidateMemory();
      return () => { cancelled = true; };
    }
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
          setBusy(false);
          lock.current = false;
          lockOwnerRef.current = null;
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
        if (!activationEpoch || !session.isEpochCurrent(activationEpoch) || cancelled) return;
        let loaded;
        try {
          loaded = await loadWorkspaceWithLifecycleGuard(
            foregroundLifecycleRef,
            lifecycleToken,
            () => loadStaffGateWorkspace(verifiedUserId),
          );
        } catch {
          setGateEventsError('Không thể mở dữ liệu cổng trên thiết bị. Vui lòng thử lại.');
          setWorkspaceLoadError(true);
          return;
        }
        if (
          !loaded ||
          cancelled ||
          !session.isEpochCurrent(activationEpoch) ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        workspaceRef.current = loaded;
        setWorkspaceLoadError(false);
        await offlineScanQueue.bindUser(verifiedUserId);
        if (
          cancelled ||
          !session.isEpochCurrent(activationEpoch) ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        ownerRef.current = activationEpoch;
        ownerWriteGenerationRef.current = gateWorkspaceWriteGeneration(verifiedUserId);
        await refreshGateEvents();
        if (
          cancelled ||
          !session.isEpochCurrent(activationEpoch) ||
          !isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          return;
        }
        await refreshConnectivityAndSync();
        if (
          !cancelled &&
          session.isEpochCurrent(activationEpoch) &&
          isGateWorkspaceLifecycleCurrent(foregroundLifecycleRef, lifecycleToken)
        ) {
          setOwner(activationEpoch);
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
    identitySnapshot,
    runForegroundSync,
    verifiedUserId,
    clearScanFeedback,
  ]);

  const selectGateScope = useCallback(
    (next: StaffGateScope) => {
      const identity = session.getSnapshot();
      if (!verifiedUserId || identity.status !== 'verified' || identity.userId !== verifiedUserId ||
          !isGateWorkspaceWriteGenerationCurrent(verifiedUserId, gateWorkspaceWriteGeneration(verifiedUserId))) return;
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
      setSessionGateState(slice.sessionId && slice.gateId ? { sessionId: slice.sessionId, gateId: slice.gateId } : null);
      clearScanFeedback();
      setEventPickerOpen(false);
      void saveWorkspace(verifiedUserId);
    },
    [gateScope, verifiedUserId, ops, sessionId, clearScanFeedback, saveWorkspace],
  );

  const submitScan = useCallback(async (payload: string, source: 'qr' | 'manual' = 'qr') => {
    const replayEpoch = session.captureEpoch();
    const startedView = viewRef.current;
    const writeGeneration = gateWorkspaceWriteGeneration(replayEpoch?.userId ?? '');
    const code = payload.trim();
    if (!code || lock.current || !replayEpoch || replayEpoch.userId !== verifiedUserId) return;
    const attemptId = randomId();
    feedbackGenerationRef.current += 1;
    const startedGeneration = feedbackGenerationRef.current;
    const isCurrent = gateWorkspaceOperationGuard({
      startedUserId: replayEpoch.userId, startedView, startedGeneration, writeGeneration,
      isEpochCurrent: () => session.isEpochCurrent(replayEpoch),
      currentUserId: () => { const snap = session.getSnapshot(); return snap.status === 'verified' ? snap.userId : null; },
      currentView: () => viewRef.current,
      currentGeneration: () => feedbackGenerationRef.current,
      isWriteGenerationCurrent: () => isGateWorkspaceWriteGenerationCurrent(replayEpoch.userId, writeGeneration),
    });
    toastAttemptRef.current = attemptId;
    clearToastTimers();
    setToastOp(null);
    setToastVisible(false);
    setPendingOp(null);
    lock.current = true;
    lockOwnerRef.current = attemptId;
    const auth = await resolveGateAuth();
    if (!isCurrent()) {
      if (lockOwnerRef.current === attemptId) { lock.current = false; lockOwnerRef.current = null; }
      return;
    }
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
      lockOwnerRef.current = null;
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
      lockOwnerRef.current = null;
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
      if (!isCurrent()) return;
      const preferOffline = connectivity === 'offline';
      const result = await runScan({
        raw: source === 'qr' ? code : '',
        manualEntryCode: source === 'manual' ? code : undefined,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        ops: opsForScope(ops, gateScope),
        staffSessionId: sessionId,
        gateId: effectiveSelected?.id ?? null,
        fallback: scanFallback,
        preferOfflineQueue: preferOffline,
        shouldContinue: isCurrent,
      });
      if (!isCurrent()) return;
      const nextSessionId = result.staffSessionId ?? sessionId;
      if (result.openedSessionGate && result.staffSessionId) {
        setSessionGateState({
          sessionId: result.staffSessionId,
          gateId: result.openedSessionGate.gateId,
        });
        if (gateScope) {
          workspaceRef.current = recordSessionGate(
            workspaceRef.current,
            gateScope,
            result.staffSessionId,
            result.openedSessionGate.gateId,
          );
        }
      }
      if (result.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }

      if (result.networkUnavailable && result.offlineQueueEligible && result.parsed && result.staffSessionId) {
        const queued = await offlineScanQueue.enqueue({
          ticketId: result.parsed.ticketId,
          tenantId: result.parsed.tenantId,
          eventId: result.parsed.eventId,
          staffSessionId: result.staffSessionId
        });
        if (!isCurrent()) return;
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
          isCurrent,
        );
        if (session.isEpochCurrent(replayEpoch) && feedbackGenerationRef.current === startedGeneration) applyScanResult(currentOp, attemptId);
        return;
      }

      if (result.networkUnavailable) {
        setConnectivity('offline');
      } else if (preferOffline === false) {
        setConnectivity('online');
      }

      await persist(result.ops, result.current, nextSessionId, isCurrent);
      if (!session.isEpochCurrent(replayEpoch) || feedbackGenerationRef.current !== startedGeneration) return;
      applyScanResult(result.current, attemptId);
      if (!result.networkUnavailable) {
         void replayAndReconcile(auth.bearer, auth.apiBase, snap.userId, replayEpoch);
      }
    } finally {
      if (lockOwnerRef.current === attemptId) { lock.current = false; lockOwnerRef.current = null; }
      if (session.isEpochCurrent(replayEpoch)) setBusy(false);
    }
  }, [
    applyScanResult,
    connectivity,
    effectiveSelected,
    gateEventsError,
    gateScope,
    ops,
    persist,
    replayAndReconcile,
    sessionId,
    verifiedUserId,
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
    const epoch = session.captureEpoch();
    const startedView = viewRef.current;
    const writeGeneration = gateWorkspaceWriteGeneration(epoch?.userId ?? '');
    const startedGeneration = feedbackGenerationRef.current;
    const isCurrent = gateWorkspaceOperationGuard({
      startedUserId: epoch?.userId ?? null, startedView, startedGeneration, writeGeneration,
      isEpochCurrent: () => session.isEpochCurrent(epoch),
      currentUserId: () => { const snap = session.getSnapshot(); return snap.status === 'verified' ? snap.userId : null; },
      currentView: () => viewRef.current,
      currentGeneration: () => feedbackGenerationRef.current,
      isWriteGenerationCurrent: () => !!epoch && isGateWorkspaceWriteGenerationCurrent(epoch.userId, writeGeneration),
    });
    const target = pendingOp;
    if (!target || !canReconcile(target) || !isCurrent()) return;
    const attemptId = randomId();
    toastAttemptRef.current = attemptId;
    clearToastTimers();
    setToastOp(null);
    setToastVisible(false);
    const auth = await resolveGateAuth();
    if (!auth.ok || !isCurrent()) return;
    setBusy(true);
    try {
      const reconciled = await reconcileOp({
        op: target,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        shouldContinue: isCurrent,
      });
      if (!isCurrent()) return;
      if (reconciled.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }
      const next = reconciled.op;
      const rest = ops.filter((op) => op.id !== target.id);
      await persist([next, ...rest], next, sessionId, isCurrent);
      if (isCurrent()) applyScanResult(next, attemptId);
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }, [applyScanResult, clearToastTimers, ops, pendingOp, persist, sessionId, verifiedUserId]);

  const syncNow = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch) return;
    const auth = await resolveGateAuth();
    if (!auth.ok || !session.isEpochCurrent(epoch)) return;
    setBusy(true);
    try {
      await offlineScanQueue.bindUser(epoch.userId);
      if (!session.isEpochCurrent(epoch)) return;
      setConnectivity(await probeConnectivity(auth.apiBase));
      if (!session.isEpochCurrent(epoch)) return;
      await replayAndReconcile(auth.bearer, auth.apiBase, epoch.userId, epoch);
    } finally {
      setBusy(false);
    }
  }, [replayAndReconcile]);

  const importKnownOperation = useCallback(
    async (rawClientEventId: string): Promise<ImportKnownOperationOutcome> => {
      const epoch = session.captureEpoch();
      const startedGeneration = feedbackGenerationRef.current;
      const startedView = viewRef.current;
      const startedUserId = verifiedUserId;
      const scope = startedView.gateScope;
      const activeSession = startedView.sessionId;
      if (!startedUserId || !scope) {
        return {
          kind: 'error',
          code: 'no_scope',
          message: importKnownOperationErrorMessage('no_scope'),
        };
      }
      if (!activeSession) {
        return {
          kind: 'error',
          code: 'no_session',
          message: importKnownOperationErrorMessage('no_session'),
        };
      }
      const auth = await resolveGateAuth();
      if (!session.isEpochCurrent(epoch)) {
        return { kind: 'error', code: 'stale', message: importKnownOperationErrorMessage('stale') };
      }
      if (!auth.ok) {
        return {
          kind: 'error',
          code: 'auth',
          message: auth.message,
        };
      }
      const receiptGuard = () => {
        const identity = session.getSnapshot();
        return (
          session.isEpochCurrent(epoch) &&
          identity.status === 'verified' &&
          identity.userId === startedUserId &&
          feedbackGenerationRef.current === startedGeneration &&
          viewRef.current.gateScope?.tenantId === scope.tenantId &&
          viewRef.current.gateScope?.eventId === scope.eventId &&
          viewRef.current.sessionId === activeSession
        );
      };
      const parsedId = parseKnownClientEventIdInput(rawClientEventId);
      const existingBefore = parsedId
        ? findScopedGateOpByClientEventId(startedView.ops, scope, parsedId)
        : undefined;
      const outcome = await importKnownOperationFromReceipt(rawClientEventId, {
        scope,
        sessionId: activeSession,
        verifiedUserId: startedUserId,
        ops: startedView.ops,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        shouldContinue: receiptGuard,
        onAuthzDenied: () => clearStaffChromeAfterAuthzDenial(),
      });
      if (outcome.kind === 'error') return outcome;
      if (!receiptGuard()) {
        return {
          kind: 'error',
          code: 'stale',
          message: 'Phiên hoặc sự kiện đã đổi trong lúc đối soát — thử lại.',
        };
      }
      const recorded = outcome.op;
      const existing =
        existingBefore ??
        findScopedGateOpByClientEventId(
          viewRef.current.ops,
          scope,
          recorded.clientEventId ?? parsedId ?? '',
        );
      if (outcome.kind === 'noop') {
        return outcome;
      }
      const nextOps = applyKnownOperationImportToOps(
        viewRef.current.ops,
        existing,
        recorded,
      );
      await persist(nextOps, null, activeSession, receiptGuard);
      return outcome;
    },
    [persist, verifiedUserId],
  );

  const focusSync = useCallback(() => {
    return runFocusConnectivitySync();
  }, [runFocusConnectivitySync]);

  const logoutStaff = useCallback(async () => {
    feedbackGenerationRef.current += 1;
    clearScanFeedback();
    const snap = session.getSnapshot();
    const userId = snap.status === 'verified' ? snap.userId : null;
    await logoutAndClearWalletArtifacts({
      userId,
      tenantId: getTenantId()
    });
    await endKeycloakSession();
  }, [clearScanFeedback]);

  const loadGates = useCallback(async (key: string, scope: StaffGateScope) => {
    const stillCurrent = () => {
      const snap = session.getSnapshot();
      const view = viewRef.current.gateScope;
      return snap.status === 'verified' && view !== null && gatesStateKey(snap.userId, view) === key;
    };
    const auth = await resolveGateAuth();
    if (!stillCurrent()) return;
    if (!auth.ok) {
      setGatesLoad({ key, status: 'error', gates: [] });
      return;
    }
    const result = await fetchEventGates({
      bearer: auth.bearer,
      apiBase: auth.apiBase,
      tenantId: scope.tenantId,
      eventId: scope.eventId,
    });
    if (!stillCurrent()) return;
    if (result.kind === 'auth') clearStaffChromeAfterAuthzDenial();
    setGatesLoad(
      result.kind === 'ok'
        ? { key, status: 'ready', gates: result.gates }
        : { key, status: 'error', gates: [] },
    );
  }, []);

  useEffect(() => {
    if (!active || !ready || !gatesKey || !gateScope) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadGates(gatesKey, gateScope);
    });
    return () => {
      cancelled = true;
    };
  }, [active, ready, gatesKey, gateScope, loadGates]);

  const reloadGates = useCallback(async () => {
    if (!gatesKey || !gateScope) return;
    setGatesLoad({ key: gatesKey, status: 'loading', gates: [] });
    await loadGates(gatesKey, gateScope);
  }, [gatesKey, gateScope, loadGates]);

  const selectGate = useCallback(
    (gateId: string) => {
      if (gatesKey) setSelectedGate({ key: gatesKey, id: gateId });
    },
    [gatesKey],
  );

  const openUi = resolveOpenSessionUi({
    hasScope: Boolean(gateScope && ready),
    hasSession: Boolean(sessionId),
    gates: gatesForKey,
    selected: effectiveSelected,
    opening: sessionOpening,
  });

  const openSession = useCallback(async () => {
    const epoch = session.captureEpoch();
    const startedView = viewRef.current;
    const scope = startedView.gateScope;
    if (!epoch || epoch.userId !== verifiedUserId || !scope || startedView.sessionId || lock.current) return;
    if ((gatesForKey?.gates.length ?? 0) > 0 && !effectiveSelected) return;
    const key = gatesKey ?? '';
    const writeGeneration = gateWorkspaceWriteGeneration(epoch.userId);
    const startedGeneration = feedbackGenerationRef.current;
    const isCurrent = gateWorkspaceOperationGuard({
      startedUserId: epoch.userId, startedView, startedGeneration, writeGeneration,
      isEpochCurrent: () => session.isEpochCurrent(epoch),
      currentUserId: () => { const snap = session.getSnapshot(); return snap.status === 'verified' ? snap.userId : null; },
      currentView: () => viewRef.current,
      currentGeneration: () => feedbackGenerationRef.current,
      isWriteGenerationCurrent: () => isGateWorkspaceWriteGenerationCurrent(epoch.userId, writeGeneration),
    });
    const attemptId = randomId();
    lock.current = true;
    lockOwnerRef.current = attemptId;
    setSessionOpening(true);
    setSessionOpenError(null);
    try {
      const auth = await resolveGateAuth();
      if (!isCurrent()) return;
      if (!auth.ok) {
        setSessionOpenError({ key, message: auth.message });
        return;
      }
      const opened = await openReplacementGateSession({
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        tenantId: scope.tenantId,
        eventId: scope.eventId,
        gateId: effectiveSelected?.id ?? null,
        shouldContinue: isCurrent,
      });
      if (opened.kind === 'stale') return;
      if (opened.kind === 'auth') {
        clearStaffChromeAfterAuthzDenial();
        setSessionOpenError({ key, message: 'Không đủ quyền mở phiên cổng cho sự kiện này.' });
        return;
      }
      if (opened.kind === 'error') {
        setSessionOpenError({ key, message: 'Không mở được phiên cổng. Kiểm tra mạng rồi thử lại.' });
        if (gatesKey) void loadGates(gatesKey, scope);
        return;
      }
      setSessionGateState({ sessionId: opened.sessionId, gateId: opened.gateId });
      workspaceRef.current = recordSessionGate(workspaceRef.current, scope, opened.sessionId, opened.gateId);
      setConnectivity('online');
      await persist(viewRef.current.ops, null, opened.sessionId, isCurrent);
    } finally {
      if (lockOwnerRef.current === attemptId) { lock.current = false; lockOwnerRef.current = null; }
      if (session.isEpochCurrent(epoch)) setSessionOpening(false);
    }
  }, [effectiveSelected, gatesForKey, gatesKey, loadGates, persist, verifiedUserId]);

  const gatesValue = useMemo(
    (): StaffGateGatesValue => ({
      status: gatesForKey?.status ?? 'loading',
      gates: gatesForKey?.gates ?? [],
      selectedGateId: effectiveSelected?.id ?? null,
      sessionGateName: gateNameFromList(gatesForKey?.gates ?? [], sessionGate?.gateId ?? null),
      openUi,
      opening: sessionOpening,
      openError: sessionOpenError && sessionOpenError.key === gatesKey ? sessionOpenError.message : null,
      selectGate,
      openSession,
      reloadGates,
    }),
    [gatesForKey, effectiveSelected, sessionGate, openUi, sessionOpening, sessionOpenError, gatesKey, selectGate, openSession, reloadGates],
  );

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
      gates: gatesValue,
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
      workspaceLoadError,
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
      focusSync,
      importKnownOperation,
      dismissPendingAction,
      refreshGateEvents,
      logoutStaff
    }),
    [
      gatesValue,
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
      workspaceLoadError,
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
      focusSync,
      importKnownOperation,
      dismissPendingAction,
      refreshGateEvents,
      logoutStaff,
    ],
  );

  const currentEpoch = session.captureEpoch();
  // The owner guard must run before the effect that clears prior-user state.
  // eslint-disable-next-line react-hooks/refs
  const ownedValue = projectStaffGateOwnedSnapshot(value, owner, currentEpoch, () =>
    active &&
    ownerRef.current === owner &&
    session.isEpochCurrent(owner) &&
    !!owner &&
    offlineScanQueue.ownerUserIdOrNull() === owner.userId &&
    isGateWorkspaceWriteGenerationCurrent(owner.userId, ownerWriteGenerationRef.current),
  );

  return (
    <StaffGateWorkspaceContext.Provider value={active ? ownedValue : null}>
      {children}
    </StaffGateWorkspaceContext.Provider>
  );
}
