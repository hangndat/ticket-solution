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

function toneSurface(tone: GateScanStatusView['tone'], emphasized: boolean): string {
  if (!emphasized) return colors.card;
  if (tone === 'admit') return colors.admitSurface;
  if (tone === 'deny') return '#fde8ec';
  if (tone === 'unknown') return '#fff6e8';
  return colors.surfaceMuted;
}

export function StaffGateScanStatusPanel({
  view,
  busy,
  emphasized,
  testID
}: {
  view: GateScanStatusView;
  busy: boolean;
  /** Terminal / sticky scan result — not idle ready chrome. */
  emphasized?: boolean;
  testID?: string;
}) {
  const tint = toneColor(view.tone);
  const showSpinner = busy || view.kind === 'processing';
  const isIdleReady = !emphasized && view.kind === 'idle';
  const panelEmphasized = emphasized || view.kind !== 'idle';

  return (
    <View
      testID={testID}
      style={{
        gap: space.sm,
        paddingVertical: isIdleReady ? space.sm : space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        backgroundColor: toneSurface(view.tone, panelEmphasized),
        borderWidth: panelEmphasized ? 1 : 0,
        borderColor: panelEmphasized ? colors.line : 'transparent'
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
          style={{
            ...typography.sectionTitleBold,
            color: colors.label,
            flex: 1,
          }}
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
