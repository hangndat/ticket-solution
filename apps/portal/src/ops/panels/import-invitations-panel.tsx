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
import { useRef, useState, type Key } from 'react';
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
  importAlertType,
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
import { formatImportKind, usePortalLocale } from '../../i18n';
import { useMutationIntent } from '../../client/use-mutation-intent';
import { MutationIntentAlert } from '../../client/mutation-intent-alert';

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
  const submittedCsv = useRef<string | null>(null);
  const uploadFlight = useRef(false);
  const createIntent = useMutationIntent(tenantId, eventId, 'create-import');
  const commitIntent = useMutationIntent(tenantId, eventId, 'commit-import');
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
    if (uploadFlight.current) return;
    uploadFlight.current = true;
    setBusy(true);
    setImportView(null);
    try {
    if (createIntent.pending && (!fileId || submittedCsv.current !== csvText)) {
      setNotice('Lần tạo import trước chưa rõ kết quả. Không tải file khác lên; kiểm tra danh sách import trước.');
      setBusy(false);
      return;
    }
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

    let uploadFileId = fileId;
    if (!createIntent.pending) {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', new File([csvText], fileName || 'import.csv', { type: 'text/csv' }));
      const upload = await portalMultipart(bffImportsUpload(tenantId, eventId), form);
      const uploadView = interpretImportUpload(upload.status, upload.json,
        upload.networkError || upload.timedOut, locale);
      if (uploadView.kind !== 'upload') {
        setImportView(uploadView);
        setNotice(importViewLabel(uploadView, locale));
        setBusy(false);
        return;
      }
      uploadFileId = uploadView.file.fileId;
      setFileId(uploadFileId);
      setFileHash(uploadView.file.fileHash);
      submittedCsv.current = csvText;
    }
    const outcome = await createIntent.run({
      kind,
      sourceId: sourceId.trim(),
      ticketTypeId: ticketTypeId.trim(),
      fileId: uploadFileId,
      mappingRevision: parsed.mappingRevision,
      columnMapping:
        kind === 'GUESTS' ? { email: emailColumn } : { code: codeColumn },
    }, (body) => portalMutate(bffImports(tenantId, eventId), body),
    (response) => interpretImportCreate(response.status, response.json,
      response.networkError || response.timedOut, locale).kind === 'job');
    if (outcome.kind === 'blocked') {
      setNotice('Lần tạo import trước chưa rõ kết quả. Kiểm tra import jobs trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const create = outcome.response;
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
    } finally {
      uploadFlight.current = false;
      setBusy(false);
    }
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
    const id = importId.trim();
    const outcome = await commitIntent.run({
        importId: id,
        previewRevision,
        mappingRevision,
        fileHash,
      }, (body) => portalMutate(`${bffImportJob(tenantId, eventId, id)}/commit`,
        { previewRevision: body.previewRevision, mappingRevision: body.mappingRevision,
          fileHash: body.fileHash, idempotencyKey: body.idempotencyKey }),
      (response) => interpretImportCommit(response.status, response.json,
        response.networkError || response.timedOut, locale).kind === 'commit');
    if (outcome.kind === 'blocked') {
      setNotice('Commit import trước chưa rõ kết quả. Kiểm tra job trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const result = outcome.response;
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
              { value: 'CODES', label: formatImportKind(locale, 'CODES') },
              { value: 'GUESTS', label: formatImportKind(locale, 'GUESTS') },
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
        <Form.Item label={t('ops.import.importIdLabel')}>
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
            {t('ops.import.action.preview')}
          </Button>
          <Button
            loading={busy}
            disabled={
              !importId.trim() || previewRevision === null || !fileHash
            }
            onClick={() => void runCommit()}
          >
            {t('ops.import.action.commit')}
          </Button>
          <Button
            loading={busy}
            disabled={!importId.trim()}
            onClick={() => void refreshStatus()}
          >
            {t('ops.import.action.status')}
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
          type={importAlertType(importView)}
          showIcon
          message={importViewLabel(importView, locale)}
          data-testid="import-job-result"
        />
      ) : null}
      <MutationIntentAlert pending={createIntent.pending} needsReconciliation={createIntent.needsReconciliation}
        onCheck={() => setNotice('Mở danh sách import jobs để đối soát; chưa có BFF GET list import trong portal.')}
        onStartNew={() => { createIntent.release(); submittedCsv.current = null; setFileId(''); }} />
      <MutationIntentAlert pending={commitIntent.pending} needsReconciliation={commitIntent.needsReconciliation}
        onCheck={() => void refreshStatus()} onStartNew={commitIntent.release} />

      <Typography.Title level={4}>
        {t('ops.invitation.sectionTitle')}
      </Typography.Title>
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
          {t('ops.invitation.dispatchPreview')}
        </Button>
        <Button
          type="primary"
          loading={busy}
          disabled={
            selectedRowKeys.length === 0 || dispatchPreviewRevision === null
          }
          onClick={() => void commitDispatch()}
        >
          {t('ops.invitation.dispatchCommit')}
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
            {
              title: t('ops.table.invitationId'),
              dataIndex: 'invitationId',
              ellipsis: true,
            },
            {
              title: t('ops.table.emailMasked'),
              dataIndex: 'invitedEmailMasked',
            },
            { title: t('ops.table.state'), dataIndex: 'state', width: 120 },
            {
              title: t('ops.table.expires'),
              dataIndex: 'expiresAt',
              ellipsis: true,
            },
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
