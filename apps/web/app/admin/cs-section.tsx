'use client';

import {
  csNotificationStatusText,
  formatCsTimelineItem,
  type CsView,
} from '../../src/admin/cs';

type Props = {
  busy: boolean;
  csQuery: string;
  setCsQuery: (value: string) => void;
  csTicketId: string;
  setCsTicketId: (value: string) => void;
  csCursor: string | null;
  csView: CsView | null;
  resendCooldownActive: boolean;
  resendCooldownRemainingSec: number;
  onSearch: () => void;
  onSearchNext: () => void;
  onResetCursor: () => void;
  onDetail: () => void;
  onResend: () => void;
};

export function CsSection({
  busy,
  csQuery,
  setCsQuery,
  csTicketId,
  setCsTicketId,
  csCursor,
  csView,
  resendCooldownActive,
  resendCooldownRemainingSec,
  onSearch,
  onSearchNext,
  onResetCursor,
  onDetail,
  onResend,
}: Props) {
  return (
    <section className="admin-section" aria-labelledby="cs-heading">
      <h2 id="cs-heading" tabIndex={-1}>
        Hỗ trợ · tra cứu và gửi lại email
      </h2>
      <p>
        PII mặc định đã che trên API. Copy trạng thái: PENDING / FAILED / DEAD /
        ACCEPTED (≠ đã nhận). DELIVERED chỉ khi server có bằng chứng giao — không
        suy từ ACCEPTED. Resend tôn trọng cooldown và quyền cs.resend; không tạo
        vé mới.
      </p>
      <label>
        Từ khóa CS
        <input
          name="csQuery"
          value={csQuery}
          onChange={(e) => {
            setCsQuery(e.target.value);
            onResetCursor();
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onResetCursor();
            void onSearch();
          }}
        >
          Tìm vé CS
        </button>
        {csCursor ? (
          <button type="button" disabled={busy} onClick={() => void onSearchNext()}>
            Trang CS tiếp
          </button>
        ) : null}
      </div>
      <label>
        Ticket ID
        <input
          name="csTicketId"
          value={csTicketId}
          onChange={(e) => setCsTicketId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={() => void onDetail()}>
          Xem chi tiết CS
        </button>
        <button
          type="button"
          disabled={busy || resendCooldownActive}
          data-testid="cs-resend-button"
          onClick={() => void onResend()}
        >
          {resendCooldownActive
            ? `Gửi lại email (chờ ${resendCooldownRemainingSec}s)`
            : 'Gửi lại email'}
        </button>
      </div>
      {resendCooldownActive ? (
        <p className="muted" data-testid="cs-resend-cooldown" role="status">
          Đang trong cooldown gửi lại (~{resendCooldownRemainingSec}s còn lại).
          Không tạo vé mới; ACCEPTED/PENDING ≠ đã giao tới người nhận.
        </p>
      ) : null}
      {csView?.kind === 'rejected' && csView.code === 'PERMISSION_DENIED' ? (
        <p data-testid="cs-permission-denied" role="alert">
          Thiếu quyền CS — không tra cứu/gửi lại được trên tenant/event này.
        </p>
      ) : null}
      {csView?.kind === 'list' ? (
        <ul
          data-testid="cs-list"
          className="cs-ticket-list"
          aria-label="CS list"
        >
          {csView.items.map((item) => (
            <li
              key={item.ticketId}
              data-ticket-id={item.ticketId}
              data-testid={`cs-list-item-${item.ticketId}`}
            >
              <button
                type="button"
                className="cs-ticket-list__pick"
                disabled={busy}
                onClick={() => setCsTicketId(item.ticketId)}
              >
                Chọn
              </button>
              <span>
                <code>{item.ticketId}</code> · {item.state} ·{' '}
                {item.ownerEmailMasked ?? 'email=null'} ·{' '}
                {csNotificationStatusText(item.notification)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {csView?.kind === 'detail' ? (
        <div data-testid="cs-detail">
          <dl className="cs-detail-summary" aria-label="CS detail">
            <div>
              <dt>Vé</dt>
              <dd>
                <code>{csView.ticket.ticketId}</code>
              </dd>
            </div>
            <div>
              <dt>Trạng thái vé</dt>
              <dd>{csView.ticket.state}</dd>
            </div>
            <div>
              <dt>Email (đã che)</dt>
              <dd>{csView.ticket.ownerEmailMasked ?? 'null'}</dd>
            </div>
            <div>
              <dt>Gửi email</dt>
              <dd data-testid="cs-delivery-status">
                {csNotificationStatusText(csView.ticket.notification)}
              </dd>
            </div>
          </dl>
          <h3 className="cs-timeline-heading" id="cs-timeline-heading">
            Timeline (thời gian · hành động · kết quả)
          </h3>
          <ol
            data-testid="cs-timeline"
            className="cs-timeline"
            aria-labelledby="cs-timeline-heading"
          >
            {csView.ticket.timeline.map((item) => {
              const row = formatCsTimelineItem(item);
              return (
                <li key={`${item.at}-${item.kind}-${item.summary}`}>
                  <time dateTime={row.time}>{row.time}</time>
                  <span className="cs-timeline__action">{row.action}</span>
                  <span className="cs-timeline__result">{row.result}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      {csView?.kind === 'resent' ? (
        <p data-testid="cs-resend-pending" role="status">
          Đã xếp hàng gửi lại (PENDING). Chưa khẳng định ACCEPTED hay đã giao.
        </p>
      ) : null}
    </section>
  );
}
