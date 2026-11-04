/** Read the entire multipart envelope under a hard limit before parsing it. */
export async function boundedMultipart(
  request: Request,
  limit: number,
): Promise<FormData> {
  const length = request.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > limit) {
    throw new MultipartTooLarge();
  }
  if (!request.body) throw new Error('Missing multipart body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new MultipartTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  }).formData();
}

export class MultipartTooLarge extends Error {}
