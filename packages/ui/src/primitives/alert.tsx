import type { HTMLAttributes } from 'react';
import { cn, usesLegacyChromeClass } from '../cn.js';
import { alertVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    title?: string;
  };

export function Alert({ className, variant, title, children, role = 'status', ...props }: AlertProps) {
  const resolvedRole = variant === 'destructive' ? 'alert' : role;
  const legacy = usesLegacyChromeClass(className);
  return (
    <div
      role={resolvedRole}
      className={cn(!legacy && alertVariants({ variant }), className)}
      {...props}
    >
      {title ? <strong className={legacy ? undefined : 'font-semibold'}>{title}</strong> : null}
      {children ? (
        <div className={legacy ? undefined : 'text-sm leading-relaxed'}>{children}</div>
      ) : null}
    </div>
  );
}
