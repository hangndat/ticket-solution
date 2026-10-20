import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasWalletAccess,
  showMyTicketsTab,
} from './attendee-wallet-access.ts';

const eligibilityGuest = {
  resolved: true,
  loading: false,
  staffEligible: false,
};

const eligibilityStaff = {
  resolved: true,
  loading: false,
  staffEligible: true,
};

const offlineNone = { status: 'none' as const };
const offlineBound = { status: 'bound' as const };

test('anonymous guest has no wallet access', () => {
  assert.equal(
    hasWalletAccess({ status: 'signed-out' }, offlineNone),
    false,
  );
});

test('offline binding grants wallet access without live session', () => {
  assert.equal(
    hasWalletAccess({ status: 'signed-out' }, offlineBound),
    true,
  );
});

test('my-tickets tab hidden for anonymous attendee guest', () => {
  assert.equal(
    showMyTicketsTab({ status: 'signed-out' }, eligibilityGuest, offlineNone),
    false,
  );
});

test('my-tickets tab visible for offline-bound guest attendee', () => {
  assert.equal(
    showMyTicketsTab({ status: 'signed-out' }, eligibilityGuest, offlineBound),
    true,
  );
});

test('my-tickets tab hidden for staff only', () => {
  assert.equal(
    showMyTicketsTab({ status: 'verified' }, eligibilityStaff, offlineNone),
    false,
  );
});

test('verified attendee tab visible', () => {
  assert.equal(
    showMyTicketsTab({ status: 'verified' }, eligibilityGuest, offlineNone),
    true,
  );
});
