'use client';

import { Button } from '@ticket/ui';

import { useEffect, useRef, useState } from 'react';
import {
  interpretAccountDeletion,
  viewLabel,
  type ViewResult,
} from '../../../src/bff/me-shape';
import type { AccountDeletionRequestResponse } from '../../../src/bff/platform-contracts';
import {
  platformGet,
  platformMutate,
} from '../../../src/bff/same-origin-fetch';
import { REQUEST_TIMEOUT_MS } from '../../../src/redeem/poll-operation';
import {
  accountDeletionCurrentPanel,
  accountDeletionFormRoot,
  accountDeletionNote,
  accountDeletionOutcomeError,
  accountDeletionOutcomeOk,
} from '../../../src/account/account-flow-surface';
import { liveRegionForStatus } from '../../../src/ui/live-region';
import { SurfaceState } from '../../../src/ui/surface-state';

type DeletionCurrent = {
  requestId: string;
  state: string;
  requestedAt: string;
};

function asDeletionCurrent(json: unknown): DeletionCurrent | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const body = json as Record<string, unknown>;
  if (typeof body.requestId !== 'string' || !body.requestId.trim() ||
      typeof body.state !== 'string' || ![
        'REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY', 'COMPLETED', 'REJECTED',
      ].includes(body.state)) {
    return null;
  }
  return {
    requestId: body.requestId.trim(),
    state: body.state,
    requestedAt:
      typeof body.requestedAt === 'string' ? body.requestedAt : '',
  };
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function stateLabel(state: string): string {
  switch (state) {
    case 'REQUESTED':
      return 'Đã gửi yêu cầu';
    case 'UNDER_REVIEW':
      return 'Đang xem xét';
    case 'AWAITING_POLICY':
      return 'Đang chờ xử lý theo chính sách';
    case 'COMPLETED':
      return 'Đã hoàn tất';
    case 'REJECTED':
      return 'Đã từ chối';
    default:
      return 'Đang theo dõi';
  }
}

