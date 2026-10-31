'use client';

import { Alert, Button, Empty, Flex, Form, Input, InputNumber, Modal, Spin, Table, Typography } from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../client/use-actor-state';
import { portalGet, portalMutate } from '../client/portal-fetch';
import { usePortalLocale } from '../i18n';
import { bffEventAction } from '../prep/bff-urls';
import {
  GATE_NAME_MAX,
  GATE_SORT_MAX,
  interpretGateCreate,
  parseGateForm,
  parseGateList,
  type PortalGate,
} from './gates';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';

/** O32 — organizer gate list + create (rename/delete not in API). */
export function GatesPanel({
  tenantId,
  eventId,
  canCreate,
}: {
  tenantId: string;
  eventId: string;
  canCreate: boolean;
}) {
  const { t } = usePortalLocale();
  const [gates, setGates] = useState<PortalGate[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sort, setSort] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await portalGet(bffEventAction(tenantId, eventId, 'gates'));
    if (res.status === 403) return setState('forbidden');
    const list = res.status === 200 ? parseGateList(res.json) : null;
    if (!list) return setState('error');
    setGates(list);
    setState('ready');
  }, [tenantId, eventId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const submit = async () => {
    const parsed = parseGateForm(name, sort);
    if (!parsed.ok) {
      setFormError(t(parsed.error));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'gates'),
        parsed.value,
      );
      const outcome = interpretGateCreate(
        res.status,
        res.json,
        res.networkError || res.timedOut,
      );
      if (outcome.kind === 'created') {
        setOpen(false);
        setName('');
        setSort(null);
        setNotice(t('gates.created'));
        await load();
      } else if (outcome.kind === 'conflict') {
        setFormError(t('gates.nameConflict'));
      } else if (outcome.kind === 'forbidden') {
        setFormError(t('gates.forbidden'));
      } else {
        setFormError(t('gates.createFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t('gates.title')} style={{ marginTop: 24 }}>
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('gates.title')}
        </Typography.Title>
        {canCreate ? (
          <Button
            type="primary"
            onClick={() => {
              setFormError(null);
              setOpen(true);
            }}
          >
            {t('gates.create')}
          </Button>
        ) : null}
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        {t('gates.hint')}
      </Typography.Paragraph>
      {notice ? (
        <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />
      ) : null}
      {state === 'loading' ? <Spin /> : null}
      {state === 'forbidden' ? (
        <Alert type="warning" showIcon message={t('gates.forbidden')} />
      ) : null}
      {state === 'error' ? (
        <Alert
          type="error"
          showIcon
          message={t('gates.loadFailed')}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('surface.action.retry')}
            </Button>
          }
        />
      ) : null}
      {state === 'ready' && gates.length === 0 ? (
        <Empty description={t('gates.empty')} />
      ) : null}
      {state === 'ready' && gates.length > 0 ? (
        <Table<PortalGate>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={gates}
          columns={[
            { title: t('gates.col.name'), dataIndex: 'name' },
            { title: t('gates.col.sort'), dataIndex: 'sortOrder', width: 120 },
          ]}
        />
      ) : null}
      <Modal
        title={t('gates.create')}
        open={open && canCreate}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={busy}
        okText={t('gates.create')}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={() => void submit()}>
          <Form.Item
            label={t('gates.nameLabel')}
            required
            validateStatus={formError ? 'error' : undefined}
            help={formError ?? undefined}
          >
            <Input
              value={name}
              maxLength={GATE_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Form.Item>
          <Form.Item label={t('gates.sortLabel')}>
            <InputNumber
              value={sort}
              min={0}
              max={GATE_SORT_MAX}
              precision={0}
              onChange={(v) => setSort(typeof v === 'number' ? v : null)}
              style={{ width: 160 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
