export { cn } from './cn.js';

/** Live Pulse v2 canonical colors — mirrors brand/vemoki/tokens.json (no runtime JSON import). */
export const VEMOKI_BRAND_COLORS = {
  ink: '#0B1220',
  paper: '#F4F6F8',
  signal: '#E11D48',
  primary: '#7C4DED',
  focus: '#2563EB',
} as const;

export type VemokiBrandColorKey = keyof typeof VEMOKI_BRAND_COLORS;

export { Button, type ButtonProps } from './primitives/button.js';
export { Input, type InputProps } from './primitives/input.js';
export { Label, type LabelProps } from './primitives/label.js';
export { FieldError, type FieldErrorProps } from './primitives/field-error.js';
export {
  Alert,
  type AlertProps,
} from './primitives/alert.js';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
} from './primitives/card.js';
export {
  BentoGrid,
  BentoGridItem,
  type BentoGridItemProps,
  type BentoGridProps,
} from './primitives/bento-grid.js';
export { Skeleton, type SkeletonProps } from './primitives/skeleton.js';
export {
  SurfaceState,
  surfaceStateClass,
  type SurfaceStateKind,
  type SurfaceStateProps,
} from './primitives/surface-state.js';
export { DemoBadge, type DemoBadgeProps } from './primitives/demo-badge.js';
export {
  DemoDataBanner,
  type DemoDataBannerProps,
} from './primitives/demo-data-banner.js';
export { FilterChip, type FilterChipProps } from './primitives/filter-chip.js';
export {
  CatalogHeroBand,
  type CatalogHeroBandProps,
} from './primitives/catalog-hero-band.js';
export {
  CatalogSkeletonGrid,
  type CatalogSkeletonGridProps,
} from './primitives/catalog-skeleton-grid.js';
export {
  buttonVariants,
  inputVariants,
  alertVariants,
  cardVariants,
  focusRingClass,
} from './primitives/variants.js';
export {
  ProductPreviewFrame,
  type ProductPreviewFrameProps,
  type ProductPreviewLabels,
} from './marketing/product-preview-frame.js';
export {
  StepsTimeline,
  type StepsTimelineProps,
  type StepTimelineItem,
} from './marketing/steps-timeline.js';
export {
  DemoMetric,
  type DemoMetricProps,
} from './marketing/demo-metric.js';
