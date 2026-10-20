import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { Page } from '@/components/page';
import { LoadingState } from '@/components/screen-state';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';

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

  if (identity.status === 'verified' && (!eligibility.resolved || eligibility.loading)) {
    return (
      <Page>
        <LoadingState title="Đang kiểm tra quyền nhân viên">
          Chưa mở khu vực nhân viên cho đến khi máy chủ xác nhận.
        </LoadingState>
      </Page>
    );
  }

  if (!eligibility.staffEligible) {
    return <Redirect href="/staff-access" />;
  }

  return children;
}
