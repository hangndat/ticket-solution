import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View, type AccessibilityRole } from 'react-native';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/page';
import { Spinner } from '@/components/ui/spinner';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
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
      style={styles.loadingPanel}
    >
      <Spinner color={colors.accent} accessibilityLabel={label} />
      <Text style={styles.loadingTitle}>{title}</Text>
      {children != null && children !== '' ? (
        <Text style={styles.loadingBody}>{children}</Text>
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
    <View style={styles.errorWrap}>
      <Notice title={title} tone="deny">
        {children}
      </Notice>
      {onRetry ? (
        <Button
          label={retryLabel}
          variant="secondary"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
        />
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

const styles = StyleSheet.create({
  loadingPanel: {
    padding: space.xl,
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg - 2,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  loadingTitle: {
    color: colors.label,
    fontSize: 22,
    fontFamily: fontFamilies.display,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingBody: {
    color: colors.secondary,
    fontSize: 17,
    lineHeight: 25,
    fontFamily: fontFamilies.body,
    textAlign: 'center',
  },
  errorWrap: {
    gap: space.md,
  },
});
