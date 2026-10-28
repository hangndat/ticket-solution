import { useState } from 'react';
import {
  Image,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle
} from 'react-native';

type Props = {
  /** Local require() or { uri } — never render a broken remote icon. */
  source: ImageSourcePropType | null | undefined;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
  testID?: string;
  /** When remote fails / missing, collapse to zero height (no broken chrome). */
  collapseOnFail?: boolean;
  /** Parent can swap to a brand fallback instead of an empty paper slot. */
  onError?: () => void;
};

function isUsableSource(
  source: ImageSourcePropType | null | undefined,
  failed: boolean,
): source is ImageSourcePropType {
  if (failed || source == null) return false;
  if (typeof source === 'number') return true;
  if (Array.isArray(source)) return source.length > 0;
  if (typeof source === 'object' && 'uri' in source) {
    return typeof source.uri === 'string' && source.uri.trim().length > 0;
  }
  return true;
}

/**
 * Fail-closed event media: missing/invalid/failed sources render nothing
 * (or an empty reserved slot) instead of a broken-image glyph.
 */
export function SafeEventImage({
  source,
  accessibilityLabel,
  style,
  imageStyle,
  resizeMode = 'cover',
  testID,
  collapseOnFail = true,
  onError,
}: Props) {
  const [failed, setFailed] = useState(false);

  if (!isUsableSource(source, failed)) {
    if (collapseOnFail) return null;
    return <View style={style} testID={testID ? `${testID}-empty` : undefined} />;
  }

  return (
    <View
      style={[{ overflow: 'hidden' }, style]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={source}
        style={[{ width: '100%', height: '100%' }, imageStyle]}
        resizeMode={resizeMode}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
        accessible={false}
      />
    </View>
  );
}

export { remoteImageSource } from './safe-event-image-url.ts';
