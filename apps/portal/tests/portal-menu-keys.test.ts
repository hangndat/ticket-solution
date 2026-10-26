import assert from 'node:assert/strict';
import test from 'node:test';
import type { PortalMenuGroup } from '../src/nav/portal-menu-keys';
import {
  pathnameMatchesMenuPath,
  resolvePortalMenuKeys,
} from '../src/nav/portal-menu-keys';

const sampleMenu: PortalMenuGroup[] = [
  {
    key: 'nav-org',
    name: 'Org',
    children: [
      { key: '/t/t1', path: '/t/t1', name: 'Overview' },
      { key: '/t/t1/events', path: '/t/t1/events', name: 'Events' },
    ],
  },
  {
    key: 'nav-event-run',
    name: 'Run',
    children: [
      { key: '/t/t1/e/e1', path: '/t/t1/e/e1', name: 'Event home' },
      { key: '/t/t1/e/e1/gate', path: '/t/t1/e/e1/gate', name: 'Gate' },
    ],
  },
  {
    key: 'nav-event-setup',
    name: 'Setup',
    children: [
      { key: '/t/t1/e/e1/guests', path: '/t/t1/e/e1/guests', name: 'Guests' },
    ],
  },
];

test('pathnameMatchesMenuPath org vs event routes', () => {
  assert.equal(pathnameMatchesMenuPath('/t/t1', '/t/t1'), true);
  assert.equal(pathnameMatchesMenuPath('/t/t1/events', '/t/t1'), true);
  assert.equal(pathnameMatchesMenuPath('/t/t1/e/e1', '/t/t1'), false);
  assert.equal(
    pathnameMatchesMenuPath('/t/t1/e/e1/guests/pending', '/t/t1/e/e1/guests'),
    true,
  );
});

test('resolvePortalMenuKeys selects leaf and parent open key', () => {
  assert.deepEqual(resolvePortalMenuKeys('/t/t1/e/e1/guests', sampleMenu), {
    selectedKeys: ['/t/t1/e/e1/guests'],
    openKeys: ['nav-event-setup'],
  });
  assert.deepEqual(resolvePortalMenuKeys('/t/t1/e/e1/gate', sampleMenu), {
    selectedKeys: ['/t/t1/e/e1/gate'],
    openKeys: ['nav-event-run'],
  });
});
