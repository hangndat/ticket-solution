import { Text, View } from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { SymbolView } from 'expo-symbols';
import type { GateScanStatusView } from './gate-scan-status-ui.ts';
import { colors } from '@/theme/colors';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';

function toneColor(tone: GateScanStatusView['tone']): string {
  if (tone === 'admit') return colors.admit;
  if (tone === 'deny') return colors.deny;
  if (tone === 'unknown') return colors.unknown;
  return colors.secondary;
}

export function StaffGateScanStatusPanel({
  view,
  busy,
  emphasized
}: {
  view: GateScanStatusView;
  busy: boolean;
  /** Terminal / sticky scan result — not idle ready chrome. */
  emphasized?: boolean;
}) {
  const tint = toneColor(view.tone);
  const showSpinner = busy || view.kind === 'processing';
  const isIdleReady = !emphasized && view.kind === 'idle';

  return (
    <View
      style={{
        gap: space.sm,
        paddingVertical: isIdleReady ? 6 : 10,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        borderWidth: emphasized ? 2 : 0,
        borderColor: emphasized ? tint : 'transparent'
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {showSpinner ? (
          <Spinner
            accessibilityLabel="Đang xử lý quét"
            color={colors.accent}
          />
        ) : (
          <SymbolView
            name={view.symbol}
            size={32}
            tintColor={tint}
            accessibilityLabel={view.label}
          />
        )}
        <Text
          accessibilityRole="header"
          style={{ ...typography.sectionTitleBold, color: colors.label, }}
        >
          {view.label}
        </Text>
      </View>
      <Text
        style={{ ...typography.subhead, color: colors.secondary,
          lineHeight: 20 }}
      >
        {view.hint}
      </Text>
    </View>
  );
}
