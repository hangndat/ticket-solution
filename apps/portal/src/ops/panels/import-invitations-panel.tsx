'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Space,
  Table,
  Typography,
  Upload,
} from 'antd';
import type { ImportKind } from '@ticket/contracts';
import { useState, type Key } from 'react';
import {
  portalDownload,
  portalGet,
  portalMultipart,
  portalMutate,
} from '../../client/portal-fetch';
import {
  bffImportJob,
  bffImports,
  bffImportsUpload,
  bffInvitationDispatchPreview,
  bffInvitations,
} from '../../prep/bff-urls';
import {
  csvTemplateFilename,
  csvTemplateForKind,
  importViewLabel,
  interpretImportCommit,
  interpretImportCreate,
  interpretImportErrorsDownload,
  interpretImportPreview,
  interpretImportStatus,
  interpretImportUpload,
  parseCsvForImport,
  type ImportView,
} from '../import-job';
import {
  interpretDispatch,
  interpretDispatchPreview,
  interpretInvitationList,
  invitationViewLabel,
  type InvitationView,
} from '../invitation';
import { usePortalLocale } from '../../i18n';

type Props = {
  tenantId: string;
  eventId: string;
  sourceId: string;
  ticketTypeId: string;
};

export function ImportInvitationsPanel({
  tenantId,
  eventId,
  sourceId,
  ticketTypeId,
}: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<ImportKind>('CODES');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [codeColumn, setCodeColumn] = useState('code');
  const [emailColumn, setEmailColumn] = useState('email');
  const [mappingRevision, setMappingRevision] = useState(1);
  const [importId, setImportId] = useState('');
  const [fileId, setFileId] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const [importView, setImportView] = useState<ImportView | null>(null);
  const [inviteView, setInviteView] = useState<InvitationView | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [dispatchPreviewRevision, setDispatchPreviewRevision] = useState<
    number | null
  >(null);

  function downloadTemplate() {
    const blob = new Blob([csvTemplateForKind(kind)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvTemplateFilename(kind);
    a.click();
    URL.revokeObjectURL(url);
    setNotice(t('ops.import.templateDownloaded', { filename: csvTemplateFilename(kind) }));
  }

  async function onFileChosen(file: File) {
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const parsed = parseCsvForImport({
      kind,
      text,
      mapping: { code: codeColumn, email: emailColumn },
      mappingRevision,
    }, locale);
    if (!parsed.ok) {
      setImportView({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      setNotice(t('ops.export.apiRejected', { code: parsed.code, message: parsed.message }));
      return false;
    }
    setMappingRevision(parsed.mappingRevision);
    setNotice(
      t('ops.import.localCsvSummary', { rowCount: parsed.rowCount, byteLength: parsed.byteLength }),
    );
    return false;
  }

  async function uploadAndCreate() {
    setBusy(true);
    setImportView(null);
    const parsed = parseCsvForImport({
      kind,
      text: csvText,
      mapping: { code: codeColumn, email: emailColumn },
      mappingRevision,
    }, locale);
    if (!parsed.ok) {
      const rejected: ImportView = {
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      };
      setImportView(rejected);
      setNotice(importViewLabel(rejected, locale));
      setBusy(false);
      return;
    }

    const form = new FormData();
    form.set('kind', kind);
    form.set(
      'file',
      new File([csvText], fileName || 'import.csv', { type: 'text/csv' }),
    );

    const upload = await portalMultipart(
      bffImportsUpload(tenantId, eventId),
      form,
    );
    const uploadView = interpretImportUpload(
      upload.status,
      upload.json,
      upload.networkError || upload.timedOut, locale,
    );
    if (uploadView.kind !== 'upload') {
      setImportView(uploadView);
      setNotice(importViewLabel(uploadView, locale));
      setBusy(false);
      return;
    }
    setFileId(uploadView.file.fileId);
    setFileHash(uploadView.file.fileHash);

    const create = await portalMutate(bffImports(tenantId, eventId), {
      kind,
      sourceId: sourceId.trim(),
      ticketTypeId: ticketTypeId.trim(),
      fileId: uploadView.file.fileId,
      mappingRevision: parsed.mappingRevision,
      columnMapping:
        kind === 'GUESTS' ? { email: emailColumn } : { code: codeColumn },
      idempotencyKey: crypto.randomUUID(),
    });
    const next = interpretImportCreate(
      create.status,
      create.json,
      create.networkError || create.timedOut, locale,
    );
    setImportView(next);
    if (next.kind === 'job') {
      setImportId(next.job.importId);
      if (next.job.fileHash) setFileHash(next.job.fileHash);
    }
    setNotice(importViewLabel(next, locale));
    setBusy(false);
  }

  async function runPreview() {
    if (!importId.trim()) return;
    setBusy(true);
    const result = await portalMutate(
      `${bffImportJob(tenantId, eventId, importId.trim())}/preview`,
      {
        mappingRevision,
        columnMapping:
          kind === 'GUESTS' ? { email: emailColumn } : { code: codeColumn },
      },
    );
    const next = interpretImportPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setImportView(next);
    if (next.kind === 'preview') {
      setPreviewRevision(next.preview.previewRevision);
      setFileHash(next.preview.fileHash);
      setMappingRevision(next.preview.mappingRevision);
    }
    setNotice(importViewLabel(next, locale));
    setBusy(false);
  }

  async function runCommit() {
    if (!importId.trim() || previewRevision === null || !fileHash) return;
    setBusy(true);
    const result = await portalMutate(
      `${bffImportJob(tenantId, eventId, importId.trim())}/commit`,
      {
        previewRevision,
        mappingRevision,
        fileHash,
        idempotencyKey: crypto.randomUUID(),
      },
    );
    const next = interpretImportCommit(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setImportView(next);
    setNotice(importViewLabel(next, locale));
    setBusy(false);
  }

  async function refreshStatus() {
    if (!importId.trim()) return;
    setBusy(true);
    const result = await portalGet(
      bffImportJob(tenantId, eventId, importId.trim()),
    );
    const next = interpretImportStatus(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setImportView(next);
    setNotice(importViewLabel(next, locale));
    setBusy(false);
  }

  async function downloadErrors() {
    if (!importId.trim()) return;
    setBusy(true);
    const res = await portalDownload(
      `${bffImportJob(tenantId, eventId, importId.trim())}/errors`,
    );
    if (res.status === 200 && res.blob) {
      const filename =
        /filename="?([^"]+)"?/i.exec(res.contentDisposition ?? '')?.[1] ??
        `import-errors-${importId.trim()}.csv`;
      const next = interpretImportErrorsDownload(
        res.status,
        null,
        false,
        importId.trim(),
        res.contentType,
        res.blob.size,
        filename, locale,
      );
      setImportView(next);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(importViewLabel(next, locale));
    } else {
      const next = interpretImportErrorsDownload(
        res.status,
        null,
        res.networkError || res.timedOut,
        importId.trim(),
        res.contentType, undefined, undefined, locale,
      );
      setImportView(next);
      setNotice(importViewLabel(next, locale));
    }
    setBusy(false);
  }

  async function listInvitations() {
    setBusy(true);
    setInviteView(null);
    const result = await portalGet(
      `${bffInvitations(tenantId, eventId)}?limit=50`,
    );
    const next = interpretInvitationList(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setInviteView(next);
    if (next.kind === 'list') {
      setSelectedRowKeys(next.items.map((i) => i.invitationId));
    }
    setNotice(invitationViewLabel(next, locale));
    setBusy(false);
  }

  async function previewDispatch() {
    const invitationIds = selectedRowKeys.map(String);
    if (invitationIds.length === 0) return;
    setBusy(true);
    const result = await portalMutate(
      bffInvitationDispatchPreview(tenantId, eventId),
      { invitationIds },
    );
    const next = interpretDispatchPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setInviteView(next);
    if (next.kind === 'dispatch_preview') {
      setDispatchPreviewRevision(next.preview.previewRevision);
    }
    setNotice(invitationViewLabel(next, locale));
    setBusy(false);
  }

  async function commitDispatch() {
    const invitationIds = selectedRowKeys.map(String);
    if (invitationIds.length === 0 || dispatchPreviewRevision === null) return;
    setBusy(true);
    const result = await portalMutate(bffInvitations(tenantId, eventId), {
      invitationIds,
      previewRevision: dispatchPreviewRevision,
      idempotencyKey: crypto.randomUUID(),
    });
    const next = interpretDispatch(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setInviteView(next);
    setNotice(invitationViewLabel(next, locale));
    setBusy(false);
  }

  const inviteRows =
    inviteView?.kind === 'list'
      ? inviteView.items.map((item) => ({ key: item.invitationId, ...item }))
      : [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={t('ops.import.panelTitle')}
        description={t('ops.import.panelDescription')}
      />

      <Form layout="vertical">
        <Form.Item label={t('ops.import.jobType')}>
          <Select
            value={kind}
            onChange={(v) => setKind(v)}
            options={[
              { value: 'CODES', label: 'CODES' },
              { value: 'GUESTS', label: 'GUESTS' },
            ]}
            style={{ maxWidth: 240 }}
          />
        </Form.Item>
        <Space wrap>
          <Button onClick={downloadTemplate}>{t('ops.h_15064q7')}</Button>
          <Upload
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={(file) => {
              void onFileChosen(file);
              return false;
            }}
          >
            <Button>{t('ops.import.chooseCsv')}</Button>
          </Upload>
          {fileName ? (
            <Typography.Text type="secondary">{fileName}</Typography.Text>
          ) : null}
        </Space>
        {kind === 'CODES' ? (
          <Form.Item label={t('ops.import.codeColumn')} style={{ marginTop: 16, maxWidth: 320 }}>
            <Input
              value={codeColumn}
              onChange={(e) => {
                setCodeColumn(e.target.value);
                setMappingRevision((r) => r + 1);
              }}
            />
          </Form.Item>
        ) : (
          <Form.Item label={t('ops.import.emailColumn')} style={{ marginTop: 16, maxWidth: 320 }}>
            <Input
              value={emailColumn}
              onChange={(e) => {
                setEmailColumn(e.target.value);
                setMappingRevision((r) => r + 1);
              }}
            />
          </Form.Item>
        )}
        <Typography.Paragraph type="secondary">
          {t('ops.import.catalogHint')}{mappingRevision}
          {fileId ? ` · fileId ${fileId.slice(0, 8)}…` : ''}
        </Typography.Paragraph>
        <Form.Item label="Import ID">
          <Input
            value={importId}
            onChange={(e) => setImportId(e.target.value)}
            spellCheck={false}
          />
        </Form.Item>
        <Space wrap>
          <Button
            type="primary"
            loading={busy}
            disabled={
              !csvText.trim() || !sourceId.trim() || !ticketTypeId.trim()
            }
            onClick={() => void uploadAndCreate()}
          >{t('ops.import.uploadJob')}</Button>
          <Button
            loading={busy}
            disabled={!importId.trim()}
            onClick={() => void runPreview()}
          >
            Preview
          </Button>
          <Button
            loading={busy}
            disabled={
              !importId.trim() || previewRevision === null || !fileHash
            }
            onClick={() => void runCommit()}
          >
            Commit
          </Button>
          <Button
            loading={busy}
            disabled={!importId.trim()}
            onClick={() => void refreshStatus()}
          >
            Status
          </Button>
          <Button
            loading={busy}
            disabled={!importId.trim()}
            onClick={() => void downloadErrors()}
          >{t('ops.h_1h6fj17')}</Button>
        </Space>
      </Form>

      {importView ? (
        <Alert
          type={importView.kind === 'rejected' ? 'error' : 'success'}
          showIcon
          message={importViewLabel(importView, locale)}
          data-testid="import-job-result"
        />
      ) : null}

      <Typography.Title level={4}>Guest invitations — dispatch</Typography.Title>
      <Alert
        type="warning"
        showIcon
        message={t('ops.import.dispatchPreviewNotice')}
      />
      <Space wrap>
        <Button loading={busy} onClick={() => void listInvitations()}>{t('ops.import.listInvitations')}</Button>
        <Button
          loading={busy}
          disabled={selectedRowKeys.length === 0}
          onClick={() => void previewDispatch()}
        >
          Dispatch preview
        </Button>
        <Button
          type="primary"
          loading={busy}
          disabled={
            selectedRowKeys.length === 0 || dispatchPreviewRevision === null
          }
          onClick={() => void commitDispatch()}
        >
          Dispatch
        </Button>
      </Space>
      {inviteRows.length > 0 ? (
        <Table
          size="small"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={false}
          dataSource={inviteRows}
          columns={[
            { title: 'ID', dataIndex: 'invitationId', ellipsis: true },
            { title: 'Email (masked)', dataIndex: 'invitedEmailMasked' },
            { title: 'State', dataIndex: 'state', width: 120 },
            { title: 'Expires', dataIndex: 'expiresAt', ellipsis: true },
          ]}
        />
      ) : null}
      {inviteView && inviteView.kind !== 'list' ? (
        <Alert
          type={inviteView.kind === 'rejected' ? 'error' : 'info'}
          showIcon
          message={invitationViewLabel(inviteView, locale)}
          data-testid="invitation-dispatch-result"
        />
      ) : null}
      {notice ? (
        <Typography.Text type="secondary">
          {notice}
        </Typography.Text>
      ) : null}
    </Space>
  );
}
