'use client';

import { useMemo } from 'react';
import { encodeQrModules } from './qr-matrix';

type Props = {
  value: string;
  /** Accessible name — required (AC-T1). */
  label: string;
  size?: number;
  quietZone?: number;
  testId?: string;
};

/**
 * SVG QR matrix for owner ticket display (vendored uqr — no lockfile dep).
 */
export function TicketQr({
  value,
  label,
  size = 220,
  quietZone = 2,
  testId = 'owner-ticket-qr',
}: Props) {
  const modules = useMemo(() => encodeQrModules(value), [value]);
  const dim = modules.length;
  const total = dim + quietZone * 2;
  const cell = size / total;

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      data-testid={testId}
      className="ticket-qr"
    >
      <title>{label}</title>
      <rect width={size} height={size} fill="#ffffff" />
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${y}-${x}`}
              x={(x + quietZone) * cell}
              y={(y + quietZone) * cell}
              width={cell}
              height={cell}
              fill="#0B1220"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
