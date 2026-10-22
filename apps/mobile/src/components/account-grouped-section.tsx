import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type SectionProps = PropsWithChildren<{
  title: string;
  accessibilityLabel?: string;
}>;

export function AccountGroupedSection({
  title,
  accessibilityLabel,
  children
}: SectionProps) {
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel ?? title}
      style={{ gap: space.sm }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...typography.caption, color: colors.secondary,
          fontFamily: fontFamilies.body,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          paddingHorizontal: space.xs }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          overflow: 'hidden'
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function AccountGroupedRow({
  label,
  value,
  onPress,
  disabled,
  destructive,
  showChevron,
  testID,
  accessibilityHint
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const interactive = Boolean(onPress) && !disabled;
  const body = (
    <View
      style={{
        minHeight: 44,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        opacity: disabled ? 0.45 : 1
      }}
    >
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text
          style={{ ...typography.body, color: destructive ? brand.signal : brand.ink,
            fontFamily: fontFamilies.body,
            fontWeight: destructive ? '600' : '400' }}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={{ ...typography.subhead, color: colors.secondary,
              fontFamily: fontFamilies.body,
              lineHeight: 20 }}
          >
            {value}
          </Text>
        ) : null}
      </View>
      {showChevron ? (
        <Text
          style={{ ...typography.sectionTitle, color: colors.secondary, }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ›
        </Text>
      ) : null}
    </View>
  );

  if (!interactive) {
    return (
      <View testID={testID} accessibilityLabel={label}>
        {body}
      </View>
    );
  }

  return (
    <Button
      testID={testID}
      variant="ghost"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={{ alignSelf: 'stretch', paddingHorizontal: 0 }}
      contentStyle={{ justifyContent: 'flex-start', width: '100%' }}
    >
      {body}
    </Button>
  );
}

export function AccountGroupedDivider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.separator,
        marginLeft: space.lg
      }}
    />
  );
}

export function AccountSectionFooter({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{ ...typography.caption, color: colors.secondary,
        fontFamily: fontFamilies.body,
        lineHeight: 18,
        paddingHorizontal: space.xs }}
    >
      {children}
    </Text>
  );
}
