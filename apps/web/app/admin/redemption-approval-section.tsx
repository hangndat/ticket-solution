'use client';

type Props = {
  busy: boolean;
  requestId: string;
  setRequestId: (value: string) => void;
  denyReason: string;
  setDenyReason: (value: string) => void;
  onApprove: () => void;
  onDeny: () => void;
};

export function RedemptionApprovalSection({
  busy,
  requestId,
  setRequestId,
  denyReason,
  setDenyReason,
  onApprove,
  onDeny,
}: Props) {
  return (
    <>
      <h3>Duyệt yêu cầu đổi mã</h3>
      <label>
        Request ID đang chờ
        <input
          name="requestId"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <label>
        Lý do từ chối
        <textarea
          id="admin-deny-reason"
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          rows={3}
          maxLength={500}
          required
        />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={() => void onApprove()}>
          Duyệt
        </button>
        <button type="button" disabled={busy} onClick={() => void onDeny()}>
          Từ chối
        </button>
      </div>
    </>
  );
}
