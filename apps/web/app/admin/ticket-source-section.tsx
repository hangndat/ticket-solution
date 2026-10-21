'use client';

type Props = {
  activeJob: string;
  busy: boolean;
  ticketTypeLabelInput: string;
  setTicketTypeLabelInput: (value: string) => void;
  ticketTypeId: string;
  setTicketTypeId: (value: string) => void;
  sourceName: string;
  setSourceName: (value: string) => void;
  approvalMode: 'AUTO' | 'MANUAL';
  setApprovalMode: (value: 'AUTO' | 'MANUAL') => void;
  sourceId: string;
  setSourceId: (value: string) => void;
  onCreateTicketType: () => void;
  onCreateSource: () => void;
};

export function TicketSourceSection({
  activeJob,
  busy,
  ticketTypeLabelInput,
  setTicketTypeLabelInput,
  ticketTypeId,
  setTicketTypeId,
  sourceName,
  setSourceName,
  approvalMode,
  setApprovalMode,
  sourceId,
  setSourceId,
  onCreateTicketType,
  onCreateSource,
}: Props) {
  return (
    <section
      className="admin-section admin-job-panel"
      data-job="setup"
      hidden={activeJob !== 'setup'}
      aria-labelledby="type-source-heading"
    >
      <h2 id="type-source-heading">Loại vé &amp; nguồn mã</h2>
      <p>
        Mapping type → source bắt buộc trước import. Không seed SQL cho type/source.
      </p>
      <label>
        Ticket type label
        <input
          name="ticketTypeLabel"
          value={ticketTypeLabelInput}
          onChange={(e) => setTicketTypeLabelInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreateTicketType()}
        >
          Tạo ticket type
        </button>
      </div>
      <details className="admin-tech-details">
        <summary>Chi tiết kỹ thuật · ticket type ID</summary>
        <label>
          Ticket type ID
          <input
            name="ticketTypeId"
            value={ticketTypeId}
            onChange={(e) => setTicketTypeId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </details>
      <label>
        Source name
        <input
          name="sourceName"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Approval mode
        <select
          name="approvalMode"
          value={approvalMode}
          onChange={(e) =>
            setApprovalMode(e.target.value === 'MANUAL' ? 'MANUAL' : 'AUTO')
          }
        >
          <option value="AUTO">AUTO</option>
          <option value="MANUAL">MANUAL</option>
        </select>
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreateSource()}
        >
          Tạo source
        </button>
      </div>
      <details className="admin-tech-details">
        <summary>Chi tiết kỹ thuật · source ID</summary>
        <label>
          Source ID
          <input
            name="sourceId"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </details>
    </section>
  );
}
