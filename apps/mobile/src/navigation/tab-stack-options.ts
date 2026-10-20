import type { NativeStackNavigationOptions } from 'expo-router';
import { brand } from '@/theme/tokens';

/** Compact (collapsed) nav title — readable, left-aligned, not glass-thin. */
const tabCompactTitleStyle = {
  color: brand.ink,
  fontWeight: '700' as const,
  fontSize: 20,
};

/**
 * Native large title + NativeTabs. Scroll root first, then `<TabStackTitle>`.
 * Blur material on the collapsed bar so content does not read through the title.
 */
/** Guest attendee roots (Sự kiện, …): compact bar like full-prototype.html — no large-title dead zone. */
export const tabAttendeeCompactStackScreenOptions: NativeStackNavigationOptions =
  {
    headerLargeTitleEnabled: false,
    headerTransparent: false,
    headerTitleAlign: 'left',
    headerShadowVisible: true,
    headerBackButtonDisplayMode: 'default',
    headerTintColor: brand.ink,
    headerStyle: { backgroundColor: brand.paper },
    headerTitleStyle: tabCompactTitleStyle,
    contentStyle: { backgroundColor: brand.paper },
  };

export const tabRootStackScreenOptions: NativeStackNavigationOptions = {
  headerLargeTitleEnabled: true,
  headerTransparent: true,
  headerTitleAlign: 'left',
  headerShadowVisible: true,
  headerLargeTitleShadowVisible: false,
  headerBlurEffect: 'systemChromeMaterial',
  headerBackButtonDisplayMode: 'default',
  headerTintColor: brand.ink,
  headerLargeStyle: { backgroundColor: 'transparent' },
  headerTitleStyle: tabCompactTitleStyle,
  headerLargeTitleStyle: {
    color: brand.ink,
    fontWeight: '700',
  },
  contentStyle: { backgroundColor: brand.paper },
  unstable_nativeProps: {
    headerConfig: {
      titleColor: brand.ink,
      largeTitleColor: brand.ink,
      backgroundColor: brand.paper,
      largeTitleBackgroundColor: 'transparent',
    },
  },
};

export const tabDetailStackScreenOptions: NativeStackNavigationOptions = {
  headerLargeTitleEnabled: false,
  headerTransparent: { ios: false, android: false, web: false },
  headerBackButtonDisplayMode: 'minimal',
  headerTitleAlign: 'left',
  headerTintColor: brand.ink,
  headerStyle: { backgroundColor: brand.paper },
  headerTitleStyle: tabCompactTitleStyle,
  contentStyle: { backgroundColor: brand.paper },
};
