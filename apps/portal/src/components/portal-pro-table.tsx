'use client';

import type { ProColumns, ProTableProps } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button } from 'antd';
import type { ReactNode } from 'react';
import { usePortalLocale } from '../i18n';

export type { ProColumns };

type CursorTableProps<T extends Record<string, unknown>> = {
  rowKey: string;
  columns: ProColumns<T>[];
  dataSource: T[];
  loading?: boolean;
  nextCursor: string | null;
  onLoadMore: (cursor: string) => void;
  toolBarRender?: ProTableProps<T, Record<string, unknown>>['toolBarRender'];
  search?: false;
  headerTitle?: ReactNode;
};

/** ProTable for static data + manual cursor "load more" (BFF nextCursor). */
export function PortalCursorProTable<T extends Record<string, unknown>>({
  rowKey,
  columns,
  dataSource,
  loading,
  nextCursor,
  onLoadMore,
  toolBarRender,
  search = false,
  headerTitle,
}: CursorTableProps<T>) {
  const { t } = usePortalLocale();

  return (
    <>
      <ProTable<T>
        rowKey={rowKey}
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        search={search}
        options={false}
        pagination={false}
        toolBarRender={toolBarRender}
        headerTitle={headerTitle}
      />
      {nextCursor ? (
        <Button style={{ marginTop: 12 }} onClick={() => onLoadMore(nextCursor)}>
          {t('sources.h_1w8bpuo')}
        </Button>
      ) : null}
    </>
  );
}
