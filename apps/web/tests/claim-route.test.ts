import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/bff/claim/route';

function claimRequest(body: string): Request {
  return new Request('http://localhost:3417/api/bff/claim', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3417',
      'Content-Type': 'application/json',
    },
    body,
  });
}

test('claim BFF rejects malformed JSON bodies before reading tenant scope', async () => {
  for (const body of ['null', '[]', '{"tenantId":42}']) {
    const response = await POST(claimRequest(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_JSON');
  }
});
