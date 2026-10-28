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
  eventIdentityColor,
  eventInitial,
} from '@/brand/event-identity';
import {
  hasDemoMediaForEventId,
  hasDemoMediaForTenantSlug
} from '@/data/demo-media';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';
import { space, radius } from '@/theme/tokens';
import {
  demoBannerSource,
  demoLogoSource,
} from '@/data/demo-media-assets';
import { EVENT_BANNER_HEIGHT_LIST } from './event-banner-metrics.ts';

type BannerProps = {
  /** Fixture / published event id for local demo pack lookup + hash fallback. */
  eventId?: string | null;
  tenantSlug?: string | null;
  /** Published remote banner (https only). */
  bannerUrl?: string | null;
  /** Override local/remote with an explicit source. */
  bannerSource?: ImageSourcePropType | null;
  /** This event's primary color — never another card's brand. */
  fallbackColor?: string | null;
  /** Event name (or org) used for the solid-fallback monogram. */
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

function EventBrandFallback({
  eventId,
  height,
  fallbackColor,
  wordmark,
  testID,
  accessibilityLabel,
  style,
}: {
  eventId?: string | null;
  height: number;
  fallbackColor?: string | null;
  wordmark?: string | null;
  testID?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = eventIdentityColor(eventId?.trim() || 'event', fallbackColor);
  const initial = eventInitial(wordmark?.trim() || '');
  const fontSize = Math.max(28, Math.min(Math.round(height * 0.42), 64));

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
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.35}
        style={{
          ...typography.display,
          fontFamily: fontFamilies.display,
          fontSize,
          lineHeight: Math.round(fontSize * 1.1),
          fontWeight: '700',
          color: colors.onAccent,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

/**
 * Simple per-event banner: image if this event has one, else a solid brand
 * fill + large initial from THIS event — not catalog-wide Vemoki chrome.
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
        eventId={eventId}
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
