import {
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeEventImage } from './safe-event-image.tsx';
import { remoteImageSource } from './safe-event-image-url.ts';
import {
  hasDemoMediaForEventId,
  hasDemoMediaForTenantSlug,
} from '@/data/demo-media';
import {
  demoBannerSource,
  demoLogoSource,
} from '@/data/demo-media-assets';

type BannerProps = {
  /** Fixture / published event id for local demo pack lookup. */
  eventId?: string | null;
  tenantSlug?: string | null;
  /** Published remote banner (https only). */
  bannerUrl?: string | null;
  /** Override local/remote with an explicit source. */
  bannerSource?: ImageSourcePropType | null;
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

/**
 * Event banner: prefer explicit source → remote URL → bundled demo pack.
 * Fail-closed — never shows a broken image placeholder.
 */
export function EventBanner({
  eventId,
  tenantSlug,
  bannerUrl,
  bannerSource,
  height = 140,
  style,
  testID = 'event-banner',
  accessibilityLabel = 'Ảnh banner sự kiện',
}: BannerProps) {
  const pack = bundledDemoSource(eventId, tenantSlug);
  const source =
    bannerSource ?? remoteImageSource(bannerUrl) ?? pack?.banner ?? null;

  return (
    <SafeEventImage
      source={source}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      resizeMode="cover"
      style={[
        {
          height,
          width: '100%',
          borderRadius: 12,
          backgroundColor: 'transparent',
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
  accessibilityLabel = 'Logo sự kiện',
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
          backgroundColor: 'transparent',
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
  style,
  testID = 'event-media',
}: {
  eventId?: string | null;
  tenantSlug?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[{ gap: 10 }, style]} testID={testID}>
      <EventBanner
        eventId={eventId}
        tenantSlug={tenantSlug}
        bannerUrl={bannerUrl}
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
