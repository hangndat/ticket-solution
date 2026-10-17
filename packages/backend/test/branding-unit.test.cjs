const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseBrandingUpdatePatch,
  BrandingError,
  BRANDING_ERROR_CODES,
} = require('../dist');

function assertInvalidInput(fn, messageIncludes) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof BrandingError);
    assert.equal(e.code, BRANDING_ERROR_CODES.INVALID_INPUT);
    if (messageIncludes) assert.match(e.message, messageIncludes);
    return true;
  });
}

test('parseBrandingUpdatePatch rejects non-string displayName/primaryColor without TypeError', () => {
  for (const bad of [12, true, {}, [], undefined]) {
    if (bad === undefined) continue;
    assertInvalidInput(
      () => parseBrandingUpdatePatch({ displayName: bad }),
      /displayName must be a string/,
    );
    assertInvalidInput(
      () => parseBrandingUpdatePatch({ primaryColor: bad }),
      /primaryColor must be a string/,
    );
  }
});

test('parseBrandingUpdatePatch rejects non-string secondaryColor/logoAssetId (null allowed)', () => {
  for (const bad of [12, true, {}, []]) {
    assertInvalidInput(
      () => parseBrandingUpdatePatch({ secondaryColor: bad }),
      /secondaryColor must be a string or null/,
    );
    assertInvalidInput(
      () => parseBrandingUpdatePatch({ logoAssetId: bad }),
      /logoAssetId must be a string or null/,
    );
  }
  assert.deepEqual(parseBrandingUpdatePatch({ secondaryColor: null }), {
    secondaryColor: null,
  });
  assert.deepEqual(parseBrandingUpdatePatch({ logoAssetId: null }), {
    logoAssetId: null,
  });
  assert.deepEqual(parseBrandingUpdatePatch({ secondaryColor: '  ' }), {
    secondaryColor: null,
  });
  assert.deepEqual(parseBrandingUpdatePatch({ logoAssetId: '' }), {
    logoAssetId: null,
  });
});

test('parseBrandingUpdatePatch accepts valid hex and displayName', () => {
  assert.deepEqual(
    parseBrandingUpdatePatch({
      displayName: '  Vemoki  ',
      primaryColor: '#ABC',
      secondaryColor: '#11223344',
      logoAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }),
    {
      displayName: 'Vemoki',
      primaryColor: '#ABC',
      secondaryColor: '#11223344',
      logoAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
  );
});
