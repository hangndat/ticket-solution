import { Text, View } from 'react-native';
import { Notice, Page } from '@/components/page';
import { walletCopy } from '@/components/screen-state-copy';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { space } from '@/theme/tokens';

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
    <View style={{ gap: space.sm, paddingVertical: space.sm }}>
      <Text
        accessibilityRole="header"
        style={{ ...typography.bodySemibold, color: brand.ink, }}
      >
        {walletCopy.guestWalletBlockedTitle}
      </Text>
      <Text style={{ ...typography.subhead, color: colors.secondary,  lineHeight: 22 }}>
        {walletCopy.guestWalletBlockedBody}
      </Text>
    </View>
  );
}
