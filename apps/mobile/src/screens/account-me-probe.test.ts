import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MeResponse } from '@ticket/contracts';
import { accountCopy } from '../components/screen-state-copy.ts';
import { accountMeRefreshFromProbe } from './account-me-probe.ts';

const epochUserId = '11111111-1111-1111-1111-111111111111';

const sampleMe: MeResponse = {
  userId: epochUserId,
  issuer: 'https://id.example/realms/ticket',
  subject: 'sub-1',
  email: 'u@example.com',
  emailVerified: true,
};

test('ok matching user returns me', () => {
  const out = accountMeRefreshFromProbe(
    { status: 'ok', me: sampleMe },
    epochUserId,
  );
  assert.equal(out.kind, 'ok');
  if (out.kind === 'ok') assert.equal(out.me.email, 'u@example.com');
});

test('ok wrong userId is error', () => {
  const out = accountMeRefreshFromProbe(
    { status: 'ok', me: { ...sampleMe, userId: 'other' } },
    epochUserId,
  );
  assert.equal(out.kind, 'error');
  if (out.kind === 'error') {
    assert.equal(out.message, accountCopy.meProbe.wrongUser);
  }
});

test('unauthorized copy is session expired not network', () => {
  const out = accountMeRefreshFromProbe({ status: 'unauthorized' }, epochUserId);
  assert.equal(out.kind, 'error');
  if (out.kind === 'error') {
    assert.equal(out.message, accountCopy.meProbe.unauthorized);
    assert.match(out.message, /hết hạn/i);
    assert.doesNotMatch(out.message, /Kiểm tra kết nối/i);
  }
});

test('unreachable copy mentions network', () => {
  const out = accountMeRefreshFromProbe({ status: 'unreachable' }, epochUserId);
  assert.equal(out.kind, 'error');
  if (out.kind === 'error') {
    assert.equal(out.message, accountCopy.meProbe.unreachable);
    assert.match(out.message, /mạng/i);
  }
});

test('invalid has distinct copy from unreachable', () => {
  const out = accountMeRefreshFromProbe({ status: 'invalid' }, epochUserId);
  assert.equal(out.kind, 'error');
  if (out.kind === 'error') {
    assert.equal(out.message, accountCopy.meProbe.invalid);
    assert.notEqual(out.message, accountCopy.meProbe.unreachable);
  }
});
