'use client';

import { useState } from 'react';
import {
  interpretInviteCreated,
  viewLabel,
  type ViewResult,
} from '../../src/platform/shape';
import type {
  InviteCreatedResponse,
  MembershipRole,
} from '../../src/platform/contracts';
import {
  platformGet,
  platformMutate,
} from '../../src/platform/client-fetch';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { SurfaceState } from '../../src/ui/surface-state';

type Props = { tenantId: string };

const ROLES: MembershipRole[] = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
];

type StaffMemberRow = {
  membershipId: string;
  email: string;
  role: string;
  status: string;
};

type StaffInviteRow = {
  inviteId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
};

type ListLoad<T> =
  | { kind: 'ok'; rows: T[] }
  | { kind: 'error'; detail: string }
  | { kind: 'empty' };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function listRows(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const body = asRecord(json);
  if (!body) return [];
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.members)) return body.members;
  if (Array.isArray(body.invites)) return body.invites;
  return [];
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function memberStatus(row: Record<string, unknown>): string {
  if (row.revokedAt != null) return 'Đã thu hồi';
  if (row.activatedAt != null || row.status === 'ACTIVE') return 'Đang hoạt động';
  if (typeof row.status === 'string' && row.status.trim()) {
    return row.status.trim();
  }
  return 'Không rõ';
}

function inviteStatus(row: Record<string, unknown>): string {
  const state =
    pickString(row, ['state', 'status', 'deliveryState']) ?? 'PENDING';
  switch (state) {
    case 'PENDING':
      return 'Chờ chấp nhận';
    case 'FAILED':
      return 'Gửi thất bại';
    case 'USED':
    case 'ACCEPTED':
      return 'Đã dùng';
    case 'REVOKED':
      return 'Đã thu hồi';
    case 'EXPIRED':
      return 'Hết hạn';
    default:
      return state;
  }
}

function parseMembers(json: unknown): StaffMemberRow[] {
  const rows: StaffMemberRow[] = [];
  for (const item of listRows(json)) {
    const row = asRecord(item);
    if (!row) continue;
    const membershipId =
      pickString(row, ['membershipId', 'id']) ?? `row-${rows.length}`;
    rows.push({
      membershipId,
      email: pickString(row, ['email', 'userEmail', 'userId']) ?? '—',
      role: pickString(row, ['role']) ?? '—',
      status: memberStatus(row),
    });
  }
  return rows;
}

function parseInvites(json: unknown): StaffInviteRow[] {
  const rows: StaffInviteRow[] = [];
  for (const item of listRows(json)) {
    const row = asRecord(item);
    if (!row) continue;
    const inviteId =
      pickString(row, ['inviteId', 'id']) ?? `invite-${rows.length}`;
    rows.push({
      inviteId,
      email: pickString(row, ['email', 'inviteEmail']) ?? '—',
      role: pickString(row, ['role']) ?? '—',
      status: inviteStatus(row),
      expiresAt: pickString(row, ['expiresAt']),
    });
  }
  return rows;
}

function loadListResult<T>(
  status: number,
  json: unknown,
  networkError: boolean,
  timedOut: boolean,
  parse: (json: unknown) => T[],
): ListLoad<T> {
  if (networkError || timedOut || status === 0 || status >= 500) {
    return {
      kind: 'error',
      detail: 'Không tải được danh sách — mạng lỗi hoặc hết thời gian chờ.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'error',
      detail:
        'Tài khoản chưa có quyền Owner xem thành viên hoặc lời mời trong tổ chức này.',
    };
  }
  if (status < 200 || status >= 300) {
    const body = asRecord(json);
    const code = typeof body?.code === 'string' ? body.code : null;
    return {
      kind: 'error',
      detail: code
        ? `Không tải được danh sách (${code}).`
        : 'Không tải được danh sách. Thử lại sau.',
    };
  }
  const rows = parse(json);
  return rows.length === 0 ? { kind: 'empty' } : { kind: 'ok', rows };
}

