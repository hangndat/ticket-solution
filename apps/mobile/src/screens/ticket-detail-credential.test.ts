import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
// @ts-expect-error react-test-renderer does not provide declarations.
import Renderer, { act } from 'react-test-renderer';
import ts from 'typescript';
import { probeMeTickets as realProbeMeTickets } from '../tickets/fetch-me-tickets.ts';

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
let replacedRoute: string | null = null;
let routeTicketId = 'ticket-a';
let probe = async (): Promise<unknown> => ({ status: 'ok', body: { tickets: [ticket] } });
let credential: { status: 'token'; accessToken: string } | { status: 'unavailable' } = { status: 'token', accessToken: 'synthetic' };
const session = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  getSnapshot: () => identity,
  read: () => memory,
  resolveCredential: async () => credential,
  load: async (_scope: string, _resource: string, loader: () => Promise<unknown>) => { memory = await loader(); },
};
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  __ticketDetailTest: { session, offline, cache: () => cache, probe: () => { calls++; return probe(); }, replace: (route: string) => { replacedRoute = route; }, route: () => routeTicketId },
});
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const stateModule = `import React from ${JSON.stringify(import.meta.resolve('react'))}; export const ErrorState=({title,children,onRetry})=>React.createElement('ErrorState',{title,onRetry},children);`;
const mocks: Record<string, string> = {
  'expo-router': `export const useLocalSearchParams=()=>({ticketId:globalThis.__ticketDetailTest.route()}); export const router={replace:route=>globalThis.__ticketDetailTest.replace(route)};`,
  'react-native': `export const ScrollView='ScrollView',Text='Text',View='View';`,
  '@/identity/session': `export const session=globalThis.__ticketDetailTest.session;`,
  '@/tickets/offline-display-session': `export const offlineDisplay={subscribe:()=>()=>{},getSnapshot:()=>globalThis.__ticketDetailTest.offline};`,
  '@/tickets/display-cache': `export const readTicketDisplayCache=async()=>globalThis.__ticketDetailTest.cache();`,
  '@/tickets/fetch-me-tickets': `export const probeMeTickets=()=>globalThis.__ticketDetailTest.probe();`,
  '@/tickets/wallet-fetch-scope': `export const walletFetchScopeFromEnv=()=>({kind:'owner'});`,
  '@/components/screen-state': stateModule,
  '@/components/screen-state-copy': `export const walletCopy={loading:{},detailProbeErrorTitle:'Fetch error',detailProbeErrorBody:'Fetch failed. Không hiển thị mã vào cổng khi chưa xác minh được vé.',detailMissingTitle:'Missing',detailMissingBody:'Ticket unavailable. Không hiển thị mã vào cổng khi chưa xác minh được vé.',credentialUnavailableBody:'Không hiển thị mã vào cổng khi chưa xác minh được vé.',guestWalletBlockedTitle:'Guest',guestWalletBlockedBody:'Không hiển thị mã vào cổng cho khách chưa đăng nhập.'};`,
  '@/components/page': `export const Notice='Notice';`,
  '@/components/attendee-cta': `export const AttendeeCta='AttendeeCta';`,
  '@/components/attendee-state-card': `export const AttendeeStateCard='AttendeeStateCard';`,
  '@/components/qr-code': `export const QrCode='QrCode';`,
  '@/components/ticket-used-stamp': `export const TicketUsedStamp='Used';`,
  '@/components/ticket-status-pill': `export const TicketStatusPill='Pill';`,
  '@/components/event-banner-metrics': `export const EVENT_BANNER_HEIGHT_TICKET=100;`,
  '@/components/event-media': `export const EventBanner='Banner',EventLogo='Logo';`,
  '@/navigation/attendee-account-route': `export const ATTENDEE_ACCOUNT_HREF='/account',GUEST_HOME_HREF='/(tabs)/(events)';`,
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

test('a legacy sibling does not hide a valid ticket QR through the real wallet probe', async () => {
  memory = [legacy];
  const savedFetch = globalThis.fetch;
  const savedOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  globalThis.fetch = async () => new Response(JSON.stringify({
    tickets: [{ ...legacy, ticketId: 'other-ticket' }, ticket],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  probe = () => realProbeMeTickets('synthetic', { kind: 'owner' });
  let tree: ReturnType<typeof Renderer.create>;
  try {
    await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
    assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
    assert.equal(tree!.root.findAllByType('ErrorState').length, 0);
  } finally {
    await act(async () => { tree!.unmount(); });
    globalThis.fetch = savedFetch;
    if (savedOrigin === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = savedOrigin;
  }
});

test('offline legacy metadata shows a QR error; retry loads the signed credential', async () => {
  memory = [legacy]; calls = 0;
  probe = async () => ({ status: 'unreachable' });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(tree!.root.findAllByType('QrCode').length, 0);
  const state = tree!.root.findByType('AttendeeStateCard');
  assert.equal(state.props.title, 'Chưa thể dùng vé tại cổng');
  assert.match(state.props.children, /không hiển thị mã vào cổng/i);
  assert.equal(tree!.root.findByProps({ testID: 'ticket-detail-credential-unavailable' }).props.testID, 'ticket-detail-credential-unavailable');
  probe = async () => ({ status: 'ok', body: { tickets: [ticket] } });
  await act(async () => { tree!.root.findByProps({ testID: 'ticket-detail-credential-retry' }).props.onPress(); });
  assert.equal(calls, 2);
  assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
  await act(async () => { tree!.unmount(); });
});

test('a valid memory ticket still probes and marks the detail offline when the API is unreachable', async () => {
  memory = [ticket]; cache = { tickets: [ticket], syncedAt: '2026-11-04T00:00:00Z' };
  calls = 0;
  probe = async () => ({ status: 'unreachable' });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(calls, 1);
  assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
  assert.ok(tree!.root.findAllByType('Notice').length > 0);
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

test('verified snapshot without credential cannot display cached QR or manual code', async () => {
  cache = { tickets: [{ ...ticket, manualEntryCode: 'SYNTHETIC-CODE' }], syncedAt: '2026-11-04T00:00:00Z' };
  credential = { status: 'unavailable' };
  calls = 0;
  let tree: ReturnType<typeof Renderer.create>;
  try {
    await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
    assert.equal(calls, 0);
    assert.equal(tree!.root.findAllByType('QrCode').length, 0);
    assert.equal(JSON.stringify(tree!.toJSON()).includes('SYNTHETIC-CODE'), false);
    assert.equal(tree!.root.findAllByType('AttendeeStateCard').length, 1);
  } finally {
    await act(async () => { tree!.unmount(); });
    credential = { status: 'token', accessToken: 'synthetic' };
  }
});

test('bearer with unreachable API uses cached QR and last sync notice', async () => {
  cache = { tickets: [ticket], syncedAt: '2026-11-04T00:00:00Z' };
  const savedFetch = globalThis.fetch;
  const savedOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  globalThis.fetch = async () => new Response(null, { status: 503 });
  probe = () => realProbeMeTickets('synthetic', { kind: 'owner' });
  let tree: ReturnType<typeof Renderer.create>;
  try {
    await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
    assert.equal(tree!.root.findByType('QrCode').props.value, JSON.stringify(ticket.gateCredential));
    assert.ok(JSON.stringify(tree!.toJSON()).includes('Offline'));
    assert.ok(tree!.root.findAllByType('Notice').length > 0);
  } finally {
    await act(async () => { tree!.unmount(); });
    globalThis.fetch = savedFetch;
    if (savedOrigin === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = savedOrigin;
  }
});

test('unauthorized response cannot display cached QR', async () => {
  cache = { tickets: [ticket], syncedAt: '2026-11-04T00:00:00Z' };
  probe = async () => ({ status: 'unauthorized' });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(tree!.root.findAllByType('QrCode').length, 0);
  const state = tree!.root.findByType('AttendeeStateCard');
  assert.match(state.props.children, /không hiển thị mã vào cổng/i);
  assert.equal(tree!.root.findAllByProps({ testID: 'ticket-detail-error-retry' }).length, 0);
  assert.equal(tree!.root.findByProps({ testID: 'ticket-detail-home' }).props.label, 'Về Vé của tôi');
  tree!.root.findByProps({ testID: 'ticket-detail-home' }).props.onPress();
  assert.equal(replacedRoute, '/wallet-access');
  await act(async () => { tree!.unmount(); });
});

test('ticket absent from verified owner list offers wallet return without QR', async () => {
  cache = { tickets: [ticket], syncedAt: '2026-11-04T00:00:00Z' };
  probe = async () => ({ status: 'ok', body: { tickets: [] } });
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
  assert.equal(tree!.root.findAllByType('QrCode').length, 0);
  assert.match(tree!.root.findByType('AttendeeStateCard').props.children, /không hiển thị mã vào cổng/i);
  assert.equal(tree!.root.findByProps({ testID: 'ticket-detail-home' }).props.label, 'Về Vé của tôi');
  tree!.root.findByProps({ testID: 'ticket-detail-home' }).props.onPress();
  assert.equal(replacedRoute, '/wallet-access');
  await act(async () => { tree!.unmount(); });
});

test('invalid ticket route explicitly withholds the Gate code', async () => {
  const previousRoute = routeTicketId;
  routeTicketId = '';
  let tree: ReturnType<typeof Renderer.create>;
  try {
    await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
    assert.equal(tree!.root.findAllByType('QrCode').length, 0);
    const state = tree!.root.findByProps({ testID: 'ticket-detail-invalid-route' });
    assert.match(state.props.children, /không hiển thị mã vào cổng/i);
  } finally {
    await act(async () => { tree!.unmount(); });
    routeTicketId = previousRoute;
  }
});

test('guest ticket route explicitly withholds the Gate code', async () => {
  const previousIdentity = identity;
  identity = { status: 'guest', userId: '' };
  let tree: ReturnType<typeof Renderer.create>;
  try {
    await act(async () => { tree = Renderer.create(React.createElement(TicketDetailScreen)); });
    assert.equal(tree!.root.findAllByType('QrCode').length, 0);
    const state = tree!.root.findByProps({ testID: 'ticket-detail-guest-state' });
    assert.match(state.props.children, /không hiển thị mã vào cổng/i);
  } finally {
    await act(async () => { tree!.unmount(); });
    identity = previousIdentity;
  }
});
