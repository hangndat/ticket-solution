import { useState } from 'react';
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  isLogoUrlFailed,
  markLogoUrlFailed,
} from './branding-cache.ts';
import { useTheme } from './ThemeProvider.tsx';
import { typography } from './typography.ts';

type Props = {
  /** Override theme logo URL (e.g. event brand). */
  logoUrl?: string | null;
  wordmark?: string;
  signalMark?: string;
  compact?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Platform defaults use the approved lockup asset; published tenant branding
 * remains data-driven and falls back to its supplied wordmark on image errors.
 */
export function TenantLogo({
  logoUrl: logoUrlProp,
  wordmark: wordmarkProp,
  signalMark: signalMarkProp,
  compact = false,
  height = 36,
  style,
  testID = 'tenant-logo',
}: Props) {
  const { theme } = useTheme();
  const logoUrl = logoUrlProp !== undefined ? logoUrlProp : theme.logoUrl;
  const wordmark = wordmarkProp ?? theme.wordmark;
  const signalMark = signalMarkProp ?? theme.signalMark;
  const [imageFailed, setImageFailed] = useState(false);

  const url =
    typeof logoUrl === 'string' && logoUrl.trim().length > 0
      ? logoUrl.trim()
      : null;
  const showImage = !!url && !imageFailed && !isLogoUrlFailed(url);

  if (showImage && url) {
    return (
      <View
        style={[{ height, justifyContent: 'center' }, style]}
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={wordmark}
      >
        <Image
          source={{ uri: url }}
          style={{ height, width: height * 3, resizeMode: 'contain' }}
          onError={() => {
            markLogoUrlFailed(url);
            setImageFailed(true);
          }}
          // Never block UI on slow CDN.
          accessible={false}
        />
      </View>
    );
  }

  if (theme.source === 'default') {
    return (
      <View
        style={[{ height, justifyContent: 'center' }, style]}
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={wordmark}
      >
        <Image
          source={require('../../assets/vemoki-lockup.png')}
          style={{ height, width: height * 3.8, resizeMode: 'contain' }}
          accessible={false}
        />
      </View>
    );
  }

  return (
    <View style={style} testID={testID}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={`${wordmark}${signalMark}`}
        style={{
          ...(compact ? typography.callout : typography.wordmark),
          color: theme.ink,
        }}
      >
        {wordmark}
        <Text style={{ color: theme.signal }}>{signalMark}</Text>
      </Text>
    </View>
  );
}
