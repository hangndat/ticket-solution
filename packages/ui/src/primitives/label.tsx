import type { LabelHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'ui:text-sm ui:font-semibold ui:text-ink ui:leading-none ui:peer-disabled:cursor-not-allowed ui:peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
