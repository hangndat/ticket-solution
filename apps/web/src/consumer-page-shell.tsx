import type { ComponentProps, ReactNode } from 'react';

/**
 * Consumer page frame — header lives in app/(consumer)/layout.tsx (stable across routes).
 * Main stays outside padded chrome so sticky header alignment is consistent (UA-WEB-02).
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
