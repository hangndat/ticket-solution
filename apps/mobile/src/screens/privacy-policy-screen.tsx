import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
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
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

/** Shared native privacy (attendee + staff). No WebView. */
export function PrivacyScreen() {
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
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <View key={section.title} style={{ gap: space.sm }}>
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
