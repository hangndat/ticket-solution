import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import {
  boundedMultipart,
  MultipartTooLarge,
} from '../src/bff/bounded-multipart.ts';

describe('bounded multipart reader', () => {
  it('parses a valid multipart envelope below the limit', async () => {
    const form = new FormData();
    form.set('kind', 'CODES');
    form.set('file', new File(['code\nA\n'], 'a.csv', { type: 'text/csv' }));
    const request = new Request('http://localhost/', {
      method: 'POST',
      body: form,
    });
    const parsed = await boundedMultipart(request, 4096);
    assert.equal(parsed.get('kind'), 'CODES');
    assert.equal(await (parsed.get('file') as File).text(), 'code\nA\n');
  });

  for (const length of [undefined, '1']) {
    it(`enforces streamed bytes with content-length ${length ?? 'absent'}`, async () => {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(8));
        },
        cancel() {
          cancelled = true;
        },
      });
      const headers = new Headers({
        'content-type': 'multipart/form-data; boundary=test',
      });
      if (length) headers.set('content-length', length);
      const request = new Request('http://localhost/', {
        method: 'POST',
        headers,
        body: stream,
        duplex: 'half',
      } as RequestInit);
      await assert.rejects(boundedMultipart(request, 16), MultipartTooLarge);
      assert.equal(cancelled, true);
    });
  }

  it('propagates a body stream error without parsing partial data', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.error(new Error('disconnected'));
      },
    });
    const request = new Request('http://localhost/', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    await assert.rejects(boundedMultipart(request, 16), /disconnected/);
  });
});

describe('upload route stream failure', () => {
  let calls = 0;
  let post: typeof import('../app/api/bff/tenants/[tenantId]/events/[eventId]/imports/upload/route.ts').POST;
  before(async () => {
    const { bffApiError } = await import('../src/bff/api-error.ts');
    mock.module('../src/bff/csrf.ts', {
      namedExports: { assertMutatingMultipart: async () => null },
    });
    mock.module('../src/bff/upstream.ts', {
      namedExports: {
        bffApiError,
        forwardStaffBearer: async () => {
          calls++;
          return new Response();
        },
      },
    });
    post = (
      await import('../app/api/bff/tenants/[tenantId]/events/[eventId]/imports/upload/route.ts')
    ).POST;
  });
  it('returns 400 without forwarding a failed stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('disconnect'));
      },
    });
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const response = await post(request, {
      params: Promise.resolve({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_MULTIPART');
    assert.equal(calls, 0);
  });
});
