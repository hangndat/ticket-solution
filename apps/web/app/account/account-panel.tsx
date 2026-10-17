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

export function AccountPanel() {
  const [current, setCurrent] = useState<unknown>(null);
  const [view, setView] =
    useState<ViewResult<AccountDeletionRequestResponse> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    void (async () => {
      // Prime CSRF cookie for subsequent mutations.
      await platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS);
      const result = await platformGet(
        '/api/bff/me/account-deletion-requests',
        REQUEST_TIMEOUT_MS,
      );
      if (result.status >= 200 && result.status < 300) {
        setCurrent(result.json);
      }
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
        disabled={busy || !confirmed}
        onClick={() => void requestDeletion()}
      >
        Gửi yêu cầu xóa tài khoản
      </button>
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
