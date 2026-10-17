import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type AccessibilityRole,
} from 'react-native';
import { Notice } from '@/components/page';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type PanelProps = PropsWithChildren<{
  title: string;
  accessibilityLabel?: string;
}>;

/** Branded loading panel — spinner + VI copy, never bare ActivityIndicator alone. */
export function LoadingState({
  title,
  children,
  accessibilityLabel,
}: PanelProps) {
  const label = accessibilityLabel ?? title;
  return (
    <View
      accessibilityRole={'progressbar' as AccessibilityRole}
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{
        padding: 20,
        gap: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator color={colors.accent} />
      <Text
        style={{
          color: colors.label,
          fontSize: 22,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text
          style={{
            color: colors.secondary,
            fontSize: 17,
            lineHeight: 25,
            textAlign: 'center',
          }}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}

/** Empty list / idle surface with consistent Notice chrome. */
export function EmptyState({ title, children }: PanelProps) {
  return <Notice title={title}>{children}</Notice>;
}

/** Fail-closed error panel; optional retry CTA. */
export function ErrorState({
  title,
  children,
  onRetry,
  retryLabel = 'Thử lại',
}: PanelProps & {
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Notice title={title} tone="deny">
        {children}
      </Notice>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={({ pressed }) => ({
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: colors.card,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.label,
              fontSize: 17,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {retryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Compact caption used under idle CTAs (events published list). */
export function StateCaption({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: colors.secondary, ...typography.caption }}>
      {children}
    </Text>
  );
}
