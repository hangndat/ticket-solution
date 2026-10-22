export type StepTimelineItem = {
  id: string;
  label: string;
  visualVariant: 1 | 2 | 3 | 4 | 5;
};

export type StepsTimelineProps = {
  steps: StepTimelineItem[];
  className?: string;
};

export function StepsTimeline({ steps, className }: StepsTimelineProps) {
  return (
    <ol className={className ?? 'mkt-steps'}>
      {steps.map((step, index) => (
        <li key={step.id} className="mkt-step">
          <div className="mkt-step-num" aria-hidden="true">{index + 1}</div>
          <p>{step.label}</p>
          <div
            className={`mkt-step-visual mkt-step-visual--${step.visualVariant}`}
            aria-hidden="true"
          />
        </li>
      ))}
    </ol>
  );
}
