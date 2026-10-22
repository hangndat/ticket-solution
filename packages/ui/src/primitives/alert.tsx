import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';
import { alertVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    title?: string;
  };

export function Alert({ className, variant, title, children, role = 'status', ...props }: AlertProps) {
  const resolvedRole = variant === 'destructive' ? 'alert' : role;
  return (
    <div
      role={resolvedRole}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {title ? <strong className="ui:font-semibold">{title}</strong> : null}
      {children ? <div className="ui:text-sm ui:leading-relaxed">{children}</div> : null}
    </div>
  );
}
