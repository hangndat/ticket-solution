'use client';

import { useId, useState } from 'react';
import {
  EVENT_CONTENT_SECTION_KINDS,
  type ConfigVersionSummary,
  type EventContentSectionKind,
} from '@ticket/contracts';
import {
  configHistoryLabel,
  configPreviewLabel,
  configRollbackLabel,
  interpretAssetFinalize,
  interpretAssetInit,
  interpretConfigHistory,
  interpretConfigPreview,
  interpretConfigRollback,
  localDraftPreview,
  localVersionPreview,
  type ConfigHistoryView,
  type ConfigPreviewView,
  type ConfigRollbackView,
  type LocalRenderedPreview,
} from '../../src/admin/config-api';
import {
  assetSlotLabel,
  validateAssetFile,
  type AssetSlot,
} from '../../src/admin/config-assets';
import {
  configEditorLocked,
  moveSection,
  setFaqItems,
  setSectionBody,
  setSectionVisible,
  startNewConfigDraftFromPublished,
  updateBrand,
  validateEditor,
  type ConfigEditor,
} from '../../src/admin/config-editor';
import type { AllowlistedSectionBody, FaqItem } from '../../src/admin/config-schema';
import { ConfigRenderer } from '../../src/content/config-renderer';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Scope = { tenantId: string; eventId: string };

type Props = {
  editor: ConfigEditor;
  onEditorChange: (next: ConfigEditor) => void;
  scope: Scope;
  busy: boolean;
  expectedVersion: string;
  onExpectedVersion: (value: string) => void;
  eventRevision: number | null;
  onSavedVersion: (version: number) => void;
  onPublished: (version: number) => void;
  onNotice: (message: string, kind?: 'ok' | 'error' | 'unknown') => void;
};

const KIND_LABEL: Record<EventContentSectionKind, string> = {
  hero: 'Hero',
  info: 'Thông tin',
  redeem: 'Đổi vé',
  guide: 'Hướng dẫn',
  faq: 'FAQ',
  terms: 'Điều khoản',
};

