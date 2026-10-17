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

export function AccountPanel() {
  const [current, setCurrent] = useState<unknown>(null);
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
        setCurrent(result.json);
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
      setLoadError(`Không tải được trạng thái tài khoản (HTTP ${result.status}).`);
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
          Yêu cầu xóa tài khoản chỉ là ACK trạng thái{' '}
          <strong>AWAITING_POLICY</strong>. Không tự xóa ticket, audit, device
          hay identity khi O06 chưa chốt.
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
          detail="Bạn chưa gửi yêu cầu xóa tài khoản. Khi gửi, trạng thái chỉ là chờ chính sách — chưa phải đã xóa dữ liệu."
          testId="account-load-empty"
        />
      ) : null}
      {current ? (
        <pre className="me-result" data-testid="account-deletion-current">
          {JSON.stringify(current, null, 2)}
        </pre>
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{' '}
        Tôi hiểu đây là yêu cầu chờ chính sách, không phải đã xóa.
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
          detail="Chưa khẳng định đã xóa dữ liệu cho đến khi có ACK rõ."
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
              Đã ghi nhận request {view.value.requestId} · state{' '}
              {view.value.state} · policy {view.value.policyStatus}. Đây chưa
              phải xóa dữ liệu.
            </p>
          ) : (
            <p>{viewLabel(view)}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
