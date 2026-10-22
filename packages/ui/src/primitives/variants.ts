import { cva } from 'class-variance-authority';

/** Shared focus ring — Live Pulse v2 token `--color-focus` (3px). */
export const focusRingClass =
  'ui:focus-visible:outline-none ui:focus-visible:ring-[3px] ui:focus-visible:ring-focus ui:focus-visible:ring-offset-2 ui:focus-visible:ring-offset-paper';

export const buttonVariants = cva(
  [
    'ui:inline-flex ui:items-center ui:justify-center ui:gap-2 ui:font-semibold ui:rounded-md ui:transition-[color,opacity,background-color,border-color] ui:duration-150',
    'ui:disabled:pointer-events-none ui:disabled:opacity-50',
    'ui:aria-[busy=true]:cursor-wait',
    focusRingClass,
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'ui:bg-signal ui:text-white ui:hover:opacity-95',
        secondary:
          'ui:border ui:border-ink/20 ui:bg-white ui:text-ink ui:hover:border-ink/40 ui:hover:bg-paper',
        ghost: 'ui:bg-transparent ui:text-ink ui:hover:bg-ink/5',
        destructive: 'ui:bg-destructive ui:text-white ui:hover:opacity-95',
      },
      size: {
        sm: 'ui:min-h-11 ui:px-3 ui:text-sm',
        md: 'ui:min-h-11 ui:px-4 ui:text-[0.95rem]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export const inputVariants = cva(
  [
    'ui:w-full ui:min-h-11 ui:rounded-md ui:border ui:bg-white ui:px-3 ui:text-ink',
    'ui:placeholder:text-ink/45',
    'ui:disabled:cursor-not-allowed ui:disabled:opacity-50',
    focusRingClass,
  ].join(' '),
  {
    variants: {
      state: {
        default: 'ui:border-line',
        error: 'ui:border-destructive ui:aria-invalid:border-destructive',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
);

export const alertVariants = cva(
  'ui:grid ui:gap-2 ui:rounded-md ui:border ui:p-4 ui:text-sm',
  {
    variants: {
      variant: {
        default: 'ui:border-line ui:bg-paper ui:text-ink',
        destructive:
          'ui:border-destructive/40 ui:bg-destructive/10 ui:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export const cardVariants = cva('ui:rounded-md ui:border ui:bg-white ui:text-ink', {
  variants: {
    variant: {
      elevated: 'ui:border-line ui:shadow-sm',
      outline: 'ui:border-line ui:shadow-none',
    },
  },
  defaultVariants: {
    variant: 'elevated',
  },
});