export function ConfigBrandPanel({
  editor,
  onEditorChange,
  scope,
  busy,
  expectedVersion,
  onExpectedVersion,
  eventRevision,
  onSavedVersion,
  onPublished,
  onNotice,
}: Props) {
  const baseId = useId();
  const locked = configEditorLocked(editor);
  const [rendered, setRendered] = useState<LocalRenderedPreview | null>(null);
  const [historyView, setHistoryView] = useState<ConfigHistoryView | null>(null);
  const [previewView, setPreviewView] = useState<ConfigPreviewView | null>(null);
  const [rollbackView, setRollbackView] = useState<ConfigRollbackView | null>(
    null,
  );
  const [rollbackTarget, setRollbackTarget] = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [validationSummary, setValidationSummary] = useState<string | null>(
    null,
  );

  function sectionsSorted() {
    return [...editor.payload.sections].sort((a, b) => a.order - b.order);
  }

  function bodyOf(kind: EventContentSectionKind): AllowlistedSectionBody {
    const section = editor.payload.sections.find((s) => s.kind === kind);
    return (section?.body as AllowlistedSectionBody) ?? {};
  }

  function showLocalPreview() {
    const validated = validateEditor(editor);
    if (!validated.ok) {
      const first = validated.issues[0];
      setValidationSummary(
        first ? `${first.fieldId}: ${first.message}` : 'Payload không hợp lệ.',
      );
      setRendered(null);
      onNotice(first?.message ?? 'Payload không hợp lệ.', 'error');
      const el = document.getElementById(`${baseId}-validation`);
      el?.focus();
      return;
    }
    setValidationSummary(null);
    setRendered(localDraftPreview(validated.payload));
    onNotice('Đã render preview draft (no-store, không phải pretty JSON).', 'ok');
  }

  async function saveConfig() {
    const validated = validateEditor(editor);
    if (!validated.ok) {
      const first = validated.issues[0];
      setValidationSummary(
        first ? `${first.fieldId}: ${first.message}` : 'Payload không hợp lệ.',
      );
      onNotice(first?.message ?? 'Payload không hợp lệ.', 'error');
      document.getElementById(`${baseId}-validation`)?.focus();
      return;
    }
    setValidationSummary(null);
    const result = await fetchJson(
      '/api/bff/admin/config-versions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope,
          payload: validated.payload,
          schemaVersion: validated.payload.schemaVersion,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (
      !result.networkError &&
      !result.timedOut &&
      (result.status === 200 || result.status === 201) &&
      result.json &&
      typeof result.json === 'object' &&
      typeof (result.json as { version?: unknown }).version === 'number'
    ) {
      const version = (result.json as { version: number }).version;
      onSavedVersion(version);
      onExpectedVersion(String(version));
      onNotice(`Đã lưu phiên bản ${version}. Chưa publish.`, 'ok');
      return;
    }
    const code =
      result.json &&
      typeof result.json === 'object' &&
      typeof (result.json as { code?: unknown }).code === 'string'
        ? (result.json as { code: string; message?: string }).code
        : 'UNKNOWN';
    const message =
      result.json &&
      typeof result.json === 'object' &&
      typeof (result.json as { message?: unknown }).message === 'string'
        ? (result.json as { message: string }).message
        : 'Không lưu được phiên bản.';
    onNotice(
      result.networkError || result.timedOut || result.status >= 500
        ? 'Kết quả chưa biết — không coi đã lưu.'
        : `${code}: ${message}`,
      result.networkError || result.timedOut || result.status >= 500
        ? 'unknown'
        : 'error',
    );
  }

  async function publish() {
    const version = Number(expectedVersion);
    const result = await fetchJson(
      '/api/bff/admin/publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scope, expectedVersion: version }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (
      !result.networkError &&
      !result.timedOut &&
      (result.status === 200 || result.status === 201) &&
      result.json &&
      typeof result.json === 'object' &&
      (result.json as { status?: unknown }).status === 'PUBLISHED' &&
      typeof (result.json as { publishedConfigVersion?: unknown })
        .publishedConfigVersion === 'number'
    ) {
      const published = (result.json as { publishedConfigVersion: number })
        .publishedConfigVersion;
      onPublished(published);
      onNotice(`Đã publish phiên bản ${published}.`, 'ok');
      return;
    }
    onNotice(
      result.networkError || result.timedOut || result.status >= 500
        ? 'Kết quả chưa biết — không coi đã publish.'
        : 'Publish bị từ chối hoặc không rõ.',
      result.networkError || result.timedOut || result.status >= 500
        ? 'unknown'
        : 'error',
    );
  }

  async function loadHistory() {
    const qs = new URLSearchParams({
      tenantId: scope.tenantId,
      eventId: scope.eventId,
    });
    const result = await fetchJson(
      `/api/bff/admin/config-versions?${qs.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretConfigHistory(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setHistoryView(view);
    onNotice(configHistoryLabel(view), view.kind === 'list' ? 'ok' : 'error');
  }

  async function loadProtectedPreview(version: number) {
    const qs = new URLSearchParams({
      tenantId: scope.tenantId,
      eventId: scope.eventId,
    });
    const result = await fetchJson(
      `/api/bff/admin/config-versions/${version}/preview?${qs.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretConfigPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setPreviewView(view);
    if (view.kind === 'preview') {
      // Version preview must not mutate draft editor payload.
      setRendered(
        localVersionPreview(view.preview.version, view.preview.payload),
      );
    }
    onNotice(configPreviewLabel(view), view.kind === 'preview' ? 'ok' : 'error');
  }

  async function confirmRollback() {
    if (!rollbackConfirm) {
      onNotice('Cần xác nhận rollback trước khi gửi.', 'error');
      return;
    }
    const targetVersion = Number(rollbackTarget);
    const expectedPublishedVersion = Number(expectedVersion);
    if (
      !Number.isInteger(targetVersion) ||
      targetVersion < 1 ||
      !Number.isInteger(expectedPublishedVersion) ||
      expectedPublishedVersion < 1 ||
      eventRevision === null
    ) {
      onNotice(
        'Cần targetVersion, expectedPublishedVersion và event revision.',
        'error',
      );
      return;
    }
    const result = await fetchJson(
      '/api/bff/admin/config/rollback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope,
          targetVersion,
          expectedPublishedVersion,
          expectedRevision: eventRevision,
          idempotencyKey: crypto.randomUUID(),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretConfigRollback(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setRollbackView(view);
    setRollbackConfirm(false);
    if (view.kind === 'rolled_back') {
      onExpectedVersion(String(view.result.publishedVersion));
      onPublished(view.result.publishedVersion);
    }
    onNotice(
      configRollbackLabel(view),
      view.kind === 'rolled_back' ? 'ok' : 'error',
    );
  }

  async function uploadAsset(slot: AssetSlot, file: File | null) {
    if (!file) return;
    const validated = validateAssetFile(file);
    if (!validated.ok) {
      onNotice(`${validated.error.code}: ${validated.error.message}`, 'error');
      return;
    }
    setAssetBusy(true);
    try {
      const initResult = await fetchJson(
        '/api/bff/admin/assets/upload-init',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scope, ...validated.body }),
        },
        REQUEST_TIMEOUT_MS,
      );
      const initView = interpretAssetInit(
        initResult.status,
        initResult.json,
        initResult.networkError || initResult.timedOut,
      );
      if (initView.kind !== 'init') {
        onNotice(
          initView.kind === 'rejected'
            ? `${initView.code}: ${initView.message}`
            : initView.message,
          'error',
        );
        return;
      }
      // Upload bytes to server-minted URL (may be relative BFF or absolute MinIO).
      const put = await fetch(initView.result.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': validated.body.contentType },
        body: file,
        cache: 'no-store',
      }).catch(() => null);
      if (!put || !put.ok) {
        onNotice(
          put
            ? `Upload thất bại HTTP ${put.status}.`
            : 'Upload chưa biết — mất mạng.',
          put ? 'error' : 'unknown',
        );
        return;
      }
      const finalizeResult = await fetchJson(
        '/api/bff/admin/assets/finalize',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scope, assetId: initView.result.assetId }),
        },
        REQUEST_TIMEOUT_MS,
      );
      const finalizeView = interpretAssetFinalize(
        finalizeResult.status,
        finalizeResult.json,
        finalizeResult.networkError || finalizeResult.timedOut,
      );
      if (finalizeView.kind !== 'ready') {
        onNotice(
          finalizeView.kind === 'rejected'
            ? `${finalizeView.code}: ${finalizeView.message}`
            : finalizeView.message,
          'error',
        );
        return;
      }
      onEditorChange(
        updateBrand(
          editor,
          slot === 'logo'
            ? { logoAssetId: finalizeView.result.assetId }
            : { bannerAssetId: finalizeView.result.assetId },
        ),
      );
      onNotice(
        `${assetSlotLabel(slot)} READY: ${finalizeView.result.assetId}`,
        'ok',
      );
    } finally {
      setAssetBusy(false);
    }
  }

  return (
    <section
      className="cfg-editor"
      aria-labelledby={`${baseId}-heading`}
      data-testid="config-brand-panel"
    >
      <h2 id={`${baseId}-heading`}>Nội dung &amp; brand (C-B)</h2>
      <p>
        Section cố định 6 loại — không HTML/CSS/JS tùy ý. Preview là bản render
        đã sanitize, không dùng pretty JSON làm nghiệm thu.
      </p>

      <fieldset disabled={busy || locked || assetBusy} className="cfg-brand">
        <legend>Brand</legend>
        <label>
          Tổ chức
          <input
            id={`${baseId}-org`}
            value={editor.payload.brand.organizationName}
            onChange={(e) =>
              onEditorChange(
                updateBrand(editor, { organizationName: e.target.value }),
              )
            }
            autoComplete="organization"
          />
        </label>
        <label>
          Màu chính (hex)
          <input
            id={`${baseId}-color`}
            value={editor.payload.brand.primaryColor}
            onChange={(e) =>
              onEditorChange(
                updateBrand(editor, { primaryColor: e.target.value }),
              )
            }
            spellCheck={false}
            aria-describedby={`${baseId}-color-hint`}
          />
        </label>
        <p id={`${baseId}-color-hint`} className="cfg-hint">
          Chỉ mã hex #RGB / #RRGGBB.
        </p>
        {(['logo', 'banner'] as const).map((slot) => (
          <label key={slot}>
            {assetSlotLabel(slot)} (PNG/JPEG/WebP ≤5MiB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy || locked || assetBusy}
              aria-label={`Tải ${assetSlotLabel(slot)}`}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void uploadAsset(slot, file);
                e.target.value = '';
              }}
            />
            <span className="cfg-meta">
              {slot === 'logo'
                ? editor.payload.brand.logoAssetId ?? 'chưa có'
                : editor.payload.brand.bannerAssetId ?? 'chưa có'}
            </span>
          </label>
        ))}
      </fieldset>

      <ol className="cfg-section-list" aria-label="Thứ tự section">
        {sectionsSorted().map((section) => {
          const body = bodyOf(section.kind);
          return (
            <li key={section.kind} className="cfg-section-item">
              <div className="cfg-section-toolbar">
                <label>
                  <input
                    type="checkbox"
                    checked={section.visible}
                    disabled={locked || busy}
                    onChange={(e) =>
                      onEditorChange(
                        setSectionVisible(
                          editor,
                          section.kind,
                          e.target.checked,
                        ),
                      )
                    }
                  />{' '}
                  Hiện {KIND_LABEL[section.kind]}
                </label>
                <div className="auth-buttons">
                  <button
                    type="button"
                    disabled={locked || busy}
                    aria-label={`Đưa ${KIND_LABEL[section.kind]} lên`}
                    onClick={() =>
                      onEditorChange(moveSection(editor, section.kind, -1))
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={locked || busy}
                    aria-label={`Đưa ${KIND_LABEL[section.kind]} xuống`}
                    onClick={() =>
                      onEditorChange(moveSection(editor, section.kind, 1))
                    }
                  >
                    ↓
                  </button>
                </div>
              </div>
              <label>
                Tiêu đề
                <input
                  value={body.title ?? ''}
                  disabled={locked || busy}
                  onChange={(e) =>
                    onEditorChange(
                      setSectionBody(editor, section.kind, {
                        ...body,
                        title: e.target.value,
                      }),
                    )
                  }
                />
              </label>
              {section.kind === 'faq' ? (
                <FaqEditor
                  items={body.items ?? []}
                  disabled={locked || busy}
                  onChange={(items) =>
                    onEditorChange(setFaqItems(editor, items))
                  }
                />
              ) : (
                <label>
                  Nội dung
                  <textarea
                    value={body.text ?? ''}
                    disabled={locked || busy}
                    rows={3}
                    onChange={(e) =>
                      onEditorChange(
                        setSectionBody(editor, section.kind, {
                          ...body,
                          text: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
              )}
              {section.kind === 'terms' ? (
                <label>
                  termsVersion
                  <input
                    value={body.termsVersion ?? ''}
                    disabled={locked || busy}
                    onChange={(e) =>
                      onEditorChange(
                        setSectionBody(editor, section.kind, {
                          ...body,
                          termsVersion: e.target.value,
                        }),
                      )
                    }
                    spellCheck={false}
                  />
                </label>
              ) : null}
            </li>
          );
        })}
      </ol>

      {validationSummary ? (
        <p
          id={`${baseId}-validation`}
          role="alert"
          tabIndex={-1}
          className="cfg-error"
          data-testid="config-validation-error"
        >
          {validationSummary}
        </p>
      ) : null}

      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={showLocalPreview}>
          Xem trước (render)
        </button>
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void saveConfig()}
        >
          Lưu phiên bản
        </button>
        <button type="button" disabled={busy} onClick={() => void loadHistory()}>
          Lịch sử
        </button>
      </div>

      <label>
        Phiên bản cần publish / expectedPublishedVersion
        <input
          value={expectedVersion}
          onChange={(e) => onExpectedVersion(e.target.value)}
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
            onClick={() =>
              onEditorChange(startNewConfigDraftFromPublished(editor))
            }
          >
            Soạn bản mới
          </button>
        ) : null}
      </div>

      {rendered ? (
        <div
          className="cfg-preview-wrap"
          role="region"
          aria-label="Rendered config preview"
          tabIndex={0}
        >
          <ConfigRenderer
            payload={rendered.payload}
            protectedPreview
            versionLabel={
              rendered.source === 'version' && rendered.version !== null
                ? `Phiên bản ${rendered.version}`
                : 'Draft chưa publish'
            }
          />
        </div>
      ) : null}

      {historyView?.kind === 'list' ? (
        <HistoryList
          items={historyView.page.items}
          busy={busy}
          onPreview={(v) => void loadProtectedPreview(v)}
          onPickRollback={(v) => {
            setRollbackTarget(String(v));
            setRollbackConfirm(false);
          }}
        />
      ) : null}

      <fieldset className="cfg-rollback">
        <legend>Rollback (semantic — tạo phiên bản mới)</legend>
        <label>
          targetVersion
          <input
            value={rollbackTarget}
            onChange={(e) => {
              setRollbackTarget(e.target.value);
              setRollbackConfirm(false);
            }}
            inputMode="numeric"
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={rollbackConfirm}
            onChange={(e) => setRollbackConfirm(e.target.checked)}
          />{' '}
          Xác nhận rollback về phiên bản đã chọn (không sửa payload cũ)
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy || !rollbackConfirm}
            onClick={() => void confirmRollback()}
          >
            Rollback
          </button>
        </div>
        {rollbackView ? (
          <p role="status" data-testid="config-rollback-status">
            {configRollbackLabel(rollbackView)}
          </p>
        ) : null}
        {previewView?.kind === 'rejected' ? (
          <p role="status">
            Preview: {previewView.code}: {previewView.message}
          </p>
        ) : null}
      </fieldset>

      <p className="cfg-hint">
        Kinds: {EVENT_CONTENT_SECTION_KINDS.join(', ')}. Live integration B-BE
        là task riêng — fixture/transport không chứng minh acceptance đầy đủ.
      </p>
    </section>
  );
}

