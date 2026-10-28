import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsCopy } from '@/components/screen-state-copy';
import { isLongEventText } from '@/published/event-detail-model';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { space } from '@/theme/tokens';
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
    whenLine ? { key: 'when', text: whenLine, a11y: `Thời gian: ${whenLine}` } : null,
    venue ? { key: 'venue', text: venue, a11y: `Địa điểm: ${venue}` } : null,
    organizer
      ? {
          key: 'org',
          text: organizer,
          a11y: `${copy.organizerLabel}: ${organizer}`
        }
      : null
  ].filter(Boolean) as { key: string; text: string; a11y: string }[];
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.xs }}>
      {rows.map((row, i) => (
        <Text
          key={row.key}
          selectable
          accessibilityLabel={row.a11y}
          style={{
            ...typography.body,
            fontFamily: fontFamilies.body,
            color: i === 0 ? brand.ink : colors.secondary
          }}
        >
          {row.text}
        </Text>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? copy.seeLess : copy.seeMore}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          hitSlop={space.sm}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text
            style={{
              ...typography.callout,
              fontFamily: fontFamilies.bodySemiBold,
              color: brand.ink
            }}
          >
            {open ? copy.seeLess : copy.seeMore}
          </Text>
        </Pressable>
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
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${title}, ${hint}` : title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{
          minHeight: 48,
          paddingVertical: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.md
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
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: space.md, gap: space.md }}>{children}</View>
      ) : null}
    </View>
  );
}
