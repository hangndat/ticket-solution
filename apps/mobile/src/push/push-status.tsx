import { View } from 'react-native';
import { Notice } from '@/components/page';
import { pushProviderName, pushUiCopy } from '@/push/push';

/** Fail-closed status. Unconfigured builds announce that push is not configured. */
export function PushStatus() {
  const copy = pushUiCopy(pushProviderName());
  return (
    <View accessibilityRole="text" accessibilityLabel={copy.announcement}>
      <Notice title={copy.title}>{copy.body}</Notice>
    </View>
  );
}
