'use client';

import type { EventDetail } from '@ticket/contracts';
import { eventImpactLabel } from '../../src/admin/event-lifecycle';
import type { EventImpactView } from '../../src/admin/event-lifecycle';

type Props = {
  activeJob: string;
  busy: boolean;
  currentEvent: EventDetail | null;
  eventId: string;
  metaStartsAt: string;
  setMetaStartsAt: (value: string) => void;
  metaEndsAt: string;
  setMetaEndsAt: (value: string) => void;
  metaVenueName: string;
  setMetaVenueName: (value: string) => void;
  metaVenueAddress: string;
  setMetaVenueAddress: (value: string) => void;
  metaContactEmail: string;
  setMetaContactEmail: (value: string) => void;
  metaRedeemOpen: string;
  setMetaRedeemOpen: (value: string) => void;
  metaRedeemClose: string;
  setMetaRedeemClose: (value: string) => void;
  metaCheckInOpen: string;
  setMetaCheckInOpen: (value: string) => void;
  metaCheckInClose: string;
  setMetaCheckInClose: (value: string) => void;
  metaMaxTickets: string;
  setMetaMaxTickets: (value: string) => void;
  confirmIssuedImpact: boolean;
  setConfirmIssuedImpact: (value: boolean) => void;
  notifyAttendees: boolean;
  setNotifyAttendees: (value: boolean) => void;
  cloneSlug: string;
  setCloneSlug: (value: string) => void;
  cloneName: string;
  setCloneName: (value: string) => void;
  copyConfig: boolean;
  setCopyConfig: (value: boolean) => void;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  impactView: EventImpactView | null;
  onPreviewImpact: () => void;
  onSaveMetadata: () => void;
  onClone: () => void;
  onArchive: () => void;
  onCancel: () => void;
};

export function EventLifecycleSection({
  activeJob,
  busy,
  currentEvent,
  eventId,
  metaStartsAt,
  setMetaStartsAt,
  metaEndsAt,
  setMetaEndsAt,
  metaVenueName,
  setMetaVenueName,
  metaVenueAddress,
  setMetaVenueAddress,
  metaContactEmail,
  setMetaContactEmail,
  metaRedeemOpen,
  setMetaRedeemOpen,
  metaRedeemClose,
  setMetaRedeemClose,
  metaCheckInOpen,
  setMetaCheckInOpen,
  metaCheckInClose,
  setMetaCheckInClose,
  metaMaxTickets,
  setMetaMaxTickets,
  confirmIssuedImpact,
  setConfirmIssuedImpact,
  notifyAttendees,
  setNotifyAttendees,
  cloneSlug,
  setCloneSlug,
  cloneName,
  setCloneName,
  copyConfig,
  setCopyConfig,
  cancelReason,
  setCancelReason,
  impactView,
  onPreviewImpact,
  onSaveMetadata,
  onClone,
  onArchive,
  onCancel,
}: Props) {
  return (
    <section
      className="admin-section admin-job-panel"
      data-job="setup"
      hidden={activeJob !== 'setup'}
      aria-labelledby="event-lifecycle-heading"
    >
      <h2 id="event-lifecycle-heading">Metadata &amp; vòng đời</h2>
      <p>
        Cập nhật thời gian, địa điểm và liên hệ. Đổi lịch/địa điểm sau khi đã có vé
        cần xem trước tác động và xác nhận. Clone chỉ bản nháp — không sao
        staff/mã/vé. Hủy và lưu trữ tách trạng thái vận hành / nội dung.
      </p>
      <details className="admin-tech-details">
        <summary>Chi tiết kỹ thuật · metadata</summary>
        <p className="muted">
          Lưu metadata dùng PATCH + expectedRevision. Impact preview +
          confirmIssuedImpact khi đổi startsAt/venue sau khi đã có vé. Cancel/archive
          tách business/content status.
        </p>
      </details>
      <label>
        startsAt (UTC ISO)
        <input
          name="metaStartsAt"
          value={metaStartsAt}
          onChange={(e) => setMetaStartsAt(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="2026-11-01T10:00:00.000Z"
        />
      </label>
      <label>
        endsAt (UTC ISO)
        <input
          name="metaEndsAt"
          value={metaEndsAt}
          onChange={(e) => setMetaEndsAt(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Venue name
        <input
          name="metaVenueName"
          value={metaVenueName}
          onChange={(e) => setMetaVenueName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Venue address
        <input
          name="metaVenueAddress"
          value={metaVenueAddress}
          onChange={(e) => setMetaVenueAddress(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Contact email
        <input
          name="metaContactEmail"
          value={metaContactEmail}
          onChange={(e) => setMetaContactEmail(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Redemption opensAt
        <input
          name="metaRedeemOpen"
          value={metaRedeemOpen}
          onChange={(e) => setMetaRedeemOpen(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Redemption closesAt
        <input
          name="metaRedeemClose"
          value={metaRedeemClose}
          onChange={(e) => setMetaRedeemClose(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Check-in opensAt
        <input
          name="metaCheckInOpen"
          value={metaCheckInOpen}
          onChange={(e) => setMetaCheckInOpen(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Check-in closesAt
        <input
          name="metaCheckInClose"
          value={metaCheckInClose}
          onChange={(e) => setMetaCheckInClose(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        maxTicketsPerAttendee (trống = unlimited)
        <input
          name="metaMaxTickets"
          value={metaMaxTickets}
          onChange={(e) => setMetaMaxTickets(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmIssuedImpact}
          onChange={(e) => setConfirmIssuedImpact(e.target.checked)}
        />{' '}
        confirmIssuedImpact (bắt buộc khi impact requiresConfirm)
      </label>
      <label>
        <input
          type="checkbox"
          checked={notifyAttendees}
          onChange={(e) => setNotifyAttendees(e.target.checked)}
        />{' '}
        notifyAttendees
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || !currentEvent}
          onClick={() => void onPreviewImpact()}
        >
          Preview impact
        </button>
        <button
          type="button"
          disabled={busy || !currentEvent}
          onClick={() => void onSaveMetadata()}
        >
          Lưu metadata
        </button>
      </div>
      {impactView?.kind === 'preview' ? (
        <aside
          className="notice"
          role="status"
          data-testid="event-impact-preview"
        >
          <p>{eventImpactLabel(impactView)}</p>
          <ul>
            {impactView.preview.diff.map((d) => (
              <li key={`${d.field}-${d.from}-${d.to}`}>
                {d.field}: {d.from ?? '∅'} → {d.to ?? '∅'}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      <h3>Clone DRAFT</h3>
      <label>
        Clone slug
        <input
          name="cloneSlug"
          value={cloneSlug}
          onChange={(e) => setCloneSlug(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Clone name
        <input
          name="cloneName"
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={copyConfig}
          onChange={(e) => setCopyConfig(e.target.checked)}
        />{' '}
        copyConfig (allowlist cấu hình; không inventory/staff)
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || !eventId.trim()}
          onClick={() => void onClone()}
        >
          Clone event
        </button>
      </div>
      <h3>Archive / Cancel</h3>
      <label>
        Cancel reason
        <input
          name="cancelReason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Lý do hủy (1–500)"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || !currentEvent}
          onClick={() => void onArchive()}
        >
          Archive (content)
        </button>
        <button
          type="button"
          disabled={busy || !currentEvent || cancelReason.trim().length < 1}
          onClick={() => void onCancel()}
        >
          Cancel (business)
        </button>
      </div>
    </section>
  );
}
