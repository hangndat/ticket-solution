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

type Props = { tenantId: string };

const ROLES: MembershipRole[] = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
];

export function TenantStaffPanel({ tenantId }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('Manager');
  const [eventId, setEventId] = useState('');
  const [eventRole, setEventRole] = useState<MembershipRole>('Manager');
  const [inviteView, setInviteView] =
    useState<ViewResult<InviteCreatedResponse> | null>(null);
  const [membersJson, setMembersJson] = useState<string | null>(null);
  const [invitesJson, setInvitesJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState('');
  const [revokeReason, setRevokeReason] = useState(
    'Owner revoke — request tiếp theo sẽ bị chặn',
  );
  const [notice, setNotice] = useState<string | null>(null);

  const tid = tenantId.trim();
  if (!tid) {
    return (
      <p className="intro">
        Chọn tenant từ selector trước khi mời / revoke thành viên.
      </p>
    );
  }

  async function loadMembers() {
    setBusy(true);
    const result = await platformGet(
      `/api/bff/tenants/${encodeURIComponent(tid)}/members`,
      REQUEST_TIMEOUT_MS,
    );
    setMembersJson(
      JSON.stringify({ status: result.status, body: result.json }, null, 2),
    );
    setBusy(false);
  }

  async function loadInvites() {
    setBusy(true);
    const result = await platformGet(
      `/api/bff/tenants/${encodeURIComponent(tid)}/invites`,
      REQUEST_TIMEOUT_MS,
    );
    setInvitesJson(
      JSON.stringify({ status: result.status, body: result.json }, null, 2),
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
        'Đã revoke membership. Cảnh báo: request tiếp theo của thành viên sẽ bị chặn — không khẳng định đã xóa session mọi thiết bị.',
      );
    } else {
      setNotice(
        typeof result.json === 'object' &&
          result.json &&
          'code' in (result.json as object)
          ? `${(result.json as { code: string }).code}`
          : `HTTP ${result.status}`,
      );
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="staff-heading" className="redeem-form">
      <h2 id="staff-heading">Thành viên &amp; invite (Owner)</h2>
      <p>
        Role map server allowlist — không gửi arbitrary permissions. Invite TTL
        48h (cấu hình security BE).
      </p>
      <label>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Role
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
        Event assignment (tuỳ chọn)
        <input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="event UUID"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Event role
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
          Gửi invite
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadMembers()}
        >
          Liệt kê members
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadInvites()}
        >
          Liệt kê invites
        </button>
      </div>
      {inviteView ? (
        <p data-testid="invite-create-result">
          {inviteView.kind === 'ok'
            ? `Invite ${inviteView.value.inviteId} · ${inviteView.value.deliveryState} · hết hạn ${inviteView.value.expiresAt}`
            : viewLabel(inviteView)}
        </p>
      ) : null}
      {membersJson ? (
        <pre className="me-result" data-testid="members-list">
          {membersJson}
        </pre>
      ) : null}
      {invitesJson ? (
        <pre className="me-result" data-testid="invites-list">
          {invitesJson}
        </pre>
      ) : null}

      <h3>Revoke membership</h3>
      <label>
        Membership ID
        <input
          value={revokeTarget}
          onChange={(e) => setRevokeTarget(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Reason
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
        Revoke (cảnh báo request tiếp theo)
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