export function AccountPanel() {
  const [current, setCurrent] = useState<DeletionCurrent | null>(null);
  const [loadPhase, setLoadPhase] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] =
    useState<ViewResult<AccountDeletionRequestResponse> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const inFlight = useRef(false);
  const attemptKey = useRef<string | null>(null);
  const openRequest = current !== null &&
    (current.state === 'REQUESTED' || current.state === 'UNDER_REVIEW' ||
      current.state === 'AWAITING_POLICY');
  const canRequest = !current || current.state === 'REJECTED';

  useEffect(() => {
    void (async () => {
      setLoadPhase('loading');
      setLoadError(null);
      // Prime CSRF cookie for subsequent mutations.
      await platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS);
      const result = await platformGet(
        '/api/bff/me/account-deletion-requests',
        REQUEST_TIMEOUT_MS,
      );
      if (result.networkError || result.timedOut) {
        setLoadPhase('error');
        setLoadError(
          'Không tải được yêu cầu xóa hiện tại — mạng lỗi hoặc hết thời gian chờ.',
        );
        return;
      }
      if (result.status >= 200 && result.status < 300) {
        const parsed = asDeletionCurrent(result.json);
        if (result.json !== null && !parsed) {
          setLoadPhase('error');
          setLoadError('Trạng thái tài khoản không hợp lệ. Thử lại sau.');
          return;
        }
        setCurrent(parsed);
        setLoadPhase('ready');
        return;
      }
      if (result.status === 401 || result.status === 403) {
        setCurrent(null);
        setLoadPhase('error');
        setLoadError('Đăng nhập để xem hoặc gửi yêu cầu xóa tài khoản.');
        return;
      }
      if (result.status === 404) {
        setCurrent(null);
        setLoadPhase('ready');
        return;
      }
      setLoadPhase('error');
      setLoadError(
        'Không tải được trạng thái tài khoản. Thử lại sau vài phút.',
      );
    })();
  }, []);

  async function requestDeletion() {
    if (!confirmed || inFlight.current || busy || loadPhase !== 'ready' ||
        !canRequest || view?.kind === 'ok') return;
    inFlight.current = true;
    setBusy(true);
    setView(null);
    const key = attemptKey.current ?? crypto.randomUUID();
    attemptKey.current = key;
    try {
      const result = await platformMutate(
        '/api/bff/me/account-deletion-requests',
        { confirmation: true, idempotencyKey: key },
        REQUEST_TIMEOUT_MS,
      );
      const next = interpretAccountDeletion(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      );
      setView(next.kind === 'unknown' ? {
        kind: 'unknown',
        message: 'Chưa xác nhận được yêu cầu. Đăng nhập lại nếu phiên hết hạn, kiểm tra trạng thái rồi chỉ gửi lại cùng yêu cầu.',
      } : next);
      if (next.kind === 'ok') {
        setCurrent(asDeletionCurrent(next.value));
        setConfirmed(false);
        attemptKey.current = null;
      } else if (next.kind === 'rejected') {
        attemptKey.current = null;
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const resultLive =
    view?.kind === 'rejected' || view?.kind === 'unknown'
      ? liveRegionForStatus(view.kind === 'unknown' ? 'unknown' : 'error')
      : view?.kind === 'ok'
        ? liveRegionForStatus('success')
        : null;

  return (
    <div className={accountDeletionFormRoot}>
      <aside className={accountDeletionNote} role="note">
        <p>
          Gửi yêu cầu xóa hoặc ẩn danh dữ liệu cá nhân. Xử lý trong tối đa 30
          ngày theo chính sách. Nhật ký kiểm toán có thể được giữ tối đa 730
          ngày. Chi tiết:{' '}
          <a href="/privacy">chính sách quyền riêng tư</a>.
        </p>
      </aside>
      {loadPhase === 'loading' ? (
        <SurfaceState
          kind="loading"
          title="Đang tải trạng thái tài khoản…"
          detail="Kiểm tra yêu cầu xóa đang mở (nếu có)."
          testId="account-load-loading"
        />
      ) : null}
      {loadPhase === 'error' ? (
        <SurfaceState
          kind="error"
          title="Không tải được trạng thái"
          detail={loadError ?? 'Thử lại sau.'}
          testId="account-load-error"
        />
      ) : null}
      {loadPhase === 'ready' && !current ? (
        <p className="m-0 text-[0.92rem] text-muted" data-testid="account-load-empty">
          Chưa có yêu cầu xóa tài khoản.
        </p>
      ) : null}
      {current && view?.kind !== 'ok' ? (
        <section
          className={accountDeletionCurrentPanel}
          role="status"
          data-testid="account-deletion-current"
        >
          <h2>{openRequest ? 'Yêu cầu xóa đang mở' :
            current.state === 'COMPLETED' ? 'Yêu cầu đã hoàn tất' : 'Yêu cầu đã bị từ chối'}</h2>
          <dl>
            <div>
              <dt>Trạng thái</dt>
              <dd>{stateLabel(current.state)}</dd>
            </div>
            <div>
              <dt>Mã theo dõi</dt>
              <dd>
                <code title={current.requestId}>
                  {shortId(current.requestId)}
                </code>
              </dd>
            </div>
            {current.requestedAt ? (
              <div>
                <dt>Thời điểm gửi</dt>
                <dd>
                  <time dateTime={current.requestedAt}>
                    {current.requestedAt}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
          <p>
            {current.state === 'COMPLETED'
              ? 'Yêu cầu đã hoàn tất theo chính sách. Xem chính sách quyền riêng tư để biết phạm vi dữ liệu được giữ lại.'
              : current.state === 'REJECTED'
                ? 'Yêu cầu trước đã bị từ chối. Bạn có thể gửi yêu cầu mới nếu vẫn muốn xóa tài khoản.'
                : 'Yêu cầu đang được theo dõi; đây chưa phải xác nhận đã xóa dữ liệu.'}
          </p>
        </section>
      ) : null}
      {canRequest && view?.kind !== 'ok' ? <label className="account-deletion-consent">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={loadPhase !== 'ready' || busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>Tôi đã đọc và muốn gửi yêu cầu xóa tài khoản.</span>
      </label> : null}
      {canRequest && view?.kind !== 'ok' ? <Button
        type="button"
        variant="destructive"
        disabled={busy || !confirmed || loadPhase !== 'ready'}
        loading={busy}
        loadingLabel="Đang gửi…"
        onClick={() => void requestDeletion()}
      >
        {view?.kind === 'unknown' ? 'Gửi lại cùng yêu cầu' : 'Gửi yêu cầu xóa tài khoản'}
      </Button> : null}
      {busy ? (
        <SurfaceState
          kind="loading"
          title="Đang gửi yêu cầu…"
          detail="Chưa khẳng định đã xóa dữ liệu cho đến khi yêu cầu được tiếp nhận rõ."
          testId="account-submit-loading"
        />
      ) : null}
      {view && resultLive ? (
        <section
          className={
            view.kind === 'rejected' || view.kind === 'unknown'
              ? accountDeletionOutcomeError
              : accountDeletionOutcomeOk
          }
          role={resultLive.role}
          aria-live={resultLive.ariaLive}
          aria-atomic={resultLive.ariaAtomic}
          data-testid="account-deletion-result"
        >
          {view.kind === 'ok' ? (
            <p>
              Đã tiếp nhận yêu cầu {shortId(view.value.requestId)}. Đây chưa
              phải xóa dữ liệu ngay; chúng tôi xử lý xóa hoặc ẩn danh trong ≤ 30
              ngày theo chính sách.
            </p>
          ) : (
            <p>{viewLabel(view)}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
