'use client';

type Props = {
  busy: boolean;
  exportId: string;
  setExportId: (value: string) => void;
  onCreateExport: () => void;
  onLoadStatus: () => void;
  onDownload: () => void;
};

export function ExportSection({
  busy,
  exportId,
  setExportId,
  onCreateExport,
  onLoadStatus,
  onDownload,
}: Props) {
  return (
    <section className="admin-section" aria-labelledby="export-heading">
      <h2 id="export-heading">Export CSV</h2>
      <p>
        Job nền + link tải có hạn (MinIO private). Không lưu URL dài hạn trên form.
      </p>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreateExport()}
        >
          Tạo export CSV
        </button>
      </div>
      <label>
        Export ID
        <input
          name="exportId"
          value={exportId}
          onChange={(e) => setExportId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onLoadStatus()}
        >
          Trạng thái export
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDownload()}
        >
          Tải CSV
        </button>
      </div>
    </section>
  );
}
