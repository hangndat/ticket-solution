const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');
const openapiPath = join(
  root,
  'openapi/k-api-01-platform-public-events.path.json',
);

const {
  PLATFORM_PUBLISHED_EVENTS_OPENAPI_PATH,
  PLATFORM_PUBLISHED_EVENTS_OPERATION_ID,
  PUBLISHED_EVENT_ENDPOINTS,
  PLATFORM_PUBLISHED_EVENT_LIST_ORDER,
} = require('../dist/index.js');

test('K-API-01 platform public events contract freeze', () => {
  assert.equal(
    PUBLISHED_EVENT_ENDPOINTS.platformList,
    'GET /public/events',
  );
  assert.equal(
    PLATFORM_PUBLISHED_EVENTS_OPENAPI_PATH,
    '/v1/public/events',
  );
  assert.equal(
    PLATFORM_PUBLISHED_EVENTS_OPERATION_ID,
    'PlatformPublishedEventsController_list',
  );
  assert.match(PLATFORM_PUBLISHED_EVENT_LIST_ORDER, /tenant_id/);

  const fragment = JSON.parse(readFileSync(openapiPath, 'utf8'));
  const op =
    fragment[PLATFORM_PUBLISHED_EVENTS_OPENAPI_PATH]?.get;
  assert.ok(op, 'OpenAPI path fragment must define GET');
  assert.equal(op.operationId, PLATFORM_PUBLISHED_EVENTS_OPERATION_ID);
  assert.equal(
    op.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublishedEventListResponseDto',
  );
  const params = op.parameters ?? [];
  assert.ok(params.some((p) => p.name === 'cursor' && p.in === 'query'));
  assert.ok(params.some((p) => p.name === 'limit' && p.in === 'query'));
});
