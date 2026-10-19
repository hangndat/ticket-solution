import { ScrollView, View } from 'react-native';
import { SessionScopedAccountDeletionPanel } from '@/account-deletion/account-deletion-panel';
import { brand } from '@/theme/colors';
import { TabStackTitle } from '@/navigation/tab-stack-title';

/** Push detail for account deletion — no inline panel on Account root (AC-A2). */
export function AccountDeleteScreen() {
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      >
        <View style={{ gap: 12 }}>
          <SessionScopedAccountDeletionPanel />
        </View>
      </ScrollView>
      <TabStackTitle title="Xóa tài khoản" />
    </>
  );
}
