import type { ReactNode } from 'react';
import { SiteNav } from '../../src/site-chrome';
import {
  accountCols,
  accountMainCol,
  accountPageLead,
  accountPageMain,
  accountPageTitle,
} from '../../src/account/account-flow-surface';
import { AccountNav, type AccountNavSection } from './account-nav';

type AccountShellProps = {
  active: AccountNavSection;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
};

export function AccountShell({
  active,
  title,
  lead,
  children,
}: AccountShellProps) {
  return (
    <main id="main" className={accountPageMain}>
      <SiteNav />
      <header>
        <h1 className={accountPageTitle}>{title}</h1>
        {lead ? <p className={accountPageLead}>{lead}</p> : null}
      </header>
      <div className={accountCols}>
        <AccountNav active={active} />
        <div className={accountMainCol}>{children}</div>
      </div>
    </main>
  );
}
