import type { ComponentProps, ReactNode } from 'react';
import { SiteNav } from './site-chrome';

/**
 * Consumer page frame — SiteNav stays outside main so page shell padding does not
 * offset the sticky header (UA-WEB-02 / O22 shell boundary).
 */
export function ConsumerPageShell({
  mainClassName,
  children,
  navTrailing,
  mainTestId,
  mainProps,
}: {
  mainClassName: string;
  children: ReactNode;
  navTrailing?: ReactNode;
  mainTestId?: string;
  mainProps?: Partial<ComponentProps<'main'>>;
}) {
  return (
    <>
      <SiteNav trailing={navTrailing} />
      <main
        id="main"
        className={mainClassName}
        data-testid={mainTestId}
        {...mainProps}
      >
        {children}
      </main>
    </>
  );
}
