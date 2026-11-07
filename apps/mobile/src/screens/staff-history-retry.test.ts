import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
// @ts-expect-error react-test-renderer does not provide declarations.
import Renderer, { act } from 'react-test-renderer';
import ts from 'typescript';

const screenUrl = new URL('./staff-history.tsx', import.meta.url).href;
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const scoped = {
  tenantId: 'tenant-a', eventId: 'event-a', name: 'Event A',
};
const row = {
  id: 'operation-a', at: '2026-11-06T10:00:00.000Z', ticketLabel: 'ticket-a',
  operationLabel: 'operation-a', receiptLabel: '—', statusLabel: 'Được vào',
  hint: '', tone: 'admit', source: 'scan',
};
let attempts = 0;
let workspace: Record<string, unknown>;
const fixture = {
  get: () => workspace,
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, __historyRetryTest: fixture });

const mocks: Record<string, string> = {
  'react-native': `export const Platform={OS:'ios'},RefreshControl='RefreshControl',ScrollView='ScrollView',Text='Text',View='View';`,
  '@/components/ui/button': `import React from ${JSON.stringify(import.meta.resolve('react'))}; export const Button=(props)=>React.createElement('Button',props);`,
  '@/gate/staff-gate-empty-state': `export const StaffGateNoEventState=()=>null;`,
  '@/gate/staff-gate-device-history-panel': `import React from ${JSON.stringify(import.meta.resolve('react'))}; export const StaffGateDeviceHistoryPanel=(props)=>React.createElement('HistoryPanel',props);`,
  '@/gate/staff-gate-device-history': `export const DEVICE_HISTORY_PAGE_SIZE=12; export const computeDeviceHistoryPageView=(rows,count,query)=>({rows:rows.slice(0,count).filter(row=>!query||row.ticketLabel.includes(query)),loadedCount:Math.min(rows.length,count),totalAvailable:rows.length,hasMore:count<rows.length});`,
  '@/gate/staff-gate-screen-chrome': `export const StaffGateScreenChrome=()=>null;`,
  '@/gate/staff-gate-workspace-context': `export const useStaffGateWorkspace=()=>globalThis.__historyRetryTest.get();`,
  '@/navigation/staff-tab-titles': `export const STAFF_TAB_TITLES={history:'Lịch sử'};`,
  '@/theme/tokens': `export const brand={paper:'#fff'},space={xl:24,huge:48,lg:16,sm:8};`,
  '@/theme/colors': `export const colors={secondary:'#555',deny:'#b00'};`,
  '@/theme/typography': `export const typography={subhead:{}};`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === screenUrl && mocks[specifier]) {
      return { url: moduleUrl(mocks[specifier]), shortCircuit: true };
    }
    return next(specifier);
  },
  load(url, context, next) {
    if (url === screenUrl) {
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return next(url, context);
  },
});
const { StaffHistoryScreen } = await import('./staff-history.tsx');

test('history error retries in place, remains closed on another failure, then shows scoped rows', async () => {
  attempts = 0;
  workspace = {
    ready: false, workspaceLoadError: true, gateScope: null, deviceHistory: [],
    refreshGateEvents: async () => { throw new Error('wrong recovery path'); },
    retryWorkspaceLoad: () => { attempts += 1; },
  };
  let tree: ReturnType<typeof Renderer.create>;
  await act(async () => { tree = Renderer.create(React.createElement(StaffHistoryScreen)); });
  assert.equal(tree!.root.findAllByType('HistoryPanel').length, 0);
  await act(async () => { tree!.root.findByType('Button').props.onPress(); });
  assert.equal(attempts, 1);
  await act(async () => { tree!.update(React.createElement(StaffHistoryScreen)); });
  assert.equal(tree!.root.findAllByType('HistoryPanel').length, 0);
  await act(async () => { tree!.root.findByType('Button').props.onPress(); });
  assert.equal(attempts, 2);
  workspace = { ...workspace, ready: true, workspaceLoadError: false, gateScope: scoped, deviceHistory: [row] };
  await act(async () => { tree!.update(React.createElement(StaffHistoryScreen)); });
  assert.equal(tree!.root.findAllByType('Button').length, 0);
  assert.equal(tree!.root.findByType('HistoryPanel').props.rows[0].id, 'operation-a');
  await act(async () => { tree!.unmount(); });
});
