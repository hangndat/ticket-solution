import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

type SectionProps = PropsWithChildren<{
  title: string;
  accessibilityLabel?: string;
}>;

export function AccountGroupedSection({
  title,
  accessibilityLabel,
  children,
}: SectionProps) {
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel ?? title}
      style={{ gap: 8 }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: colors.secondary,
          fontFamily: fontFamilies.body,
          fontSize: 13,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          overflow: 'hidden',
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
  accessibilityHint,
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: destructive ? brand.signal : brand.ink,
            fontFamily: fontFamilies.body,
            fontSize: 17,
            fontWeight: destructive ? '600' : '400',
          }}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={{
              color: colors.secondary,
              fontFamily: fontFamilies.body,
              fontSize: 15,
              lineHeight: 20,
            }}
          >
            {value}
          </Text>
        ) : null}
      </View>
      {showChevron ? (
        <Text
          style={{
            color: colors.secondary,
            fontSize: 20,
            fontWeight: '600',
          }}
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
        marginLeft: 16,
      }}
    />
  );
}

export function AccountSectionFooter({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: colors.secondary,
        fontFamily: fontFamilies.body,
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: 4,
      }}
    >
      {children}
    </Text>
  );
}
