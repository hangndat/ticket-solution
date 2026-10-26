import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySetupReload,
  hasUnsavedSetupChanges,
  metadataOutcomeUnknown,
  metadataSaveRequest,
} from '../src/setup/setup-drafts';
import {
  confirmDiscardIfDirty,
  registerDirtyForm,
} from '../src/nav/unsaved-changes';

test('metadata unknown outcome retries the same body and key; known outcome starts a new request', () => {
  let keys = 0;
  const nextKey = () => `00000000-0000-4000-8000-${String(++keys).padStart(12, '0')}`;
  const first = metadataSaveRequest(null, 2, ' First ', nextKey);
  assert.deepEqual(first, {
    expectedRevision: 2,
    name: 'First',
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
  });
  assert.equal(
    metadataOutcomeUnknown({ status: 0, json: null, networkError: true, timedOut: false }),
    true,
  );
  assert.equal(metadataSaveRequest(first, 3, 'Changed', nextKey), first);
  assert.equal(keys, 1);
  assert.equal(
    metadataOutcomeUnknown({ status: 409, json: { retryable: true }, networkError: false, timedOut: false }),
    true,
  );
  assert.equal(
    metadataOutcomeUnknown({ status: 409, json: { retryable: false }, networkError: false, timedOut: false }),
    false,
  );
  const next = metadataSaveRequest(null, 3, 'Changed', nextKey);
  assert.notEqual(next.idempotencyKey, first.idempotencyKey);
  assert.equal(next.expectedRevision, 3);
  assert.equal(next.name, 'Changed');
});

test('edit Clone → save Metadata → Clone draft and guard remain', () => {
  const previousWindow = globalThis.window;
  let prompts = 0;
  globalThis.window = {
    confirm: () => {
      prompts += 1;
      return false;
    },
  } as Window & typeof globalThis;
  const meta = { name: 'Edited metadata' };
  const clone = { name: 'My draft', slug: 'my-draft' };
  const metaForm = {
    setFieldsValue: (values: typeof meta) => Object.assign(meta, values),
  };
  const cloneForm = {
    setFieldsValue: (values: typeof clone) => Object.assign(clone, values),
  };
  let metaDirty = true;
  const cloneDirty = true;
  try {
    metaDirty = false; // Metadata save succeeded; Clone has not been submitted.
    applySetupReload(
      { name: 'Saved metadata', slug: 'event' },
      metaForm,
      cloneForm,
      { meta: metaDirty, clone: cloneDirty },
      'Saved metadata copy',
    );
    assert.equal(meta.name, 'Saved metadata');
    assert.deepEqual(clone, { name: 'My draft', slug: 'my-draft' });
    assert.equal(hasUnsavedSetupChanges(metaDirty, cloneDirty), true);
    const unregister = registerDirtyForm('Unsaved changes');
    try {
      assert.equal(confirmDiscardIfDirty(), false);
      assert.equal(prompts, 1);
    } finally {
      unregister();
    }
  } finally {
    globalThis.window = previousWindow;
  }
});

test('reload fills clean forms and preserves edits made during an in-flight request', () => {
  const meta = { name: '' };
  const clone = { name: '', slug: '' };
  const metaForm = {
    setFieldsValue: (values: typeof meta) => Object.assign(meta, values),
  };
  const cloneForm = {
    setFieldsValue: (values: typeof clone) => Object.assign(clone, values),
  };
  applySetupReload(
    { name: 'Original', slug: 'event' },
    metaForm,
    cloneForm,
    { meta: false, clone: false },
    'Original copy',
  );
  assert.deepEqual(meta, { name: 'Original' });
  assert.deepEqual(clone, { name: 'Original copy', slug: 'event-copy' });

  meta.name = 'Late metadata edit';
  clone.name = 'Late clone edit';
  applySetupReload(
    { name: 'Updated', slug: 'updated' },
    metaForm,
    cloneForm,
    { meta: true, clone: true },
    'Updated copy',
  );
  assert.deepEqual(meta, { name: 'Late metadata edit' });
  assert.deepEqual(clone, { name: 'Late clone edit', slug: 'event-copy' });
});
