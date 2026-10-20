import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { Page } from '@/components/page';
import { LoadingState } from '@/components/screen-state';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { resolveStaffGateTabPhase } from './staff-gate-tab-guard-policy';

/** Fail-closed entry for staff-only tab routes (Scan / Nhập tay / Lịch sử). */
export function StaffGateTabGuard({ children }: PropsWithChildren) {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const eligibility = useSyncExternalStore(
    staffEligibility.subscribe,
    staffEligibility.getSnapshot,
    staffEligibility.getSnapshot,
  );

  useEffect(() => {
    if (identity.status !== 'verified') {
      staffEligibility.reset();
      return;
    }
    if (!eligibility.resolved && !eligibility.loading) {
      void staffEligibility.refresh(session);
    }
  }, [identity, eligibility.resolved, eligibility.loading]);

  const phase = resolveStaffGateTabPhase(identity.status, eligibility);

  if (phase === 'redirect-guest') {
    return <Redirect href="/(tabs)/(events)" />;
  }

  if (phase === 'loading') {
    return (
      <Page>
        <LoadingState title="Đang kiểm tra quyền nhân viên">
          Chưa mở khu vực nhân viên cho đến khi máy chủ xác nhận.
        </LoadingState>
      </Page>
    );
  }

  if (phase === 'redirect-deny') {
    return <Redirect href="/staff-access" />;
  }

  return children;
}
