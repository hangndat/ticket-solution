import assert from 'node:assert/strict';
import test from 'node:test';
import { GUEST_NAV_LINKS, type NavCapabilities, type NavLink } from '../src/nav/capabilities';
import { NavCapabilitiesStore } from '../src/nav/nav-capabilities-store';
import { NavIdentityController } from '../src/nav/nav-identity-controller';
import type { NavSessionAvatar } from '../src/nav/nav-session-avatar';

const attendee = {
  caps: { authenticated: true, showPortalStaff: false, showAccount: true } satisfies NavCapabilities,
  links: [
    ...GUEST_NAV_LINKS,
    { href: '/wallet', label: 'Vé của tôi', testId: 'nav-wallet' },
  ] satisfies NavLink[],
};
const avatarA = { initials: 'AA', displayHint: 'attendee-a@example.test' };
const avatarB = { initials: 'BB', displayHint: 'attendee-b@example.test' };
const flushAsync = () => new Promise<void>((resolve) => setImmediate(resolve));

test('SSR A to authenticated B hides A throughout deferred focus discovery and loads B', async () => {
  let resolveNav!: (value: typeof attendee) => void;
  let resolveAvatar!: (value: NavSessionAvatar | null) => void;
  const nav = new NavCapabilitiesStore(() => new Promise((resolve) => { resolveNav = resolve; }));
  nav.hydrateFromServer({ ...attendee, resolved: true, loading: false });
  const identity = new NavIdentityController(
    nav,
    avatarA,
    () => new Promise((resolve) => { resolveAvatar = resolve; }),
  );
  nav.subscribe(() => { if (!nav.getSnapshot().caps.authenticated) identity.clear(); });
  assert.equal(identity.getAvatar()?.displayHint, avatarA.displayHint);

  const pending = identity.revalidate(); // focus / pageshow.persisted boundary
  assert.equal(identity.getAvatar(), null);
  assert.equal(nav.getSnapshot().caps.authenticated, false);
  assert.ok(!nav.getSnapshot().links.some((link) => link.href === '/wallet'));
  resolveNav(attendee); // new cookie B is authenticated too
  await flushAsync();
  assert.equal(identity.getAvatar(), null, 'old SSR avatar must stay hidden during /me');
  resolveAvatar(avatarB);
  await pending;
  assert.deepEqual(identity.getAvatar(), avatarB);
});

test('late avatar response from the previous identity probe cannot overwrite a newer one', async () => {
  const resolvers: Array<(value: NavSessionAvatar | null) => void> = [];
  const nav = new NavCapabilitiesStore(async () => attendee);
  nav.hydrateFromServer({ ...attendee, resolved: true, loading: false });
  const identity = new NavIdentityController(nav, avatarA, () => new Promise((resolve) => {
    resolvers.push(resolve);
  }));
  nav.subscribe(() => { if (!nav.getSnapshot().caps.authenticated) identity.clear(); });

  const first = identity.revalidate();
  await flushAsync();
  const second = identity.revalidate();
  await flushAsync();
  assert.equal(identity.getAvatar(), null);
  assert.equal(resolvers.length, 2);
  resolvers[1]!(avatarB);
  await second;
  resolvers[0]!(avatarA);
  await first;
  assert.deepEqual(identity.getAvatar(), avatarB);
});

test('revoked identity never starts avatar lookup after discovery settles as guest', async () => {
  let resolveNav!: (value: { caps: NavCapabilities; links: NavLink[] }) => void;
  let avatarLoads = 0;
  const nav = new NavCapabilitiesStore(() => new Promise((resolve) => { resolveNav = resolve; }));
  nav.hydrateFromServer({ ...attendee, resolved: true, loading: false });
  const identity = new NavIdentityController(nav, avatarA, async () => {
    avatarLoads += 1;
    return avatarA;
  });
  nav.subscribe(() => { if (!nav.getSnapshot().caps.authenticated) identity.clear(); });

  const pending = identity.revalidate();
  assert.equal(identity.getAvatar(), null);
  assert.ok(!nav.getSnapshot().links.some((link) => link.href === '/wallet'));
  resolveNav({
    caps: { authenticated: false, showPortalStaff: false, showAccount: false },
    links: GUEST_NAV_LINKS,
  });
  await pending;
  assert.equal(identity.getAvatar(), null);
  assert.equal(avatarLoads, 0);
});
