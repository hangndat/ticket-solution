import type { LabelHTMLAttributes } from 'react';
import { cn, usesLegacyChromeClass } from '../cn.js';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  const legacy = usesLegacyChromeClass(className);
  return (
    <label
      className={cn(
        !legacy &&
          'text-sm font-semibold text-ink leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
