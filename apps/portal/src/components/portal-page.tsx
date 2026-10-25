'use client';

import { PageContainer } from '@ant-design/pro-components';
import type { PageContainerProps } from '@ant-design/pro-components';
import type { ReactNode } from 'react';

function PortalPageTitle({ title }: { title: ReactNode }) {
  if (typeof title !== 'string') return title;
  return <span className="portal-page-title">{title}</span>;
}

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
      title={title != null ? <PortalPageTitle title={title} /> : title}
      subTitle={subTitle}
      extra={extra}
      loading={loading}
      ghost={ghost}
      footer={footer}
      breadcrumb={breadcrumb}
      tabList={tabList}
      onTabChange={onTabChange}
      stylish={(token) => ({
        [`${token.componentCls}-warp-page-header`]: {
          [`${token.antCls}-page-header-heading-left`]: {
            overflow: 'visible',
            flex: '1 1 auto',
            maxWidth: 'none',
          },
          [`${token.antCls}-page-header-heading-title`]: {
            overflow: 'visible',
            whiteSpace: 'normal',
            textOverflow: 'clip',
            wordBreak: 'break-word',
            width: 'auto',
            maxWidth: 'none',
            lineHeight: 1.35,
          },
          [`${token.antCls}-page-header-heading-sub-title`]: {
            overflow: 'visible',
            whiteSpace: 'normal',
            textOverflow: 'clip',
            wordBreak: 'break-word',
            width: 'auto',
            maxWidth: 'none',
          },
        },
      })}
    >
      {children}
    </PageContainer>
  );
}
