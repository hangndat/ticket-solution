import { Text, View } from 'react-native';
import { Notice, Page } from '@/components/page';
import { walletCopy } from '@/components/screen-state-copy';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

/** Deep-link / push routes when wallet access is false (tab is hidden for guests). */
export function WalletAccessNotice() {
  return (
    <Page>
      <Notice title={walletCopy.guestWalletBlockedTitle}>
        {walletCopy.guestWalletBlockedBody}
      </Notice>
    </Page>
  );
}

export function WalletAccessNoticeCompact() {
  return (
    <View style={{ gap: 8, paddingVertical: 8 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: brand.ink,
          fontSize: 17,
          fontWeight: '600',
        }}
      >
        {walletCopy.guestWalletBlockedTitle}
      </Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
        {walletCopy.guestWalletBlockedBody}
      </Text>
    </View>
  );
}
