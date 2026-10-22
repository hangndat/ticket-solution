import type { LabelHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'ui:text-sm ui:font-semibold ui:text-ink ui:leading-none peer-disabled:ui:cursor-not-allowed peer-disabled:ui:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
