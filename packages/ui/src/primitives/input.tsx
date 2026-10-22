import type { InputHTMLAttributes } from 'react';
import { cn, usesLegacyChromeClass } from '../cn.js';
import { inputVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants> & {
    /** When true, sets `aria-invalid` and error border styles. */
    error?: boolean;
  };

export function Input({
  className,
  state,
  error = false,
  disabled,
  ...props
}: InputProps) {
  const resolvedState = error ? 'error' : state;
  const legacy = usesLegacyChromeClass(className);
  return (
    <input
      className={cn(!legacy && inputVariants({ state: resolvedState }), className)}
      disabled={disabled}
      aria-invalid={error || undefined}
      data-error={error ? '' : undefined}
      {...props}
    />
  );
}
