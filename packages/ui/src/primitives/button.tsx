import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn.js';
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
      className="ui:size-4 ui:shrink-0 ui:animate-spin motion-reduce:ui:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="ui:opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="ui:opacity-75"
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

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      {...props}
    >
      {content}
    </button>
  );
}
