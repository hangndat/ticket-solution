import { useSyncExternalStore } from 'react';
import { ScrollView, View } from 'react-native';
import { SessionScopedAccountDeletionPanel } from '@/account-deletion/account-deletion-panel';
import { Notice } from '@/components/page';
import { session } from '@/identity/session';
import { brand } from '@/theme/colors';
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { space } from '@/theme/tokens';

/** Push detail for account deletion — no inline panel on Account root (AC-A2). */
export function AccountDeleteScreen() {
  const identity = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.huge, gap: space.lg }}
      >
        <View style={{ gap: space.md }}>
          {identity.status === 'verified' ? (
            <SessionScopedAccountDeletionPanel attendee />
          ) : (
            <Notice title="Cần đăng nhập">Đăng nhập và xác minh tài khoản trước khi gửi yêu cầu xóa.</Notice>
          )}
        </View>
      </ScrollView>
      <TabStackTitle title="Xóa tài khoản" large={false} />
    </>
  );
}
