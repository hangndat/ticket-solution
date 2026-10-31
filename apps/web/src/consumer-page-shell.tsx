import type { ComponentProps, ReactNode } from 'react';

/**
 * Consumer page frame. The persistent navigation is owned by the consumer layout.
 */
export function ConsumerPageShell({
  mainClassName,
  children,
  mainTestId,
  mainProps,
}: {
  mainClassName: string;
  children: ReactNode;
  mainTestId?: string;
  mainProps?: Partial<ComponentProps<'main'>>;
}) {
  return (
      <main
        id="main"
        className={mainClassName}
        data-testid={mainTestId}
        {...mainProps}
      >
        {children}
      </main>
  );
}
