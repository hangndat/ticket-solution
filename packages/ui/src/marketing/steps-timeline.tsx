import { cn } from '../cn.js';

export type StepTimelineItem = {
  id: string;
  label: string;
  visualVariant: 1 | 2 | 3 | 4 | 5;
};

export type StepsTimelineProps = {
  steps: StepTimelineItem[];
  className?: string;
};

const stepVisualClass: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-ink)_12%,transparent),transparent)]',
  2: 'bg-paper',
  3: 'bg-[repeating-linear-gradient(0deg,var(--color-line),var(--color-line)_1px,transparent_1px,transparent_8px),repeating-linear-gradient(90deg,var(--color-line),var(--color-line)_1px,transparent_1px,transparent_8px)]',
  4: 'bg-gradient-to-br from-ink to-muted',
  5: 'bg-gradient-to-b from-signal/50 via-signal/15 to-focus/35',
};

export function StepsTimeline({ steps, className }: StepsTimelineProps) {
  return (
    <ol
      className={cn(
        'relative mt-10 grid gap-5 lg:grid-cols-5 lg:gap-3',
        'lg:before:absolute lg:before:top-5 lg:before:right-[10%] lg:before:left-[10%] lg:before:z-0 lg:before:h-px lg:before:bg-gradient-to-r lg:before:from-line lg:before:via-signal lg:before:to-line',
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            'relative z-[1] rounded-md border border-line bg-paper p-4 max-lg:grid max-lg:grid-cols-[44px_1fr] max-lg:gap-x-3.5 max-lg:gap-y-2.5',
            'lg:border-0 lg:bg-transparent lg:p-0 lg:px-2 lg:text-center',
          )}
        >
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-full border-2 border-line bg-paper font-display text-base font-bold text-ink shadow-sm',
              'lg:mx-auto lg:mb-4',
            )}
            aria-hidden="true"
          >
            {index + 1}
          </div>
          <p
            className={cn(
              'm-0 self-center text-[0.85rem] leading-snug text-muted',
              'lg:mb-0',
            )}
          >
            {step.label}
          </p>
          <div
            className={cn(
              'relative col-span-2 mt-2 h-16 overflow-hidden rounded-sm border border-line',
              stepVisualClass[step.visualVariant],
              'lg:col-span-1 lg:mt-3 lg:h-14',
            )}
            aria-hidden="true"
          />
        </li>
      ))}
    </ol>
  );
}
