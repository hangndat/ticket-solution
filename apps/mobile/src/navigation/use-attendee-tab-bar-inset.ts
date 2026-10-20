import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Floating `NativeTabs` chrome on iPhone (guest 2-tab). */
const IOS_FLOATING_TAB_BAR = 88;

/**
 * Scroll `paddingBottom` so list footers (e.g. Đổi mã CTA) clear the tab bar when scrolled to end.
 */
export function useAttendeeTabBarInset(extraClearance = 40): number {
  const insets = useSafeAreaInsets();
  const tabBar =
    Platform.OS === 'ios' ? IOS_FLOATING_TAB_BAR : 56;
  return insets.bottom + tabBar + extraClearance;
}
