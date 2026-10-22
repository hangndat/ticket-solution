'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type FilterChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function FilterChip({
  active = false,
  className,
  type = 'button',
  ...props
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-3.5 py-2 text-[0.8rem] font-medium text-ink',
        'transition-[border-color,background] motion-reduce:transition-none',
        'focus-visible:outline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2',
        active &&
          'border-signal bg-[color-mix(in_srgb,var(--color-signal)_8%,var(--color-paper))] font-semibold text-[color-mix(in_srgb,var(--color-signal)_75%,var(--color-ink))]',
        className,
      )}
      aria-pressed={active}
      {...props}
    />
  );
}
