import { useEffect, useState } from 'react';
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
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { colors } from '@/theme/colors';
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
  /** Kept for callers; demo pack must NOT key off tenantSlug (published seed reuses fixture slugs). */
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
  /** Kept for callers; demo pack keys off fixture eventId only. */
  tenantSlug?: string | null;
  logoUrl?: string | null;
  logoSource?: ImageSourcePropType | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

/** Fixture event ids only — never tenantSlug (prod published seed shares mfest-demo / demo-studio). */
function bundledDemoSource(
  eventId?: string | null,
): { logo: ImageSourcePropType; banner: ImageSourcePropType } | null {
  if (hasDemoMediaForEventId(eventId)) {
    return { logo: demoLogoSource, banner: demoBannerSource };
  }
  return null;
}

function shortEventLabel(wordmark?: string | null): string | null {
  const name = wordmark?.trim();
  if (!name) return null;
  if (name.length <= 28) return name;
  return `${name.slice(0, 27)}…`;
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
  const label = shortEventLabel(wordmark);
  // Large monogram — distinctly not the old 22% wash + tiny caption wordmark.
  const fontSize = Math.max(40, Math.min(Math.round(height * 0.5), 72));

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
          paddingHorizontal: space.md,
          gap: space.xs,
        },
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          ...typography.display,
          fontFamily: fontFamilies.display,
          fontSize,
          lineHeight: Math.round(fontSize * 1.05),
          color: colors.onAccent,
          textAlign: 'center',
        }}
      >
        {initial}
      </Text>
      {label ? (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={{
            ...typography.subheadSemibold,
            fontFamily: fontFamilies.bodySemiBold,
            color: colors.onAccent,
            textAlign: 'center',
            opacity: 0.95,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Simple per-event banner: image if this event has one, else a solid brand
 * fill + large initial from THIS event — not catalog-wide Vemoki chrome.
 */
export function EventBanner({
  eventId,
  bannerUrl,
  bannerSource,
  fallbackColor,
  wordmark,
  height = EVENT_BANNER_HEIGHT_LIST,
  style,
  testID = 'event-banner',
  accessibilityLabel = 'Ảnh banner sự kiện'
}: BannerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const pack = bundledDemoSource(eventId);
  const source =
    bannerSource ?? remoteImageSource(bannerUrl) ?? pack?.banner ?? null;

  useEffect(() => {
    setImageFailed(false);
  }, [eventId, bannerUrl, bannerSource]);

  if (!source || imageFailed) {
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
      onError={() => setImageFailed(true)}
      style={[
        {
          height,
          width: '100%',
          borderRadius: radius.md,
          backgroundColor: fillPlaceholder(eventId, fallbackColor),
        },
        style,
      ]}
    />
  );
}

function fillPlaceholder(
  eventId?: string | null,
  fallbackColor?: string | null,
): string {
  return eventIdentityColor(eventId?.trim() || 'event', fallbackColor);
}

/**
 * Event / org logo lockup for cards and ticket chrome.
 */
export function EventLogo({
  eventId,
  logoUrl,
  logoSource,
  height = 36,
  style,
  testID = 'event-logo',
  accessibilityLabel = 'Logo sự kiện'
}: LogoProps) {
  const pack = bundledDemoSource(eventId);
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
