import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
    >
      {children}
    </ScrollView>
  );
}
export function Notice({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View
      style={{
        padding: 20,
        gap: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        borderCurve: 'continuous',
      }}
    >
      <Text
        selectable
        style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{ color: colors.secondary, fontSize: 17, lineHeight: 25 }}
      >
        {children}
      </Text>
    </View>
  );
}
