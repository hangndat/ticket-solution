import { useRef, type ElementRef } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_NOTE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_UPDATED,
} from '@/account-deletion/privacy-policy-copy';
import { closePrivacyPolicy } from '@/navigation/close-privacy-policy';
import { parsePrivacyOrigin } from '@/navigation/privacy-policy-navigation';
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

/** Shared native privacy (attendee + staff). No WebView. */
export function PrivacyScreen() {
  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const contentsOffset = useRef(0);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = parsePrivacyOrigin(from);
  // Deep link with no history: no native back chevron — offer an explicit exit.
  const needsExit = !router.canGoBack();
  return (
    <>
      {needsExit ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Đóng chính sách quyền riêng tư"
            onPress={() => closePrivacyPolicy(origin)}
          >
            Xong
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: space.huge,
          gap: space.lg,
        }}
      >
        <Text
          style={{
            ...typography.footnote,
            color: colors.secondary,
            fontFamily: fontFamilies.body,
          }}
        >
          {PRIVACY_POLICY_UPDATED}
        </Text>
        <Text
          style={{
            ...typography.body,
            color: brand.ink,
            lineHeight: 25,
            fontFamily: fontFamilies.body,
          }}
        >
          {PRIVACY_POLICY_INTRO}
        </Text>
        <View
          onLayout={(event) => { contentsOffset.current = event.nativeEvent.layout.y; }}
          style={{ gap: space.md, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', padding: space.lg }}
        >
          <Text style={{ color: brand.ink, ...typography.bodySemibold }}>Đến nhanh một mục</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {[0, 3, 4, 6].map((index) => {
              const section = PRIVACY_POLICY_SECTIONS[index];
              return (
                <Button
                  key={section.title}
                  variant="secondary"
                  accessibilityLabel={`Đến mục ${section.title}`}
                  onPress={() => scroll.current?.scrollTo({ y: sectionOffsets.current[section.title] ?? 0, animated: true })}
                  label={section.title}
                  style={{ borderRadius: radius.pill }}
                />
              );
            })}
          </View>
        </View>
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <View
            key={section.title}
            onLayout={(event) => { sectionOffsets.current[section.title] = event.nativeEvent.layout.y; }}
            style={{ gap: space.sm, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: space.lg }}
          >
            <Text
              accessibilityRole="header"
              style={{
                ...typography.title,
                color: brand.ink,
                fontFamily: fontFamilies.display,
              }}
            >
              {section.title}
            </Text>
            <Text
              style={{
                ...typography.body,
                color: brand.ink,
                lineHeight: 25,
                fontFamily: fontFamilies.body,
              }}
            >
              {section.body}
            </Text>
            <Button
              variant="ghost"
              accessibilityLabel={`Về mục lục từ ${section.title}`}
              onPress={() => scroll.current?.scrollTo({ y: contentsOffset.current, animated: true })}
              label="↑ Về mục lục"
              style={{ alignSelf: 'flex-start' }}
            />
          </View>
        ))}
        <Text
          style={{
            ...typography.footnote,
            color: colors.secondary,
            lineHeight: 22,
            fontFamily: fontFamilies.body,
          }}
        >
          {PRIVACY_POLICY_NOTE}
        </Text>
      </ScrollView>
      <TabStackTitle title={PRIVACY_POLICY_TITLE} large={false} />
    </>
  );
}
