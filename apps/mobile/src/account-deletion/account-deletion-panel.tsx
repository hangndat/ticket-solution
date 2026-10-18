import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Notice } from '@/components/page';
import { colors } from '@/theme/colors';
import { session } from '@/identity/session';
import {
  accountDeletionConfirmCopy,
  accountDeletionExplainer,
  describeAccountDeletionRequest,
} from './account-deletion-copy';
import {
  clearAllPendingIdempotencyKeys,
  loadCurrentAccountDeletionRequest,
  peekPendingIdempotencyKey,
  resolveAccountDeletionRetryAction,
  retryAccountDeletionError,
  submitAccountDeletionRequest,
  type AccountDeletionUiPhase,
} from './account-deletion-flow';

function SecondaryButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: danger ? '#c0392b' : colors.secondary,
        backgroundColor: pressed ? colors.card : 'transparent',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text
        style={{
          color: danger ? '#c0392b' : colors.label,
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Account deletion request UX (plan §7 / acceptance §8.9).
 * Recording a request is not instant erase; session-scoped cancel on account switch.
 */
export function AccountDeletionPanel() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [phase, setPhase] = useState<AccountDeletionUiPhase>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;

  const refreshStatus = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch) {
      setPhase({ kind: 'idle' });
      return;
    }
    setBusy(true);
    try {
      const next = await loadCurrentAccountDeletionRequest({ session, epoch });
      if (!session.isEpochCurrent(epoch)) return;
      setPhase(next);
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }, []);

  // Load current request after verified mount (panel remounts per userId).
  useEffect(() => {
    if (!verifiedUserId) return;
    let cancelled = false;
    void (async () => {
      const epoch = session.captureEpoch();
      if (!epoch) return;
      const next = await loadCurrentAccountDeletionRequest({ session, epoch });
      if (cancelled || !session.isEpochCurrent(epoch)) return;
      setPhase(next);
    })();
    return () => {
      cancelled = true;
      clearAllPendingIdempotencyKeys();
    };
  }, [verifiedUserId]);

  const onStart = useCallback(() => {
    setPhase({ kind: 'confirming' });
  }, []);

  const onCancelConfirm = useCallback(() => {
    setPhase({ kind: 'idle' });
  }, []);

  const onConfirmSubmit = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch || identity.status !== 'verified') {
      setPhase({
        kind: 'error',
        message: 'Cần đăng nhập đã xác minh để gửi yêu cầu.',
        retryable: false,
      });
      return;
    }
    const pending = peekPendingIdempotencyKey(epoch.userId);
    setBusy(true);
    setPhase({ kind: 'loading' });
    try {
      const next = await submitAccountDeletionRequest({
        session,
        epoch,
        userId: epoch.userId,
        idempotencyKey: pending,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setPhase(next);
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }, [identity.status]);

  const onRetry = useCallback(async () => {
    if (phase.kind !== 'error' || !phase.retryable) return;
    const epoch = session.captureEpoch();
    if (!epoch) return;
    setBusy(true);
    setPhase({ kind: 'loading' });
    try {
      const next = await retryAccountDeletionError({
        phase,
        session,
        epoch,
        userId: epoch.userId,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setPhase(next);
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }, [phase]);

  if (!verifiedUserId) {
    return null;
  }

  const explainer = accountDeletionExplainer();
  const confirm = accountDeletionConfirmCopy();

  return (
    <View
      style={{ gap: 10 }}
      accessibilityRole="summary"
      accessibilityLabel="Yêu cầu xóa tài khoản"
    >
      <Notice title={explainer.title}>{explainer.body}</Notice>

      {phase.kind === 'idle' ? (
        <SecondaryButton
          label="Yêu cầu xóa tài khoản"
          onPress={onStart}
          disabled={busy}
          danger
        />
      ) : null}

      {phase.kind === 'confirming' ? (
        <View style={{ gap: 8 }}>
          <Notice title={confirm.title}>{confirm.body}</Notice>
          <PrimaryButton
            label={confirm.confirmLabel}
            onPress={() => void onConfirmSubmit()}
            disabled={busy}
          />
          <SecondaryButton
            label={confirm.cancelLabel}
            onPress={onCancelConfirm}
            disabled={busy}
          />
        </View>
      ) : null}

      {phase.kind === 'loading' ? (
        <View style={{ padding: 8, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: colors.secondary, marginTop: 8 }}>
            Đang gửi hoặc tải yêu cầu…
          </Text>
        </View>
      ) : null}

      {phase.kind === 'acknowledged' || phase.kind === 'status' ? (
        <Notice title={describeAccountDeletionRequest(phase.request).title}>
          {describeAccountDeletionRequest(phase.request).body}
        </Notice>
      ) : null}

      {phase.kind === 'error' ? (
        <View style={{ gap: 8 }}>
          <Notice
            title={
              resolveAccountDeletionRetryAction(phase) === 'resubmit'
                ? 'Không gửi được yêu cầu'
                : 'Không tải được trạng thái'
            }
          >
            {phase.message}
          </Notice>
          {phase.retryable ? (
            <PrimaryButton
              label={
                resolveAccountDeletionRetryAction(phase) === 'resubmit'
                  ? 'Thử lại gửi yêu cầu'
                  : 'Thử tải lại trạng thái'
              }
              onPress={() => void onRetry()}
              disabled={busy}
            />
          ) : null}
          <SecondaryButton
            label="Đóng"
            onPress={() => setPhase({ kind: 'idle' })}
            disabled={busy}
          />
        </View>
      ) : null}

      {phase.kind === 'unavailable' ? (
        <Notice title="Không dùng được yêu cầu xóa">
          {phase.message}
        </Notice>
      ) : null}

      {phase.kind === 'idle' ||
      phase.kind === 'acknowledged' ||
      phase.kind === 'status' ||
      phase.kind === 'unavailable' ? (
        <SecondaryButton
          label="Làm mới trạng thái yêu cầu"
          onPress={() => void refreshStatus()}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}

/** Remount on user change so prior-account deletion status cannot leak. */
export function SessionScopedAccountDeletionPanel() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const key =
    identity.status === 'verified'
      ? `deletion:${identity.userId}`
      : `deletion:${identity.status}`;
  return <AccountDeletionPanel key={key} />;
}
