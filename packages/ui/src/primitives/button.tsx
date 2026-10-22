import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn, usesLegacyChromeClass } from '../cn.js';
import { buttonVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingLabel?: string;
  };

function ButtonSpinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  loadingLabel = 'Đang xử lý…',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  let content: ReactNode = children;
  if (loading) {
    content = (
      <>
        <ButtonSpinner />
        <span>{loadingLabel}</span>
      </>
    );
  }

  const legacy = usesLegacyChromeClass(className);
  return (
    <button
      type={type}
      className={cn(!legacy && buttonVariants({ variant, size }), className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      {...props}
    >
      {content}
    </button>
  );
}
