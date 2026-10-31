import { m, type MotionStyle } from 'motion/react';
import { JOURNEY_PLATES, type JourneyPlateId } from './assets';

/**
 * Photographic plate (AVIF → WebP fallback), cover-fitted and pinned to a focal
 * point so portrait crops keep the subject. Decorative: empty alt.
 */
export function Plate({
  id,
  style,
  priority = false,
  className = '',
}: {
  id: JourneyPlateId;
  style?: MotionStyle;
  priority?: boolean;
  className?: string;
}) {
  const plate = JOURNEY_PLATES[id];
  const base = `/marketing/journey/${plate.file}`;
  const focus = `${plate.focus.x * 100}% ${plate.focus.y * 100}%`;
  return (
    <m.div
      className={`absolute inset-0 will-change-transform ${className}`}
      style={{ transformOrigin: focus, ...style }}
    >
      <picture>
        <source
          type="image/avif"
          srcSet={plate.widths.map((w) => `${base}-${w}.avif ${w}w`).join(', ')}
          sizes="max(100vw, 150dvh)"
        />
        <source
          type="image/webp"
          srcSet={plate.widths.map((w) => `${base}-${w}.webp ${w}w`).join(', ')}
          sizes="max(100vw, 150dvh)"
        />
        <img
          src={`${base}-${plate.widths.at(-1)}.webp`}
          alt=""
          width={plate.width}
          height={plate.height}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ objectPosition: focus }}
        />
      </picture>
    </m.div>
  );
}
