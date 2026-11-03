import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ATTENDEE_COPY } from '../src/attendee-copy';
import {
  OwnerTicketQrPanel,
  readBrowserOffline,
} from '../src/owner-ticket/owner-ticket-qr-panel';

test('readBrowserOffline reflects navigator.onLine', () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  assert.equal(readBrowserOffline(), true);
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  assert.equal(readBrowserOffline(), false);
  Object.defineProperty(globalThis, 'navigator', {
    value: original,
    configurable: true,
  });
});

test('OwnerTicketQrPanel renders QR figure without offline banner on SSR', () => {
  const html = renderToStaticMarkup(
    React.createElement(OwnerTicketQrPanel, {
      qrPayload: 'header.payload.signature',
      qrLabel: 'Mã vé',
    }),
  );
  assert.match(html, /data-testid="owner-ticket-qr-figure"/);
  assert.doesNotMatch(html, /owner-ticket-offline-label/);
  assert.doesNotMatch(html, new RegExp(ATTENDEE_COPY.offlineQrBanner));
});
