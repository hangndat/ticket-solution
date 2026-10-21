import type { ReactNode } from 'react';
import { SiteNav } from '../../src/site-chrome';
import { AccountNav, type AccountNavSection } from './account-nav';
import styles from './account-settings.module.css';

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
    <main id="main" className="container shell account-page">
      <SiteNav />
      <header>
        <h1 className={styles.pageTitle}>{title}</h1>
        {lead ? <p className={styles.pageLead}>{lead}</p> : null}
      </header>
      <div className={styles.accountCols}>
        <AccountNav active={active} />
        <div className={styles.accountMain}>{children}</div>
      </div>
    </main>
  );
}
