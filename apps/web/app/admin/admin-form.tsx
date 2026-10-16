'use client';

import { useState } from 'react';
import {
  decideAdmin,
  type AdminAction,
  type AdminDecision,
} from '../../src/admin/decide';
import {
  editConfigPayload,
  initialPayloadEditor,
  lockPublishedPayload,
  payloadLocked,
  previewConfigJson,
  startNewConfigDraft,
  type PayloadEditor,
} from '../../src/admin/payload';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = { initialTenantId?: string; initialEventId?: string };

function label(decision: AdminDecision): string {
  if (decision.kind === 'saved')
    return `Đã lưu phiên bản ${decision.version}. Chưa publish.`;
  if (decision.kind === 'published') {
    return `Đã publish phiên bản ${decision.version}. Payload này không sửa được.`;
  }
  if (decision.kind === 'imported')
    return `Đã nhập ${decision.count} mã. Mã gốc không được lưu.`;
  if (decision.kind === 'quota') {
    return `Quota event: ${decision.allocated} / ${decision.capacity ?? 'null'}.`;
  }
  if (decision.kind === 'rejected') {
    const id = decision.requestId ? ` · requestId ${decision.requestId}` : '';
    return `${decision.code}: ${decision.message}${id}`;
  }
  return decision.message;
}

export function AdminForm({
  initialTenantId = '',
  initialEventId = '',
}: Props) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [editor, setEditor] = useState<PayloadEditor>(() =>
    initialPayloadEditor(),
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [expectedVersion, setExpectedVersion] = useState('');
  const [codesText, setCodesText] = useState('');
  const [eventQuota, setEventQuota] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const locked = payloadLocked(editor);

  async function call(action: AdminAction, path: string, init: RequestInit) {
    setBusy(true);
    setDecision(null);
    const result = await fetchJson(path, init, REQUEST_TIMEOUT_MS);
    const next = decideAdmin(
      action,
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'saved') setExpectedVersion(String(next.version));
    if (next.kind === 'published') {
      setEditor((prev) => lockPublishedPayload(prev));
      setExpectedVersion(String(next.version));
    }
    setDecision(next);
    setBusy(false);
  }

  function scope() {
    return { tenantId: tenantId.trim(), eventId: eventId.trim() };
  }

  function showPreview() {
    const parsed = previewConfigJson(editor.text);
    if (!parsed.ok) {
      setPreview(null);
      setDecision({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      return;
    }
    setPreview(parsed.pretty);
  }

  async function saveConfig() {
    const parsed = previewConfigJson(editor.text);
    if (!parsed.ok) {
      setDecision({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      return;
    }
    await call('save', '/api/bff/admin/config-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scope(),
        payload: JSON.parse(editor.text) as unknown,
      }),
    });
  }

  async function publish() {
    const version = Number(expectedVersion);
    await call('publish', '/api/bff/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scope(), expectedVersion: version }),
    });
  }

  async function importCodes() {
    const codes = codesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const quota = eventQuota.trim() === '' ? undefined : Number(eventQuota);
    await call('import', '/api/bff/admin/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scope(),
        codes,
        ...(quota ? { eventQuota: quota } : {}),
      }),
    });
  }

  async function loadQuota() {
    const params = new URLSearchParams(scope());
    await call('quota', `/api/bff/admin/quota?${params.toString()}`, {
      method: 'GET',
    });
  }

  return (
    <div className="redeem-form">
      <div className="redeem-fields">
        <label>
          Tenant ID
          <input
            name="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <label>
          Event ID
          <input
            name="eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </div>
      <label>
        Payload cấu hình (JSON)
        <textarea
          id="admin-payload"
          value={editor.text}
          readOnly={locked}
          aria-readonly={locked}
          onChange={(e) =>
            setEditor((prev) => editConfigPayload(prev, e.target.value))
          }
          rows={6}
          spellCheck={false}
        />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={showPreview}>
          Xem trước
        </button>
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void saveConfig()}
        >
          Lưu phiên bản
        </button>
      </div>
      {preview ? (
        <pre id="config-preview" className="me-result" tabIndex={0}>
          {preview}
        </pre>
      ) : null}
      <label>
        Phiên bản cần publish
        <input
          value={expectedVersion}
          onChange={(e) => setExpectedVersion(e.target.value)}
          inputMode="numeric"
          readOnly={locked}
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void publish()}
        >
          Publish
        </button>
        {locked ? (
          <button
            type="button"
            onClick={() => setEditor((prev) => startNewConfigDraft(prev))}
          >
            Soạn bản mới
          </button>
        ) : null}
      </div>
      {editor.publishedSnapshot ? (
        <div>
          <h3>Payload đã publish (chỉ đọc)</h3>
          <pre id="admin-published" className="me-result" tabIndex={0}>
            {editor.publishedSnapshot}
          </pre>
        </div>
      ) : null}
      <label>
        Mã mời, mỗi dòng một mã
        <textarea
          id="admin-codes"
          value={codesText}
          onChange={(e) => setCodesText(e.target.value)}
          rows={5}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <label>
        Quota event (lần nhập đầu)
        <input
          name="eventQuota"
          value={eventQuota}
          onChange={(e) => setEventQuota(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void importCodes()}
        >
          Nhập mã
        </button>
        <button type="button" disabled={busy} onClick={() => void loadQuota()}>
          Đọc quota
        </button>
      </div>
      {decision ? (
        <section
          className={
            decision.kind === 'rejected'
              ? 'redeem-status redeem-status--error'
              : 'notice'
          }
          role="alert"
          data-testid="admin-notice"
        >
          <p>{label(decision)}</p>
        </section>
      ) : null}
    </div>
  );
}
