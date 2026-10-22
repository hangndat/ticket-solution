import type { HTMLAttributes } from 'react';
import { cn, usesLegacyChromeClass } from '../cn.js';
import { cardVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  const legacy = usesLegacyChromeClass(className);
  return (
    <div className={cn(!legacy && cardVariants({ variant }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const legacy = usesLegacyChromeClass(className);
  return (
    <div
      className={cn(!legacy && 'flex flex-col gap-1.5 p-5 pb-0', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const legacy = usesLegacyChromeClass(className);
  return (
    <h3
      className={cn(
        !legacy && 'font-display text-lg font-bold tracking-tight text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const legacy = usesLegacyChromeClass(className);
  return <p className={cn(!legacy && 'text-sm text-ink/70', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const legacy = usesLegacyChromeClass(className);
  return <div className={cn(!legacy && 'p-5 pt-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const legacy = usesLegacyChromeClass(className);
  return (
    <div className={cn(!legacy && 'flex items-center p-5 pt-0', className)} {...props} />
  );
}