function FaqEditor({
  items,
  disabled,
  onChange,
}: {
  items: FaqItem[];
  disabled: boolean;
  onChange: (items: FaqItem[]) => void;
}) {
  return (
    <div className="cfg-faq" data-testid="config-faq-editor">
      {items.map((item, index) => (
        <div key={`faq-${index}`} className="cfg-faq-item">
          <label>
            Câu hỏi
            <input
              value={item.question}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, question: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label>
            Trả lời
            <textarea
              value={item.answer}
              disabled={disabled}
              rows={2}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, answer: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Xóa
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...items, { question: '', answer: '' }])}
      >
        Thêm FAQ
      </button>
    </div>
  );
}

function HistoryList({
  items,
  busy,
  onPreview,
  onPickRollback,
}: {
  items: ConfigVersionSummary[];
  busy: boolean;
  onPreview: (version: number) => void;
  onPickRollback: (version: number) => void;
}) {
  return (
    <div data-testid="config-history-list">
      <h3>Lịch sử phiên bản</h3>
      <ul>
        {items.map((item) => (
          <li key={item.version}>
            <span>
              v{item.version}
              {item.published ? ' · published' : ''} · schema{' '}
              {item.schemaVersion}
            </span>
            <div className="auth-buttons">
              <button
                type="button"
                disabled={busy}
                onClick={() => onPreview(item.version)}
              >
                Preview
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPickRollback(item.version)}
              >
                Chọn rollback
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
