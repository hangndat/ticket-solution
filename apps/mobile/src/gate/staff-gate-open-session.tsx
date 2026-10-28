import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';
import type { StaffGateGatesValue } from './staff-gate-workspace-context.tsx';

const VIEWPORT_HEIGHT = 300;

/** Static, muted viewfinder stand-in while no session is open (no motion, no live preview). */
export function GateCameraIdle() {
  return (
    <View
      testID="gate-camera-idle"
      accessible
      accessibilityLabel="Camera tắt. Mở phiên cổng để bắt đầu quét."
      style={{
        height: VIEWPORT_HEIGHT,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <SymbolView name="camera.fill" size={56} tintColor={colors.separator} />
    </View>
  );
}

/** Gate picker (only when the event has gates) + explicit «Mở phiên cổng». */
export function StaffGateOpenSession({ gates }: { gates: StaffGateGatesValue }) {
  const ui = gates.openUi;
  if (gates.status === 'error' && ui.scanFallback) {
    return (
      <View testID="gate-open-session-error" style={{ gap: space.sm }}>
        <Text style={{ ...typography.footnote, color: colors.deny }}>
          Không tải được danh sách cổng. Vẫn có thể quét — phiên sẽ mở ở lượt quét đầu.
        </Text>
        <Button
          variant="secondary"
          label="Thử lại"
          accessibilityLabel="Tải lại danh sách cổng"
          onPress={() => void gates.reloadGates()}
        />
      </View>
    );
  }
  if (!ui.explicitOpen) return null;
  if (gates.status === 'loading') {
    return (
      <View
        testID="gate-open-session-loading"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Spinner color={colors.secondary} />
        <Text style={{ ...typography.footnote, color: colors.secondary }}>
          Đang tải cổng…
        </Text>
      </View>
    );
  }
  return (
    <View testID="gate-open-session" style={{ gap: space.md }}>
      {ui.showPicker ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...typography.subheadSemibold, color: colors.label }}>
            Chọn cổng
          </Text>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            {gates.gates.map((gate) => {
              const selected = gate.id === gates.selectedGateId;
              return (
                <Pressable
                  key={gate.id}
                  testID={`gate-choice-${gate.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Cổng ${gate.name}`}
                  onPress={() => gates.selectGate(gate.id)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: space.lg,
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.line,
                    backgroundColor: selected ? colors.accent : colors.surfaceMuted
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      ...typography.subheadSemibold,
                      color: selected ? colors.onAccent : colors.label
                    }}
                  >
                    {gate.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {gates.openError ? (
        <Text
          accessibilityRole="alert"
          style={{ ...typography.footnote, color: colors.deny }}
        >
          {gates.openError}
        </Text>
      ) : null}
      <Button
        testID="gate-open-session-button"
        label="Mở phiên cổng"
        accessibilityLabel="Mở phiên cổng"
        size="lg"
        disabled={!ui.canOpen}
        loading={gates.opening}
        onPress={() => void gates.openSession()}
      />
    </View>
  );
}
