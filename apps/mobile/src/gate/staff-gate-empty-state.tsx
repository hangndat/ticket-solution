import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { colors } from '@/theme/colors';
import { useStaffGateWorkspace } from './staff-gate-workspace-context';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffGateNoEventState() {
  const gate = useStaffGateWorkspace();

  if (gate.gateEventsLoading || gate.gateScope) return null;

  return (
    <View
      style={{
        padding: space.xl,
        gap: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.card
      }}
      accessibilityRole="alert"
    >
      <Text style={{ ...typography.bodySemibold, color: colors.label }}>
        Chưa có sự kiện để quét
      </Text>
      <Text style={{ ...typography.subhead, color: colors.secondary,  lineHeight: 22 }}>
        {gate.gateEventsError ??
          'Tài khoản chưa được gán sự kiện có quyền cổng. Làm mới hoặc đăng xuất để dùng chế độ khách.'}
      </Text>
      <Button
        label="Làm mới"
        accessibilityLabel="Làm mới danh sách sự kiện"
        onPress={() => void gate.refreshGateEvents()}
        style={styles.refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  refresh: { alignSelf: 'flex-start' }
});
