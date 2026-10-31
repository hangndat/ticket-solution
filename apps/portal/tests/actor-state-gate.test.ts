import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actorCommitAllowed,
  actorGeneration,
  beginActorLogout,
  checkActorMarkers,
  resetActorGateForTests,
} from '../src/client/actor-gate';

test('private panel commit is denied after staff, platform, and same-sub epoch changes', () => {
  const previous = (globalThis as { document?: Document }).document;
  const document = { cookie: 'portal_staff_epoch=staff-a; portal_platform_epoch=platform-a' };
  (globalThis as { document?: Document }).document = document as Document;
  resetActorGateForTests();
  try {
    checkActorMarkers();
    const mounted = actorGeneration();
    assert.equal(actorCommitAllowed(mounted), true);

    document.cookie = 'portal_staff_epoch=staff-b; portal_platform_epoch=platform-a';
    assert.equal(actorCommitAllowed(mounted), false, 'same subject with a new epoch still invalidates');

    const remounted = actorGeneration();
    document.cookie = 'portal_staff_epoch=staff-b; portal_platform_epoch=platform-b';
    assert.equal(actorCommitAllowed(remounted), false, 'platform change invalidates staff panel state too');

    const afterPlatform = actorGeneration();
    beginActorLogout();
    assert.equal(actorCommitAllowed(afterPlatform), false);
  } finally {
    resetActorGateForTests();
    if (previous === undefined) delete (globalThis as { document?: Document }).document;
    else (globalThis as { document?: Document }).document = previous;
  }
});
