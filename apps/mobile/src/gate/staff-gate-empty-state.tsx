import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { useStaffGateWorkspace } from './staff-gate-workspace-context';

export function StaffGateNoEventState() {
  const gate = useStaffGateWorkspace();

  if (gate.gateEventsLoading || gate.gateScope) return null;

  return (
    <View
      style={{
        padding: 20,
        gap: 12,
        borderRadius: 12,
        backgroundColor: colors.card,
      }}
      accessibilityRole="alert"
    >
      <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>
        Chưa có sự kiện để quét
      </Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
        {gate.gateEventsError ??
          'Tài khoản chưa được gán sự kiện có quyền cổng. Làm mới hoặc đăng xuất để dùng chế độ khách.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Làm mới danh sách sự kiện"
        onPress={() => void gate.refreshGateEvents()}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: colors.accent,
        }}
      >
        <Text style={{ color: colors.onAccent, fontWeight: '600' }}>Làm mới</Text>
      </Pressable>
    </View>
  );
}
