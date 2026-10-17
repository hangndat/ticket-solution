import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled D9 demo raster assets (copied from brand/vemoki into assets/demo/).
 * Keep require() here so Node unit tests can import demo-media.ts without Metro.
 */
export const demoLogoSource: ImageSourcePropType = require('../../assets/demo/logo.png');
export const demoBannerSource: ImageSourcePropType = require('../../assets/demo/banner.png');
