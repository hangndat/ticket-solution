'use client';

import { useEffect, useState } from 'react';
import {
  interpretAccountDeletion,
  viewLabel,
  type ViewResult,
} from '../../src/platform/shape';
import type { AccountDeletionRequestResponse } from '../../src/platform/contracts';
import {
  platformGet,
  platformMutate,
} from '../../src/platform/client-fetch';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { SurfaceState } from '../../src/ui/surface-state';

type DeletionCurrent = {
  requestId: string;
  state: string;
  requestedAt: string;
};

function asDeletionCurrent(json: unknown): DeletionCurrent | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const body = json as Record<string, unknown>;
  if (typeof body.requestId !== 'string' || !body.requestId.trim()) {
    return null;
  }
  return {
    requestId: body.requestId.trim(),
    state:
      typeof body.state === 'string' && body.state.trim()
        ? body.state.trim()
        : 'AWAITING_POLICY',
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
        setCurrent(asDeletionCurrent(result.json));
        setLoadPhase('ready');
        return;
      }
      if (result.status === 401 || result.status === 403) {
        setCurrent(null);
        setLoadPhase('ready');
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
    if (!confirmed) return;
    setBusy(true);
    setView(null);
    const result = await platformMutate(
      '/api/bff/me/account-deletion-requests',
      { confirmation: true, idempotencyKey: crypto.randomUUID() },
      REQUEST_TIMEOUT_MS,
    );
    setView(
      interpretAccountDeletion(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    setBusy(false);
  }

  return (
    <div className="redeem-form">
      <aside className="notice" role="note">
        <p>
          Gửi yêu cầu được hệ thống ghi nhận (có thể hiện trạng thái theo dõi).
          Đây chưa phải xóa ngay. Chúng tôi xử lý xóa hoặc ẩn danh dữ liệu cá
          nhân liên quan trong ≤ 30 ngày; nhật ký kiểm toán có thể giữ tới 730
          ngày theo chính sách. Chi tiết:{' '}
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
        <SurfaceState
          kind="empty"
          title="Chưa có yêu cầu xóa"
          detail="Bạn chưa gửi yêu cầu xóa tài khoản. Khi gửi, yêu cầu đã được tiếp nhận; chúng tôi xử lý xóa hoặc ẩn danh trong ≤ 30 ngày — chưa phải đã xóa dữ liệu ngay."
          testId="account-load-empty"
        />
      ) : null}
      {current ? (
        <section
          className="notice"
          role="status"
          data-testid="account-deletion-current"
        >
          <h2>Yêu cầu xóa đang mở</h2>
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
            Đây chưa phải đã xóa dữ liệu. Hệ thống vẫn đang xử lý theo chính
            sách (mục tiêu ≤ 30 ngày).
          </p>
        </section>
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{' '}
        Tôi hiểu đây là yêu cầu đã được tiếp nhận, không phải đã xóa ngay; mục
        tiêu xử lý xóa hoặc ẩn danh trong ≤ 30 ngày.
      </label>
      <button
        type="button"
        disabled={busy || !confirmed || loadPhase === 'loading'}
        onClick={() => void requestDeletion()}
      >
        {busy ? 'Đang gửi…' : 'Gửi yêu cầu xóa tài khoản'}
      </button>
      {busy ? (
        <SurfaceState
          kind="loading"
          title="Đang gửi yêu cầu…"
          detail="Chưa khẳng định đã xóa dữ liệu cho đến khi yêu cầu được tiếp nhận rõ."
          testId="account-submit-loading"
        />
      ) : null}
      {view ? (
        <section
          className={
            view.kind === 'rejected'
              ? 'redeem-status redeem-status--error'
              : 'notice'
          }
          role="status"
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