export function TenantStaffPanel({ tenantId }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('Manager');
  const [eventId, setEventId] = useState('');
  const [eventRole, setEventRole] = useState<MembershipRole>('Manager');
  const [inviteView, setInviteView] =
    useState<ViewResult<InviteCreatedResponse> | null>(null);
  const [membersLoad, setMembersLoad] = useState<ListLoad<StaffMemberRow> | null>(
    null,
  );
  const [invitesLoad, setInvitesLoad] = useState<ListLoad<StaffInviteRow> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState('');
  const [revokeReason, setRevokeReason] = useState(
    'Owner revoke — request tiếp theo sẽ bị chặn',
  );
  const [notice, setNotice] = useState<string | null>(null);

  const tid = tenantId.trim();
  if (!tid) {
    return (
      <SurfaceState
        kind="empty"
        title="Chưa chọn tenant"
        detail="Chọn tenant từ selector trước khi mời hoặc thu hồi thành viên."
        testId="staff-tenant-empty"
      />
    );
  }

  async function loadMembers() {
    setBusy(true);
    const result = await platformGet(
      `/api/bff/tenants/${encodeURIComponent(tid)}/members`,
      REQUEST_TIMEOUT_MS,
    );
    setMembersLoad(
      loadListResult(
        result.status,
        result.json,
        result.networkError,
        result.timedOut,
        parseMembers,
      ),
    );
    setBusy(false);
  }

  async function loadInvites() {
    setBusy(true);
    const result = await platformGet(
      `/api/bff/tenants/${encodeURIComponent(tid)}/invites`,
      REQUEST_TIMEOUT_MS,
    );
    setInvitesLoad(
      loadListResult(
        result.status,
        result.json,
        result.networkError,
        result.timedOut,
        parseInvites,
      ),
    );
    setBusy(false);
  }

  async function createInvite() {
    setBusy(true);
    setInviteView(null);
    const body: Record<string, unknown> = {
      email: email.trim(),
      role,
      idempotencyKey: crypto.randomUUID(),
    };
    if (eventId.trim()) {
      body.eventAssignments = [
        { eventId: eventId.trim(), role: eventRole },
      ];
    }
    const result = await platformMutate(
      `/api/bff/tenants/${encodeURIComponent(tid)}/invites`,
      body,
      REQUEST_TIMEOUT_MS,
    );
    setInviteView(
      interpretInviteCreated(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    setBusy(false);
  }

  async function revokeMember() {
    setBusy(true);
    setNotice(null);
    const mid = revokeTarget.trim();
    const result = await platformMutate(
      `/api/bff/tenants/${encodeURIComponent(tid)}/members/${encodeURIComponent(mid)}/revoke`,
      {
        reason: revokeReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (result.status >= 200 && result.status < 300) {
      setNotice(
        'Đã thu hồi thành viên. Cảnh báo: yêu cầu tiếp theo của thành viên sẽ bị chặn — không khẳng định đã xóa phiên trên mọi thiết bị.',
      );
    } else {
      const body = asRecord(result.json);
      const code = typeof body?.code === 'string' ? body.code : null;
      setNotice(
        code
          ? `Không thu hồi được (${code}).`
          : 'Không thu hồi được thành viên. Thử lại sau.',
      );
    }
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="staff-heading"
      className="admin-section admin-staff-panel"
    >
      <h2 id="staff-heading">Thành viên &amp; lời mời</h2>
      <p className="admin-section-lead">
        Mời thành viên và xem danh sách — cần quyền Owner. Lời mời hết hạn sau
        48 giờ (theo cấu hình bảo mật).
      </p>
      <details className="admin-tech-details">
        <summary>Gửi lời mời mới</summary>
      <label>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Vai trò
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MembershipRole)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        Gán sự kiện (tuỳ chọn)
        <input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="mã sự kiện (UUID)"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Vai trò sự kiện
        <select
          value={eventRole}
          onChange={(e) => setEventRole(e.target.value as MembershipRole)}
        >
          {ROLES.filter((r) => r !== 'Owner').map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createInvite()}
        >
          Gửi lời mời
        </button>
      </div>
      </details>
      <div className="auth-buttons admin-section-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadMembers()}
        >
          Liệt kê thành viên
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadInvites()}
        >
          Liệt kê lời mời
        </button>
      </div>
      {busy ? (
        <SurfaceState
          kind="loading"
          title="Đang xử lý thành viên…"
          detail="Chờ phản hồi — chưa khẳng định kết quả."
          testId="staff-busy-loading"
        />
      ) : null}
      {inviteView ? (
        <p data-testid="invite-create-result">
          {inviteView.kind === 'ok'
            ? `Lời mời ${inviteView.value.inviteId} · ${inviteView.value.deliveryState === 'FAILED' ? 'gửi thất bại' : 'đã tạo'} · hết hạn ${inviteView.value.expiresAt}`
            : viewLabel(inviteView)}
        </p>
      ) : null}
      {membersLoad ? (
        <div data-testid="members-list">
          {membersLoad.kind === 'error' ? (
            <SurfaceState
              kind="error"
              title="Chưa xem được thành viên"
              detail={membersLoad.detail}
            />
          ) : null}
          {membersLoad.kind === 'empty' ? (
            <SurfaceState
              kind="empty"
              title="Chưa có thành viên"
              detail="Danh sách trống hoặc máy chủ chưa trả dữ liệu thành viên."
            />
          ) : null}
          {membersLoad.kind === 'ok' ? (
            <div className="tablewrap">
              <table className="admin-table staff-table">
                <caption>Thành viên</caption>
                <thead>
                  <tr>
                    <th scope="col">Email / định danh</th>
                    <th scope="col">Vai trò</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Mã thành viên</th>
                  </tr>
                </thead>
                <tbody>
                  {membersLoad.rows.map((row) => (
                    <tr key={row.membershipId}>
                      <td data-label="Email / định danh">{row.email}</td>
                      <td data-label="Vai trò">{row.role}</td>
                      <td data-label="Trạng thái">{row.status}</td>
                      <td data-label="Mã thành viên">
                        <code>{row.membershipId}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {invitesLoad ? (
        <div data-testid="invites-list">
          {invitesLoad.kind === 'error' ? (
            <SurfaceState
              kind="error"
              title="Chưa xem được lời mời"
              detail={invitesLoad.detail}
            />
          ) : null}
          {invitesLoad.kind === 'empty' ? (
            <SurfaceState
              kind="empty"
              title="Chưa có lời mời"
              detail="Danh sách trống hoặc máy chủ chưa trả dữ liệu lời mời."
            />
          ) : null}
          {invitesLoad.kind === 'ok' ? (
            <div className="tablewrap">
              <table className="admin-table staff-table">
                <caption>Lời mời</caption>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Vai trò</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Hết hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {invitesLoad.rows.map((row) => (
                    <tr key={row.inviteId}>
                      <td data-label="Email">{row.email}</td>
                      <td data-label="Vai trò">{row.role}</td>
                      <td data-label="Trạng thái">{row.status}</td>
                      <td data-label="Hết hạn">{row.expiresAt ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="admin-tech-details">
        <summary>Thu hồi thành viên (kỹ thuật)</summary>
        <label>
          Mã thành viên
          <input
            value={revokeTarget}
            onChange={(e) => setRevokeTarget(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Lý do
          <input
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || !revokeTarget.trim()}
          onClick={() => void revokeMember()}
        >
          Thu hồi (cảnh báo yêu cầu tiếp theo)
        </button>
        {notice ? <p role="status">{notice}</p> : null}
      </details>
    </section>
  );
}
