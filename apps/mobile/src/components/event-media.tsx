import {
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { SafeEventImage } from './safe-event-image.tsx';
import { remoteImageSource } from './safe-event-image-url.ts';
import {
  hasDemoMediaForEventId,
  hasDemoMediaForTenantSlug
} from '@/data/demo-media';
import { brand, space, radius } from '@/theme/tokens';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';
import {
  demoBannerSource,
  demoLogoSource,
} from '@/data/demo-media-assets';
import { EVENT_BANNER_HEIGHT_LIST } from './event-banner-metrics.ts';

type BannerProps = {
  /** Fixture / published event id for local demo pack lookup. */
  eventId?: string | null;
  tenantSlug?: string | null;
  /** Published remote banner (https only). */
  bannerUrl?: string | null;
  /** Override local/remote with an explicit source. */
  bannerSource?: ImageSourcePropType | null;
  /** This event's primary color — never another card's brand. */
  fallbackColor?: string | null;
  /** This event's org / name wordmark when there is no image. */
  wordmark?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

type LogoProps = {
  eventId?: string | null;
  tenantSlug?: string | null;
  logoUrl?: string | null;
  logoSource?: ImageSourcePropType | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

function bundledDemoSource(
  eventId?: string | null,
  tenantSlug?: string | null,
): { logo: ImageSourcePropType; banner: ImageSourcePropType } | null {
  if (
    hasDemoMediaForEventId(eventId) ||
    hasDemoMediaForTenantSlug(tenantSlug)
  ) {
    return { logo: demoLogoSource, banner: demoBannerSource };
  }
  return null;
}

function isCssHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function EventBrandFallback({
  height,
  fallbackColor,
  wordmark,
  testID,
  accessibilityLabel,
  style,
}: {
  height: number;
  fallbackColor?: string | null;
  wordmark?: string | null;
  testID?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const wash =
    fallbackColor && isCssHexColor(fallbackColor)
      ? fallbackColor
      : brand.paperDeep;
  const label = wordmark?.trim() || '';

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          height,
          width: '100%',
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: brand.paper,
          justifyContent: 'flex-end',
          padding: space.md,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: wash,
          opacity: 0.22,
        }}
      />
      {label ? (
        <Text
          numberOfLines={1}
          style={{
            ...typography.caption,
            color: brand.ink,
            fontFamily: fontFamilies.bodySemiBold,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Simple per-event banner: image if this event has one, else a quiet wash +
 * wordmark from THIS event's brand — not catalog-wide Vemoki chrome.
 */
export function EventBanner({
  eventId,
  tenantSlug,
  bannerUrl,
  bannerSource,
  fallbackColor,
  wordmark,
  height = EVENT_BANNER_HEIGHT_LIST,
  style,
  testID = 'event-banner',
  accessibilityLabel = 'Ảnh banner sự kiện'
}: BannerProps) {
  const pack = bundledDemoSource(eventId, tenantSlug);
  const source =
    bannerSource ?? remoteImageSource(bannerUrl) ?? pack?.banner ?? null;

  if (!source) {
    return (
      <EventBrandFallback
        height={height}
        fallbackColor={fallbackColor}
        wordmark={wordmark}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={style}
      />
    );
  }

  return (
    <SafeEventImage
      source={source}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      resizeMode="cover"
      collapseOnFail={false}
      style={[
        {
          height,
          width: '100%',
          borderRadius: radius.md,
          backgroundColor: brand.paper
        },
        style,
      ]}
    />
  );
}

/**
 * Event / org logo lockup for cards and ticket chrome.
 */
export function EventLogo({
  eventId,
  tenantSlug,
  logoUrl,
  logoSource,
  height = 36,
  style,
  testID = 'event-logo',
  accessibilityLabel = 'Logo sự kiện'
}: LogoProps) {
  const pack = bundledDemoSource(eventId, tenantSlug);
  const source =
    logoSource ?? remoteImageSource(logoUrl) ?? pack?.logo ?? null;

  return (
    <SafeEventImage
      source={source}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      resizeMode="contain"
      style={[
        {
          height,
          width: height * 3.2,
          backgroundColor: 'transparent'
        },
        style,
      ]}
    />
  );
}

/** Compact stack: banner + logo for event cards / detail hero. */
export function EventMediaHeader({
  eventId,
  tenantSlug,
  bannerUrl,
  logoUrl,
  fallbackColor,
  wordmark,
  style,
  testID = 'event-media'
}: {
  eventId?: string | null;
  tenantSlug?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  fallbackColor?: string | null;
  wordmark?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[{ gap: space.md }, style]} testID={testID}>
      <EventBanner
        eventId={eventId}
        tenantSlug={tenantSlug}
        bannerUrl={bannerUrl}
        fallbackColor={fallbackColor}
        wordmark={wordmark}
        height={EVENT_BANNER_HEIGHT_LIST}
        testID={`${testID}-banner`}
      />
      <EventLogo
        eventId={eventId}
        tenantSlug={tenantSlug}
        logoUrl={logoUrl}
        testID={`${testID}-logo`}
      />
    </View>
  );
}
