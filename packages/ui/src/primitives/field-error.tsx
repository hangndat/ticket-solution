import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type FieldErrorProps = HTMLAttributes<HTMLParagraphElement> & {
  id?: string;
};

/** Inline field validation message — `role="alert"` for screen readers. */
export function FieldError({ className, id, children, ...props }: FieldErrorProps) {
  if (children == null || children === '') {
    return null;
  }
  return (
    <p
      id={id}
      role="alert"
      className={cn('ui:mt-1.5 ui:text-sm ui:font-medium ui:text-destructive', className)}
      {...props}
    >
      {children}
    </p>
  );
}
