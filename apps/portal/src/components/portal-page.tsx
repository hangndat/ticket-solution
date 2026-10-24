'use client';

import { PageContainer } from '@ant-design/pro-components';
import type { PageContainerProps } from '@ant-design/pro-components';
import type { ReactNode } from 'react';

export type PortalPageProps = {
  title?: ReactNode;
  subTitle?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  ghost?: boolean;
  children: ReactNode;
  footer?: PageContainerProps['footer'];
} & Pick<PageContainerProps, 'breadcrumb' | 'tabList' | 'onTabChange'>;

/** Page chrome: PageContainer + consistent padding for portal ops surfaces. */
export function PortalPage({
  title,
  subTitle,
  extra,
  loading,
  ghost,
  children,
  footer,
  breadcrumb,
  tabList,
  onTabChange,
}: PortalPageProps) {
  return (
    <PageContainer
      className="portal-page-container"
      title={title}
      subTitle={subTitle}
      extra={extra}
      loading={loading}
      ghost={ghost}
      footer={footer}
      breadcrumb={breadcrumb}
      tabList={tabList}
      onTabChange={onTabChange}
    >
      {children}
    </PageContainer>
  );
}
