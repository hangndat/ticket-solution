'use client';

import { useState } from 'react';
import type { ImportKind } from '@ticket/contracts';
import { adminGet, adminMutate } from '../../src/admin/client-fetch';
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
} from '../../src/admin/import-job';
import {
  interpretDispatch,
  interpretDispatchPreview,
  interpretInvitationList,
  invitationViewLabel,
  type InvitationView,
} from '../../src/admin/invitation';
import { CSRF_COOKIE, CSRF_HEADER } from '../../src/bff/csrf-constants';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = {
  tenantId: string;
  eventId: string;
  sourceId: string;
  ticketTypeId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onNotice: (message: string) => void;
};

function readCsrf(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`),
  );
  return match?.[1]?.trim() ?? '';
}

function scope(tenantId: string, eventId: string) {
  return { tenantId: tenantId.trim(), eventId: eventId.trim() };
}

export function ImportPanel({
  tenantId,
  eventId,
  sourceId,
  ticketTypeId,
  busy,
  setBusy,
  onNotice,
}: Props) {
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
  const [selectedIds, setSelectedIds] = useState<string>('');
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
    onNotice(`Đã tải template ${csvTemplateFilename(kind)}.`);
  }

  async function onFileChosen(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const parsed = parseCsvForImport({
      kind,
      text,
      mapping: {
        code: codeColumn,
        email: emailColumn,
      },
      mappingRevision,
    });
    if (!parsed.ok) {
      setImportView({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      onNotice(`${parsed.code}: ${parsed.message}`);
      return;
    }
    setMappingRevision(parsed.mappingRevision);
    onNotice(
      `CSV cục bộ: ${parsed.rowCount} dòng · ${parsed.byteLength} bytes · chưa ghi backend.`,
    );
  }

  async function uploadAndCreate() {
    setBusy(true);
    setImportView(null);
    const s = scope(tenantId, eventId);
    const parsed = parseCsvForImport({
      kind,
      text: csvText,
      mapping: { code: codeColumn, email: emailColumn },
      mappingRevision,
    });
    if (!parsed.ok) {
      setImportView({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      onNotice(importViewLabel({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      }));
      setBusy(false);
      return;
    }

    const form = new FormData();
    form.set('tenantId', s.tenantId);
    form.set('eventId', s.eventId);
    form.set('kind', kind);
    form.set(
      'file',
      new File([csvText], fileName || 'import.csv', { type: 'text/csv' }),
    );

    let uploadedFileId = fileId;
    let uploadedHash = fileHash;
    try {
      const uploadRes = await fetch('/api/bff/admin/imports/upload', {
        method: 'POST',
        headers: { [CSRF_HEADER]: readCsrf() },
        body: form,
      });
      const uploadJson = (await uploadRes.json().catch(() => null)) as unknown;
      const uploadView = interpretImportUpload(
        uploadRes.status,
        uploadJson,
        false,
      );
      if (uploadView.kind === 'upload') {
        uploadedFileId = uploadView.file.fileId;
        uploadedHash = uploadView.file.fileHash;
        setFileId(uploadedFileId);
        setFileHash(uploadedHash);
      } else if (uploadView.kind === 'rejected' || uploadView.kind === 'unknown') {
        // Scoped pass: I-BE upload may not be live — surface honestly.
        setImportView(uploadView);
        onNotice(
          `${importViewLabel(uploadView)} (upload quarantine chờ I-BE nếu 404/502).`,
        );
        setBusy(false);
        return;
      }
    } catch {
      setImportView({ kind: 'unknown', message: 'Upload thất bại / chưa rõ.' });
      onNotice('Upload thất bại / chưa rõ.');
      setBusy(false);
      return;
    }

    const create = await adminMutate(
      '/api/bff/admin/imports',
      {
        ...s,
        kind,
        sourceId: sourceId.trim(),
        ticketTypeId: ticketTypeId.trim(),
        fileId: uploadedFileId,
        mappingRevision: parsed.mappingRevision,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretImportCreate(
      create.status,
      create.json,
      create.networkError || create.timedOut,
    );
    setImportView(next);
    if (next.kind === 'job') {
      setImportId(next.job.importId);
      if (next.job.fileHash) setFileHash(next.job.fileHash);
    }
    onNotice(importViewLabel(next));
    setBusy(false);
  }

  async function runPreview() {
    if (!importId.trim()) return;
    setBusy(true);
    const result = await adminMutate(
      `/api/bff/admin/imports/${encodeURIComponent(importId.trim())}/preview`,
      {
        ...scope(tenantId, eventId),
        mappingRevision,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretImportPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setImportView(next);
    if (next.kind === 'preview') {
      setPreviewRevision(next.preview.previewRevision);
      setFileHash(next.preview.fileHash);
      setMappingRevision(next.preview.mappingRevision);
    }
    onNotice(importViewLabel(next));
    setBusy(false);
  }

  async function runCommit() {
    if (!importId.trim() || previewRevision === null || !fileHash) return;
    setBusy(true);
    const result = await adminMutate(
      `/api/bff/admin/imports/${encodeURIComponent(importId.trim())}/commit`,
      {
        ...scope(tenantId, eventId),
        previewRevision,
        mappingRevision,
        fileHash,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretImportCommit(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setImportView(next);
    onNotice(importViewLabel(next));
    setBusy(false);
  }

  async function refreshStatus() {
    if (!importId.trim()) return;
    setBusy(true);
    const params = new URLSearchParams(scope(tenantId, eventId));
    const result = await adminGet(
      `/api/bff/admin/imports/${encodeURIComponent(importId.trim())}?${params}`,
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretImportStatus(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setImportView(next);
    onNotice(importViewLabel(next));
    setBusy(false);
  }

  async function downloadErrors() {
    if (!importId.trim()) return;
    setBusy(true);
    const params = new URLSearchParams(scope(tenantId, eventId));
    const res = await fetch(
      `/api/bff/admin/imports/${encodeURIComponent(importId.trim())}/errors?${params}`,
      { method: 'GET' },
    );
    const ct = res.headers.get('Content-Type');
    if (res.ok && ct && !ct.includes('application/json')) {
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
      const filename =
        filenameMatch?.[1] ?? `import-errors-${importId.trim()}.csv`;
      const next = interpretImportErrorsDownload(
        res.status,
        null,
        false,
        importId.trim(),
        ct,
        blob.size,
        filename,
      );
      setImportView(next);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onNotice(importViewLabel(next));
    } else {
      const json = (await res.json().catch(() => null)) as unknown;
      const next = interpretImportErrorsDownload(
        res.status,
        json,
        false,
        importId.trim(),
        ct,
      );
      setImportView(next);
      onNotice(importViewLabel(next));
    }
    setBusy(false);
  }

  async function listInvitations() {
    setBusy(true);
    setInviteView(null);
    const params = new URLSearchParams(scope(tenantId, eventId));
    params.set('limit', '50');
    const result = await adminGet(
      `/api/bff/admin/invitations?${params}`,
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretInvitationList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setInviteView(next);
    if (next.kind === 'list') {
      setSelectedIds(next.items.map((i) => i.invitationId).join('\n'));
    }
    onNotice(invitationViewLabel(next));
    setBusy(false);
  }

  function selectedInvitationIds(): string[] {
    return selectedIds
      .split(/\r?\n|,/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  async function previewDispatch() {
    const invitationIds = selectedInvitationIds();
    if (invitationIds.length === 0) return;
    setBusy(true);
    const result = await adminMutate(
      '/api/bff/admin/invitations/dispatch-preview',
      {
        ...scope(tenantId, eventId),
        invitationIds,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretDispatchPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setInviteView(next);
    if (next.kind === 'dispatch_preview') {
      setDispatchPreviewRevision(next.preview.previewRevision);
    }
    onNotice(invitationViewLabel(next));
    setBusy(false);
  }

  async function commitDispatch() {
    const invitationIds = selectedInvitationIds();
    if (invitationIds.length === 0 || dispatchPreviewRevision === null) return;
    setBusy(true);
    const result = await adminMutate(
      '/api/bff/admin/invitations',
      {
        ...scope(tenantId, eventId),
        invitationIds,
        previewRevision: dispatchPreviewRevision,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretDispatch(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setInviteView(next);
    onNotice(invitationViewLabel(next));
    setBusy(false);
  }

  return (
    <section className="admin-import-panel" aria-labelledby="csv-import-heading">
      <h2 id="csv-import-heading">CSV import (C-I)</h2>
      <p>
        Template UTF-8 · mapping cột allowlist · source/type bắt buộc · preview
        không ghi dữ liệu / không giữ quota · commit idempotent · báo cáo lỗi
        private. Guest import không tạo account.
      </p>

      <label>
        Loại job
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ImportKind)}
          aria-label="Import kind"
        >
          <option value="CODES">CODES</option>
          <option value="GUESTS">GUESTS</option>
        </select>
      </label>

      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={downloadTemplate}>
          Tải template CSV
        </button>
      </div>

      <label>
        File CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFileChosen(e.target.files?.[0] ?? null)}
        />
      </label>

      {kind === 'CODES' ? (
        <label>
          Cột code (mapping)
          <input
            value={codeColumn}
            onChange={(e) => {
              setCodeColumn(e.target.value);
              setMappingRevision((r) => r + 1);
            }}
            autoComplete="off"
          />
        </label>
      ) : (
        <label>
          Cột email (mapping)
          <input
            value={emailColumn}
            onChange={(e) => {
              setEmailColumn(e.target.value);
              setMappingRevision((r) => r + 1);
            }}
            autoComplete="off"
          />
        </label>
      )}

      <label>
        Source ID
        <input
          value={sourceId}
          readOnly
          aria-label="Source ID (từ form ticket type/source phía trên)"
        />
      </label>
      <label>
        Ticket type ID
        <input value={ticketTypeId} readOnly aria-label="Ticket type ID" />
      </label>

      <label>
        Import ID (sau create)
        <input
          value={importId}
          onChange={(e) => setImportId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <div className="auth-buttons">
        <button
          type="button"
          disabled={
            busy ||
            !csvText.trim() ||
            !sourceId.trim() ||
            !ticketTypeId.trim()
          }
          onClick={() => void uploadAndCreate()}
        >
          Upload + tạo job
        </button>
        <button
          type="button"
          disabled={busy || !importId.trim()}
          onClick={() => void runPreview()}
        >
          Preview
        </button>
        <button
          type="button"
          disabled={
            busy ||
            !importId.trim() ||
            previewRevision === null ||
            !fileHash
          }
          onClick={() => void runCommit()}
        >
          Commit
        </button>
        <button
          type="button"
          disabled={busy || !importId.trim()}
          onClick={() => void refreshStatus()}
        >
          Status
        </button>
        <button
          type="button"
          disabled={busy || !importId.trim()}
          onClick={() => void downloadErrors()}
        >
          Tải lỗi (private)
        </button>
      </div>

      {importView ? (
        <section
          className="notice"
          role="status"
          data-testid="import-job-result"
        >
          <p>{importViewLabel(importView)}</p>
          {importView.kind === 'preview' &&
          importView.preview.sampleErrors.length > 0 ? (
            <ul>
              {importView.preview.sampleErrors.map((err) => (
                <li key={`${err.fieldId}:${err.code}`}>
                  {err.fieldId}: {err.code} — {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <h3>Guest invitations — dispatch</h3>
      <p>
        Chọn id rõ ràng · preview quota không reserve · dispatch tạo mail
        claim-link (không pre-issue vé / không auto-account).
      </p>
      <label>
        Invitation IDs (mỗi dòng một UUID)
        <textarea
          value={selectedIds}
          onChange={(e) => setSelectedIds(e.target.value)}
          rows={4}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void listInvitations()}
        >
          Liệt kê invitations
        </button>
        <button
          type="button"
          disabled={busy || selectedInvitationIds().length === 0}
          onClick={() => void previewDispatch()}
        >
          Dispatch preview
        </button>
        <button
          type="button"
          disabled={
            busy ||
            selectedInvitationIds().length === 0 ||
            dispatchPreviewRevision === null
          }
          onClick={() => void commitDispatch()}
        >
          Dispatch
        </button>
      </div>
      {inviteView ? (
        <section
          className="notice"
          role="status"
          data-testid="invitation-dispatch-result"
        >
          <p>{invitationViewLabel(inviteView)}</p>
          {inviteView.kind === 'list' ? (
            <ul>
              {inviteView.items.map((item) => (
                <li key={item.invitationId}>
                  {item.invitationId.slice(0, 8)}… · {item.invitedEmailMasked} ·{' '}
                  {item.state} · hết hạn {item.expiresAt}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
