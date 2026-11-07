import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsCopy } from '@/components/screen-state-copy';
import { isLongEventText } from '@/published/event-detail-model';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { layout, radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

const copy = eventsCopy.detail;

/** Solid paper scroll root with an optional pinned action bar (no atmosphere wash). */
export function EventDetailLayout({
  children,
  footer
}: PropsWithChildren<{ footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: space.xl,
          gap: space.xl
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: Math.max(insets.bottom, space.md),
            gap: space.sm,
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceMuted
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function EventDetailBody({ children }: PropsWithChildren) {
  return (
    <View style={{ paddingHorizontal: space.xl, gap: space.xl }}>
      {children}
    </View>
  );
}

export function EventMeta({
  whenLine,
  venue,
  organizer
}: {
  whenLine: string | null;
  venue: string | null;
  organizer: string | null;
}) {
  const rows = [
    whenLine ? { key: 'when', icon: '◷', text: whenLine, a11y: `Thời gian: ${whenLine}` } : null,
    venue ? { key: 'venue', icon: '⌖', text: venue, a11y: `Địa điểm: ${venue}` } : null,
    organizer
      ? {
          key: 'org',
          icon: '◯',
          text: organizer,
          a11y: `${copy.organizerLabel}: ${organizer}`
        }
      : null
  ].filter(Boolean) as { key: string; icon: string; text: string; a11y: string }[];
  if (rows.length === 0) return null;
  return (
    <View style={{ backgroundColor: colors.onAccent, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center',
          gap: space.md, padding: space.md,
          borderBottomWidth: i === rows.length - 1 ? 0 : 1,
          borderBottomColor: colors.line }}>
          <Text accessibilityElementsHidden style={{ ...typography.title,
            color: colors.admit }}>{row.icon}</Text>
          <Text selectable accessibilityLabel={row.a11y}
            style={{ ...typography.body, flex: 1,
              fontFamily: fontFamilies.bodySemiBold, color: brand.ink }}>
            {row.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Prose block: clamps long text behind "Xem thêm". */
export function ExpandableText({
  text,
  testID
}: {
  text: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = isLongEventText(text);
  return (
    <View style={{ gap: space.sm }}>
      <Text
        selectable
        testID={testID}
        numberOfLines={long && !open ? 6 : undefined}
        style={{
          ...typography.body,
          fontFamily: fontFamilies.body,
          color: colors.secondary,
          lineHeight: 25
        }}
      >
        {text}
      </Text>
      {long ? (
        <Button
          variant="ghost"
          label={open ? copy.seeLess : copy.seeMore}
          accessibilityLabel={open ? copy.seeLess : copy.seeMore}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          style={{ minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: layout.none }}
        />
      ) : null}
    </View>
  );
}

export function SectionBlock({
  title,
  children
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: space.sm }}>
      <Text
        accessibilityRole="header"
        style={{
          ...typography.title,
          fontFamily: fontFamilies.display,
          color: brand.ink
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Quiet collapsible row (terms / FAQ / guide) — closed by default. */
export function CollapsibleRow({
  title,
  hint,
  children,
  testID
}: PropsWithChildren<{ title: string; hint?: string | null; testID?: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.surfaceMuted
      }}
    >
      <Button
        testID={testID}
        variant="ghost"
        accessibilityLabel={hint ? `${title}, ${hint}` : title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{
          minHeight: 48,
          paddingVertical: space.md,
          paddingHorizontal: layout.none,
          alignSelf: 'stretch',
        }}
        contentStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.md,
          width: '100%',
        }}
      >
        <Text
          style={{
            ...typography.body,
            fontFamily: fontFamilies.bodySemiBold,
            color: brand.ink,
            flexShrink: 1
          }}
        >
          {title}
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ ...typography.body, color: colors.secondary }}
        >
          {open ? '−' : '+'}
        </Text>
      </Button>
      {open ? (
        <View style={{ paddingBottom: space.md, gap: space.md }}>{children}</View>
      ) : null}
    </View>
  );
}
