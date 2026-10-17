'use client';

import { useState } from 'react';

type Props = {
  /** Allowlisted https or root-relative path — never render a broken glyph. */
  src: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  testId?: string;
};

/**
 * Fail-closed event media: missing/invalid/failed sources render nothing
 * instead of a broken-image glyph.
 */
export function SafeEventImage({
  src,
  alt,
  className,
  width,
  height,
  testId,
}: Props) {
  const [failed, setFailed] = useState(false);
  const usable =
    !failed && typeof src === 'string' && src.trim().length > 0
      ? src.trim()
      : null;

  if (!usable) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- demo/tenant URLs are allowlisted https or root-relative
    <img
      className={className}
      src={usable}
      alt={alt}
      width={width}
      height={height}
      data-testid={testId}
      onError={() => setFailed(true)}
    />
  );
}
