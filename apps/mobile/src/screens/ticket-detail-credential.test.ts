import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
// @ts-expect-error react-test-renderer does not provide declarations.
import Renderer, { act } from 'react-test-renderer';
import ts from 'typescript';

// Only native/UI boundaries are replaced. Render the production screen with
// real React effects, ownership checks, lookup and QR payload serialization.
const screenUrl = new URL('./ticket-detail.tsx', import.meta.url).href;
const ticket = {
  ticketId: 'ticket-a', tenantId: 'tenant-a', eventId: 'event-a',
  ticketTypeId: 'type-a', sourceId: 'source-a', state: 'ACTIVE',
  credentialVersion: 1, createdAt: '2026-11-05T00:00:00Z',
  gateCredential: { v: 1, kind: 'ticket.gate_credential', jws: 'header.payload.signature' },
  manualEntryCode: null,
};
const legacy = { ...ticket, gateCredential: undefined };
let identity = { status: 'verified', userId: 'owner-a' };
const offline = { status: 'unbound' };
const listeners = new Set<() => void>();
let memory: unknown = [legacy];
let cache: unknown = { tickets: [legacy], syncedAt: '2026-11-04T00:00:00Z' };
let calls = 0;
let probe = async (): Promise<unknown> => ({ status: 'ok', body: { tickets: [ticket] } });
const session = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  getSnapshot: () => identity,
  read: () => memory,
  resolveCredential: async () => ({ status: 'token', accessToken: 'synthetic' }),
  load: async (_scope: string, _resource: string, loader: () => Promise<unknown>) => { memory = await loader(); },
};
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  __ticketDetailTest: { session, offline, cache: () => cache, probe: () => { calls++; return probe(); } },
});
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const stateModule = `import React from ${JSON.stringify(import.meta.resolve('react'))}; export const ErrorState=({title,children,onRetry})=>React.createElement('ErrorState',{title,onRetry},children);`;
const mocks: Record<string, string> = {
  'expo-router': `export const useLocalSearchParams=()=>({ticketId:'ticket-a'});`,
  'react-native': `export const ScrollView='ScrollView',Text='Text',View='View';`,
  '@/identity/session': `export const session=globalThis.__ticketDetailTest.session;`,
  '@/tickets/offline-display-session': `export const offlineDisplay={subscribe:()=>()=>{},getSnapshot:()=>globalThis.__ticketDetailTest.offline};`,
  '@/tickets/display-cache': `export const readTicketDisplayCache=async()=>globalThis.__ticketDetailTest.cache();`,
  '@/tickets/fetch-me-tickets': `export const probeMeTickets=()=>globalThis.__ticketDetailTest.probe();`,
  '@/tickets/wallet-fetch-scope': `export const walletFetchScopeFromEnv=()=>({kind:'owner'});`,
  '@/components/screen-state': stateModule,
  '@/components/screen-state-copy': `export const walletCopy={loading:{},detailProbeErrorTitle:'Fetch error',detailMissingTitle:'Missing'};`,
  '@/components/page': `export const Notice='Notice';`,
  '@/components/qr-code': `export const QrCode='QrCode';`,
  '@/components/ticket-used-stamp': `export const TicketUsedStamp='Used';`,
  '@/components/ticket-status-pill': `export const TicketStatusPill='Pill';`,
  '@/components/event-banner-metrics': `export const EVENT_BANNER_HEIGHT_TICKET=100;`,
  '@/components/event-media': `export const EventBanner='Banner',EventLogo='Logo';`,
  '@/data/demo-media': `export const hasDemoMediaForEventId=()=>false;`,
  '@/data/demo-events': `export const findDemoEventById=()=>null;`,
  '@/theme/colors': `export const brand={ink:'#141020',primary:'#6C35FF'},colors={paper:'#fff',secondary:'#555',onAccent:'#fff'};`,
  '@/theme/typography': `export const typography={};`,
  '@/theme/tokens': `export const space={},radius={};`,
  '@/tickets/wallet-sync-display': `export const walletOfflineNoticeBody=()=> 'Offline';`,
  '@/attendee/attendee-outcome-copy': `export const attendeeWalletCopy={}; export const isUsedTicketState=()=>false,ticketGateHint=()=>null,ticketScheduleVenueLines=()=>({}),presentTicketRow=t=>({eventTitle:'Event',ticketId:t.ticketId});`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === screenUrl && mocks[specifier]) return { url: moduleUrl(mocks[specifier]), shortCircuit: true };
    if (context.parentURL === screenUrl && specifier.startsWith('@/tickets/')) {
      return { url: new URL('../tickets/' + specifier.slice('@/tickets/'.length) + '.ts', screenUrl).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === screenUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
// TSX is transpiled by the scoped hook above.
const { TicketDetailScreen } = await import('./ticket-detail.tsx');

test('detail refreshes legacy memory/cache instead of silently hiding QR', async () => {
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(calls, 1);
  assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
  await act(async () => { tree!.unmount(); });
});

test('offline legacy metadata shows a QR error; retry loads the signed credential', async () => {
  memory = [legacy]; calls = 0;
  probe = async () => ({ status: 'unreachable' });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(tree!.root.findAllByType('QrCode').length, 0);
  const error = tree!.root.findByType('ErrorState');
  assert.equal(error.props.title, 'Chưa tải được mã QR của vé');
  probe = async () => ({ status: 'ok', body: { tickets: [ticket] } });
  await act(async () => { error.props.onRetry(); });
  assert.equal(calls, 2);
  assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
  await act(async () => { tree!.unmount(); });
});

test('a delayed owner-A fetch cannot render its QR after switching owner', async () => {
  memory = [legacy];
  let finish!: (value: unknown) => void;
  let requests = 0;
  probe = () => ++requests === 1
    ? new Promise((resolve) => { finish = resolve; })
    : Promise.resolve({ status: 'ok', body: { tickets: [] } });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  await act(async () => {
    identity = { status: 'verified', userId: 'owner-b' };
    for (const notify of listeners) notify();
  });
  await act(async () => { finish({ status: 'ok', body: { tickets: [ticket] } }); });
  assert.equal(tree!.root.findAllByType('QrCode').length, 0);
  await act(async () => { tree!.unmount(); });
});
