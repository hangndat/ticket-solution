'use client';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  List,
  Modal,
  Space,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConfigVersionSummary, EventDetail } from '@ticket/contracts';
import { gateDeeplinkUrl } from '../../../../../src/oidc/config';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../src/client/portal-fetch';
import { bffEvent, bffEventAction } from '../../../../../src/prep/bff-urls';
import {
  derivePrepReadiness,
  readinessAllOk,
  readinessSummary,
} from '../../../../../src/prep/readiness';
import { useEventAccess } from '../../../../../src/prep/use-event-access';
import {
  GateDeeplinkButton,
  GateStayAppNotice,
} from '../../../../../src/components/gate-deeplink';
import { SurfaceState } from '../../../../../src/components/surface-state';

type ReportSnapshot = {
  asOf?: string;
  quota?: { capacity: number | null; allocated: number };
  pendingApprovalCount?: number;
  checkInSuccessCount?: number;
};

export default function EventOverviewPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [report, setReport] = useState<ReportSnapshot | null>(null);
  const [typesCount, setTypesCount] = useState(0);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [hasBrand, setHasBrand] = useState(false);
  const [hasTerms, setHasTerms] = useState(false);
  const [loadKind, setLoadKind] = useState<
    'loading' | 'ready' | 'error' | 'unknown'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoadKind('loading');
    const [d, r, t, s, c] = await Promise.all([
      portalGet(bffEvent(tenantId, eventId)),
      portalGet(bffEventAction(tenantId, eventId, 'report')),
      portalGet(`${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=20`),
      portalGet(`${bffEventAction(tenantId, eventId, 'sources')}?limit=20`),
      portalGet(bffEventAction(tenantId, eventId, 'config-versions')),
    ]);

    if (
      d.networkError ||
      d.timedOut ||
      d.status >= 500 ||
      d.status === 0
    ) {
      setLoadKind('unknown');
      setMessage('Chưa rõ kết quả tải sự kiện.');
      return;
    }
    if (d.status !== 200 || !d.json || typeof d.json !== 'object') {
      setLoadKind('error');
      setMessage(apiErrorMessage(d.json, `HTTP ${d.status}`));
      return;
    }
    setDetail(d.json as EventDetail);

    if (r.status === 200 && r.json && typeof r.json === 'object') {
      setReport(r.json as ReportSnapshot);
    } else {
      setReport(null);
    }

    const tItems =
      t.status === 200 &&
      t.json &&
      typeof t.json === 'object' &&
      Array.isArray((t.json as { items?: unknown }).items)
        ? ((t.json as { items: unknown[] }).items as unknown[])
        : [];
    const sItems =
      s.status === 200 &&
      s.json &&
      typeof s.json === 'object' &&
      Array.isArray((s.json as { items?: unknown }).items)
        ? ((s.json as { items: unknown[] }).items as unknown[])
        : [];
    setTypesCount(tItems.length);
    setSourcesCount(sItems.length);

    if (c.status === 200 && c.json && typeof c.json === 'object') {
      const items = Array.isArray((c.json as { items?: unknown }).items)
        ? ((c.json as { items: ConfigVersionSummary[] }).items as ConfigVersionSummary[])
        : [];
      const published = items.find((i) => i.published);
      setPublishedVersion(published?.version ?? null);
      setDraftVersion(items[0]?.version ?? null);
      if (items[0]) {
        const preview = await portalGet(
          `${bffEventAction(tenantId, eventId, 'config-versions')}/${items[0].version}/preview`,
        );
        if (
          preview.status === 200 &&
          preview.json &&
          typeof preview.json === 'object'
        ) {
          const payload = (preview.json as { payload?: unknown }).payload;
          if (payload && typeof payload === 'object') {
            const brand = (payload as { brand?: { organizationName?: string; primaryColor?: string } })
              .brand;
            setHasBrand(
              Boolean(
                brand?.organizationName?.trim() && brand?.primaryColor?.trim(),
              ),
            );
            const sections = (payload as { sections?: Array<{ kind: string; body?: Record<string, unknown> }> })
              .sections;
            const terms = sections?.find((sec) => sec.kind === 'terms');
            const body = terms?.body ?? {};
            setHasTerms(
              Boolean(
                (typeof body.termsVersion === 'string' &&
                  body.termsVersion.trim()) ||
                  (typeof body.text === 'string' && body.text.trim()) ||
                  published,
              ),
            );
          }
        }
      }
    }

    setLoadKind('ready');
  }, [tenantId, eventId]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

  const readiness = useMemo(
    () =>
      derivePrepReadiness({
        hasEventContext: true,
        hasTicketType: typesCount > 0,
        hasSource: sourcesCount > 0,
        quotaKnown: report?.quota !== undefined,
        quotaCapacity: report?.quota?.capacity ?? null,
        hasTermsOrPublished: hasTerms || publishedVersion != null,
        hasBrand,
      }),
    [typesCount, sourcesCount, report, hasTerms, publishedVersion, hasBrand],
  );
  const canPublish =
    readinessAllOk(readiness) &&
    draftVersion != null &&
    access.kind === 'ready' &&
    access.permissions.includes('config.publish');

  async function publish() {
    if (draftVersion == null) return;
    Modal.confirm({
      title: 'Xuất bản cấu hình sự kiện?',
      content: (
        <Space direction="vertical">
          <Typography.Text>
            Publish khóa phiên bản cấu hình (expectedVersion {draftVersion}).
          </Typography.Text>
          <Alert
            type="warning"
            showIcon
            message="Publish ≠ mở redeem ≠ mở Gate"
            description="Xuất bản nội dung không tự mở cửa sổ redeem cho khách và không bật cổng quét. Gate scan vẫn trên app.vemoki.com."
          />
        </Space>
      ),
      okText: 'Xuất bản',
      cancelText: 'Huỷ',
      onOk: async () => {
        setBusy(true);
        setNotice(null);
        try {
          const res = await portalMutate(
            bffEventAction(tenantId, eventId, 'publish'),
            { expectedVersion: draftVersion },
          );
          if (res.networkError || res.timedOut || res.status >= 500) {
            setNotice(
              'Chưa rõ kết quả xuất bản — không đánh dấu thành công. Kiểm tra lại.',
            );
            return;
          }
          if (res.status >= 200 && res.status < 300) {
            setNotice('Đã xuất bản cấu hình (publish content).');
            void load();
            return;
          }
          setNotice(apiErrorMessage(res.json, `Publish thất bại (${res.status}).`));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (access.kind === 'loading' || loadKind === 'loading') {
    return <SurfaceState kind="loading" />;
  }
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Sự kiện không nằm trong khám phá máy chủ của bạn."
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (loadKind === 'unknown') {
    return (
      <Alert
        type="warning"
        showIcon
        message="Chưa rõ kết quả"
        description={message}
        action={
          <Button size="small" onClick={() => void load()}>
            Kiểm tra lại
          </Button>
        }
      />
    );
  }
  if (loadKind === 'error' || !detail) {
    return (
      <SurfaceState
        kind="error"
        description={message}
        onRetry={() => void load()}
      />
    );
  }

  const canScan = access.permissions.includes('gate.confirm');
  const canReport = access.permissions.includes('report.read');

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {detail.name}
        </Typography.Title>
        <Space>
          <Link href={`/t/${tenantId}/e/${eventId}/setup`}>
            <Button>Chuẩn bị</Button>
          </Link>
          <Link href={`/t/${tenantId}/e/${eventId}/config`}>
            <Button>Cấu hình</Button>
          </Link>
          <Button
            type="primary"
            disabled={!canPublish || busy}
            loading={busy}
            onClick={() => void publish()}
            title={
              canPublish
                ? undefined
                : readinessSummary(readiness)
            }
          >
            Xuất bản
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        message="Publish ≠ redeem ≠ Gate"
        description="Xuất bản cấu hình không mở redeem cho khách và không thay cổng quét. Gate scan: app.vemoki.com/gate."
      />

      <Card size="small" title="Trạng thái">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Slug">{detail.slug}</Descriptions.Item>
          <Descriptions.Item label="Nội dung">
            {detail.contentStatus}
          </Descriptions.Item>
          <Descriptions.Item label="Nghiệp vụ">
            {detail.businessStatus}
          </Descriptions.Item>
          <Descriptions.Item label="Hiển thị">
            {detail.visibility}
          </Descriptions.Item>
          <Descriptions.Item label="Revision">{detail.revision}</Descriptions.Item>
          <Descriptions.Item label="Config đã publish">
            {publishedVersion ?? '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="Sẵn sàng xuất bản">
        <Typography.Paragraph type="secondary">
          {readinessSummary(readiness)}
        </Typography.Paragraph>
        <List
          size="small"
          dataSource={readiness}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={`${item.label}: ${item.status}`}
                description={item.detail}
              />
            </List.Item>
          )}
        />
      </Card>

      {report ? (
        <Card
          size="small"
          title="Báo cáo nhanh (O12)"
          extra={
            report.asOf ? (
              <Typography.Text type="secondary">asOf {report.asOf}</Typography.Text>
            ) : null
          }
        >
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Quota allocated">
              {report.quota?.allocated ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Capacity">
              {report.quota?.capacity === null
                ? '∞'
                : (report.quota?.capacity ?? '—')}
            </Descriptions.Item>
            <Descriptions.Item label="Pending duyệt">
              {report.pendingApprovalCount ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in OK">
              {report.checkInSuccessCount ?? '—'}
            </Descriptions.Item>
          </Descriptions>
          <Button size="small" onClick={() => void load()}>
            Làm mới
          </Button>
        </Card>
      ) : canReport ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa tải được báo cáo — không giả định số liệu xanh."
        />
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}

      {canScan ? (
        <div>
          <GateStayAppNotice />
          <div style={{ marginTop: 12 }}>
            <GateDeeplinkButton href={gateDeeplinkUrl()} />
          </div>
        </div>
      ) : null}

      {canReport ? (
        <Typography.Paragraph>
          Báo cáo cổng chi tiết:{' '}
          <Link href={`/t/${tenantId}/e/${eventId}/gate`}>mở Cổng (report)</Link>
          — không gắn camera trên portal.
        </Typography.Paragraph>
      ) : null}
    </Space>
  );
}
