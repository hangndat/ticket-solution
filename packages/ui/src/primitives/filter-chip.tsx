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
      className={cn('filter-chip', active && 'filter-chip--active', className)}
      aria-pressed={active}
      {...props}
    />
  );
}
