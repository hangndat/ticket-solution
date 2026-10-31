'use client';

import {
  Alert,
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { useActorState as useState } from '../client/use-actor-state';
import { usePortalLocale } from '../i18n';
import type { SavedViewRecord, SavedViewScope, SavedViewSort } from './types';
import { useSavedViews, type ActiveFilters } from './use-saved-views';
import type { SavedViewSurface } from './types';

type Props = {
  tenantId: string;
  eventId?: string | null;
  surface: SavedViewSurface;
  /** Current chip filters from the list toolbar. */
  filters: ActiveFilters;
  sort?: SavedViewSort | null;
  columns?: string[];
  /** Apply restored filters back onto the parent list. */
  onApply: (next: {
    filters: Record<string, string>;
    sort: SavedViewSort | null;
    columns: string[];
  }) => void;
};

export function SavedViewsToolbar({
  tenantId,
  eventId = null,
  surface,
  filters,
  sort = null,
  columns = [],
  onApply,
}: Props) {
  const { t } = usePortalLocale();
  const {
    ready,
    views,
    defaultView,
    activeViewId,
    stale,
    saveView,
    applyView,
    removeView,
    markDefault,
    clearStale,
  } = useSavedViews({ tenantId, eventId, surface });

  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (!ready || appliedDefaultRef.current || !defaultView) return;
    appliedDefaultRef.current = true;
    const applied = applyView(defaultView);
    onApply({
      filters: applied.filters,
      sort: applied.sort,
      columns: applied.columns,
    });
  }, [ready, defaultView, applyView, onApply]);

  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    scope: SavedViewScope;
    isDefault: boolean;
  }>();

  const activeLabel = useMemo(() => {
    const active = views.find((v) => v.id === activeViewId);
    if (active) return active.name;
    return t('views.menu.default');
  }, [views, activeViewId, t]);

  function handleSelect(view: SavedViewRecord) {
    const applied = applyView(view);
    onApply({
      filters: applied.filters,
      sort: applied.sort,
      columns: applied.columns,
    });
  }

  function handleReset() {
    clearStale();
    onApply({ filters: {}, sort: null, columns: [] });
  }

  async function submitSave() {
    const values = await form.validateFields();
    const record = saveView({
      name: values.name,
      scope: values.scope,
      filters,
      sort,
      columns,
      isDefault: values.isDefault,
    });
    if (record) {
      setSaveOpen(false);
      form.resetFields();
    }
  }

  const viewMenuItems: NonNullable<MenuProps['items']> = [
    {
      key: 'builtin-default',
      label: t('views.menu.default'),
      onClick: () => handleReset(),
    },
  ];
  if (views.length > 0) {
    viewMenuItems.push({ type: 'divider' });
    for (const v of views) {
      viewMenuItems.push({
        key: v.id,
        label: v.isDefault
          ? `${v.name} · ${t('views.badge.default')}`
          : v.name,
        onClick: () => handleSelect(v),
      });
    }
  }
  viewMenuItems.push(
    { type: 'divider' },
    {
      key: 'save',
      label: t('views.action.save'),
      disabled: !ready,
      onClick: () => {
        form.setFieldsValue({
          name: '',
          scope: eventId ? 'event' : 'org',
          isDefault: false,
        });
        setSaveOpen(true);
      },
    },
    {
      key: 'manage',
      label: t('views.action.manage'),
      disabled: !ready || views.length === 0,
      onClick: () => setManageOpen(true),
    },
    {
      key: 'automation',
      label: t('views.action.automationSoon'),
      onClick: () => setAutomationOpen(true),
    },
  );

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Space wrap align="center">
        <Dropdown menu={{ items: viewMenuItems }} trigger={['click']}>
          <Button aria-label={t('views.toolbar.aria')}>
            {t('views.toolbar.label')} · {activeLabel} ▾
          </Button>
        </Dropdown>
        <Button
          onClick={() => {
            form.setFieldsValue({
              name: '',
              scope: eventId ? 'event' : 'org',
              isDefault: false,
            });
            setSaveOpen(true);
          }}
          disabled={!ready}
        >
          {t('views.action.saveShort')}
        </Button>
        <Button
          type="text"
          disabled={!ready || views.length === 0}
          onClick={() => setManageOpen(true)}
          aria-label={t('views.action.manage')}
        >
          ⋯
        </Button>
      </Space>
      {stale ? (
        <Alert
          type="warning"
          showIcon
          message={t('views.stale.title')}
          description={t('views.stale.body')}
          action={
            <Button size="small" onClick={handleReset}>
              {t('views.stale.reset')}
            </Button>
          }
        />
      ) : null}

      <Modal
        title={t('views.save.title')}
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={() => void submitSave()}
        okText={t('views.save.confirm')}
        cancelText={t('views.save.cancel')}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            scope: eventId ? 'event' : 'org',
            isDefault: false,
          }}
        >
          <Form.Item
            name="name"
            label={t('views.save.name')}
            rules={[
              { required: true, message: t('views.save.nameRequired') },
              { max: 80 },
            ]}
          >
            <Input maxLength={80} autoFocus />
          </Form.Item>
          <Form.Item name="scope" label={t('views.save.scope')}>
            <Radio.Group>
              <Radio value="event" disabled={!eventId}>
                {t('views.save.scopeEvent')}
              </Radio>
              <Radio value="org">{t('views.save.scopeOrg')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>{t('views.save.setDefault')}</Checkbox>
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('views.save.privateHint')}
          </Typography.Paragraph>
        </Form>
      </Modal>

      <Modal
        title={t('views.manage.title')}
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {views.length === 0 ? (
          <Typography.Text type="secondary">
            {t('views.manage.empty')}
          </Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {views.map((v) => (
              <Space
                key={v.id}
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <span>
                  {v.name}
                  {v.isDefault ? ` · ${t('views.badge.default')}` : ''}
                </span>
                <Space>
                  {!v.isDefault ? (
                    <Button size="small" onClick={() => markDefault(v.id)}>
                      {t('views.manage.setDefault')}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    danger
                    onClick={() => removeView(v.id)}
                  >
                    {t('views.manage.delete')}
                  </Button>
                </Space>
              </Space>
            ))}
          </Space>
        )}
      </Modal>

      <Modal
        title={t('views.automation.title')}
        open={automationOpen}
        onCancel={() => setAutomationOpen(false)}
        footer={
          <Button onClick={() => setAutomationOpen(false)}>
            {t('views.save.cancel')}
          </Button>
        }
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          message={t('views.automation.disabled')}
          description={t('views.automation.body')}
        />
      </Modal>
    </Space>
  );
}
