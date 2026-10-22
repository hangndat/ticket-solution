import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/** Placeholder block — CSS pulse only; safe for server render. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse motion-reduce:animate-none rounded-md bg-ink/10',
        className,
      )}
      {...props}
    />
  );
}
