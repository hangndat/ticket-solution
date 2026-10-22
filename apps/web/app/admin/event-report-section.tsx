'use client';

import {
  REPORT_EMAIL_CS_CTA_LABEL,
  REPORT_EMAIL_CS_SECTION_ID,
  REPORT_PENDING_APPROVAL_CTA_LABEL,
  REPORT_PENDING_APPROVAL_SECTION_ID,
  TICKET_STATES,
  formatQuotaCapacityState,
  formatQuotaRemaining,
  formatReportAsOf,
  reportShowsEmailCsCta,
  reportShowsNumbers,
  reportShowsPendingApprovalCta,
  type EventReportView,
} from '../../src/admin/report';

type AdminJob = 'setup' | 'guests' | 'gate' | 'support';

type Props = {
  activeJob: string;
  busy: boolean;
  report: EventReportView | null;
  onLoadReport: () => void;
  onGoToSection: (job: AdminJob, sectionId: string) => void;
};

export function EventReportSection({
  activeJob,
  busy,
  report,
  onLoadReport,
  onGoToSection,
}: Props) {
  return (
    <section
      className="admin-section admin-job-panel"
      data-job="gate"
      hidden={activeJob !== 'gate'}
      aria-labelledby="event-report-heading"
      data-testid="admin-gate-panel"
    >
      <h2 id="event-report-heading">Cổng · báo cáo sự kiện</h2>
      <p>
        Chỉ đọc theo snapshot máy chủ (không tự làm mới). Manager xem quota và chờ
        duyệt trước; Supervisor xem check-in thành công và từ chối theo lý do. Lỗi
        máy chủ, timeout hoặc mất mạng là chưa biết — các số đó không được hiện.
        Scan chính trên app Nhân viên; cổng web không xếp hàng offline.
      </p>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onLoadReport()}
          data-testid="event-report-reload"
        >
          Tải lại báo cáo
        </button>
      </div>
      {report && reportShowsNumbers(report) ? (
        <div data-testid="event-report-numbers">
          <p
            className="intro"
            data-testid="event-report-asof"
            role="status"
            title={report.asOf}
          >
            Số liệu tại thời điểm: {formatReportAsOf(report.asOf)} ({report.asOf})
          </p>
          <h3>Manager · quota &amp; chờ duyệt</h3>
          <dl>
            <div>
              <dt>Trạng thái sức chứa</dt>
              <dd>{formatQuotaCapacityState(report.quotaCapacityState)}</dd>
            </div>
            <div>
              <dt>Dung lượng quota</dt>
              <dd>
                {report.quota.capacity === null
                  ? 'không giới hạn / chưa có'
                  : report.quota.capacity}
              </dd>
            </div>
            <div>
              <dt>Đã cấp phát</dt>
              <dd>{report.quota.allocated}</dd>
            </div>
            <div>
              <dt>Còn lại</dt>
              <dd>
                {formatQuotaRemaining(
                  report.quotaRemaining,
                  report.quotaCapacityState,
                )}
              </dd>
            </div>
            <div>
              <dt>Chờ duyệt</dt>
              <dd data-testid="event-report-pending-approval">
                {report.pendingApprovalCount}
              </dd>
            </div>
          </dl>
          {reportShowsPendingApprovalCta(report) ? (
            <p className="intro">
              <a
                href={`#${REPORT_PENDING_APPROVAL_SECTION_ID}`}
                data-testid="event-report-cta-pending-approval"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection('guests', REPORT_PENDING_APPROVAL_SECTION_ID);
                }}
              >
                {REPORT_PENDING_APPROVAL_CTA_LABEL}
              </a>
            </p>
          ) : null}
          <h3>Vé theo trạng thái</h3>
          <dl>
            {TICKET_STATES.map((state) => (
              <div key={state}>
                <dt>{state}</dt>
                <dd>{report.ticketsByState[state]}</dd>
              </div>
            ))}
          </dl>
          <h3>Supervisor · check-in &amp; từ chối</h3>
          <dl>
            <div>
              <dt>Check-in thành công</dt>
              <dd>{report.checkInSuccessCount}</dd>
            </div>
          </dl>
          <h4>Từ chối theo lý do</h4>
          {Object.keys(report.rejectByReason).length === 0 ? (
            <p data-testid="event-report-rejects-empty" role="status">
              Chưa có lần từ chối cổng nào.
            </p>
          ) : (
            <dl data-testid="event-report-rejects">
              {Object.entries(report.rejectByReason)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([reason, count]) => (
                  <div key={reason}>
                    <dt>{reason}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
            </dl>
          )}
          <h3>Email cần CS</h3>
          <dl>
            <div>
              <dt>Email cần hỗ trợ CS</dt>
              <dd data-testid="event-report-email-cs">
                {report.emailNeedsCsCount}
              </dd>
            </div>
          </dl>
          {reportShowsEmailCsCta(report) ? (
            <p className="intro">
              <a
                href={`#${REPORT_EMAIL_CS_SECTION_ID}`}
                data-testid="event-report-cta-email-cs"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection('support', REPORT_EMAIL_CS_SECTION_ID);
                }}
              >
                {REPORT_EMAIL_CS_CTA_LABEL}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      {report && !reportShowsNumbers(report) ? (
        <p data-testid="event-report-unknown" role="status">
          {report.kind === 'rejected'
            ? `${report.code}: ${report.message}`
            : report.message}
        </p>
      ) : null}
    </section>
  );
}
