'use client';

import { useState } from 'react';
import { decideAdmin, type AdminAction, type AdminDecision } from '../../src/admin/decide';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = { initialTenantId?: string; initialEventId?: string };

function label(decision: AdminDecision): string {
  if (decision.kind === 'saved') return `Đã lưu phiên bản ${decision.version}. Chưa publish.`;
  if (decision.kind === 'published') return `Đã publish phiên bản ${decision.version}.`;
  if (decision.kind === 'imported') return `Đã nhập ${decision.count} mã. Mã gốc không được lưu.`;
  if (decision.kind === 'quota') {
    return `Quota event: ${decision.allocated} / ${decision.capacity}.`;
  }
  if (decision.kind === 'rejected') return `${decision.code}: ${decision.message}`;
  return decision.message;
}

export function AdminForm({ initialTenantId = '', initialEventId = '' }: Props) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [payloadText, setPayloadText] = useState('{\n  "title": ""\n}');
  const [expectedVersion, setExpectedVersion] = useState('1');
  const [codesText, setCodesText] = useState('');
  const [eventQuota, setEventQuota] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<AdminDecision | null>(null);

  async function call(action: AdminAction, path: string, init: RequestInit) {
    setBusy(true);
    setDecision(null);
    const result = await fetchJson(path, init, REQUEST_TIMEOUT_MS);
    setDecision(
      decideAdmin(action, result.status, result.json, result.networkError || result.timedOut),
    );
    setBusy(false);
  }

  function scope() {
    return { tenantId: tenantId.trim(), eventId: eventId.trim() };
  }

  async function saveConfig() {
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setDecision({ kind: 'rejected', code: 'INVALID_JSON', message: 'Payload phải là JSON object.' });
      return;
    }
    await call('save', '/api/bff/admin/config-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scope(), payload }),
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
      body: JSON.stringify({ ...scope(), codes, ...(quota ? { eventQuota: quota } : {}) }),
    });
  }

  async function loadQuota() {
    const params = new URLSearchParams(scope());
    await call('quota', `/api/bff/admin/quota?${params.toString()}`, { method: 'GET' });
  }

  return (
    <div className="redeem-form">
      <div className="redeem-fields">
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label>
          Event ID
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
      </div>
      <label>
        Payload cấu hình (JSON)
        <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={6} spellCheck={false} />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={() => void saveConfig()}>
          Lưu phiên bản
        </button>
      </div>
      <label>
        Phiên bản cần publish
        <input value={expectedVersion} onChange={(e) => setExpectedVersion(e.target.value)} inputMode="numeric" />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={() => void publish()}>
          Publish
        </button>
      </div>
      <label>
        Mã mời, mỗi dòng một mã
        <textarea value={codesText} onChange={(e) => setCodesText(e.target.value)} rows={5} spellCheck={false} autoComplete="off" />
      </label>
      <label>
        Quota event (lần nhập đầu)
        <input value={eventQuota} onChange={(e) => setEventQuota(e.target.value)} inputMode="numeric" />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={() => void importCodes()}>
          Nhập mã
        </button>
        <button type="button" disabled={busy} onClick={() => void loadQuota()}>
          Đọc quota
        </button>
      </div>
      {decision ? (
        <section className="notice" role="status">
          <p>{label(decision)}</p>
        </section>
      ) : null}
    </div>
  );
}
