import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { StaffGateHistorySheet } from '@/gate/staff-gate-history-sheet';
import { StaffGateManualEntryModal } from '@/gate/staff-gate-manual-entry';
import { StaffEventPicker } from '@/gate/staff-gate-chrome';
import type { StaffGateScope } from '@/gate/staff-gate-events';
import { StaffManualConfirmSheet } from '@/gate/staff-manual-confirm-sheet';
import { uatSessionRouteAllowed } from '@/navigation/dev-only-routes';
import { colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

const MOCK_EVENTS: StaffGateScope[] = [
  { tenantId: 't1', eventId: 'e1', name: 'MFest 2026' },
  { tenantId: 't1', eventId: 'e2', name: 'Workshop A' },
  { tenantId: 't1', eventId: 'e3', name: 'Gala' },
];

const MOCK_HISTORY = [
  {
    id: '1',
    at: new Date(Date.now() - 60_000).toISOString(),
    ticketLabel: 'VIP-001',
    statusLabel: 'Đã vào',
    hint: 'MFest 2026',
    tone: 'admit' as const,
    source: 'scan' as const,
  },
];

/** Dev/UAT only — preview @expo/ui gate chrome without live staff API. */
export function UatGateExpoUiFixtureScreen() {
  const allowed = uatSessionRouteAllowed();
  const [scope, setScope] = useState<StaffGateScope>(MOCK_EVENTS[0]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!allowed) {
    return (
      <View style={{ flex: 1, padding: space.xl, justifyContent: 'center' }}>
        <Text style={{ ...typography.body, color: colors.deny }}>
          Fixture chỉ dùng trong __DEV__ hoặc EXPO_PUBLIC_ALLOW_UAT_SESSION=1.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: space.xl, gap: space.lg }}
      >
        <Text accessibilityRole="header" style={{ ...typography.title, color: colors.label }}>
          UAT @expo/ui gate — Issue 815
        </Text>
        <StaffEventPicker
          choices={MOCK_EVENTS}
          selected={scope}
          onSelect={setScope}
        />
        <Text style={{ ...typography.footnote, color: colors.secondary }}>
          Đã chọn: {scope.name}
        </Text>
        <Button label="Mở lịch sử (BottomSheet)" onPress={() => setHistoryOpen(true)} />
        <Button label="Nhập tay (BottomSheet)" onPress={() => setManualOpen(true)} />
        <Button label="Xác nhận vé (Modal)" onPress={() => setConfirmOpen(true)} />
      </ScrollView>
      <StaffGateHistorySheet
        visible={historyOpen}
        rows={MOCK_HISTORY}
        onClose={() => setHistoryOpen(false)}
      />
      <StaffGateManualEntryModal
        visible={manualOpen}
        value={manualValue}
        onChange={setManualValue}
        onSubmit={() => setManualOpen(false)}
        onClose={() => setManualOpen(false)}
      />
      <StaffManualConfirmSheet
        visible={confirmOpen}
        previewLine="MFest 2026 · VIP-001"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
