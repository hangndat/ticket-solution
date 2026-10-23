import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function providerFileMetadata(filePath) {
  const resolved = path.resolve(filePath);
  const st = fs.statSync(resolved);
  return {
    basename: path.basename(resolved),
    byteSize: st.size,
    mtimeMs: st.mtimeMs,
  };
}

// Hash only the immutable prefix present at the task boundary. Appends are valid.
export function providerPrefixHash(filePath, byteCount = fs.statSync(filePath).size) {
  if (!Number.isSafeInteger(byteCount) || byteCount < 0) throw new Error('baseline_offset_invalid');
  const fd = fs.openSync(filePath, 'r'), hash = createHash('sha256');
  const chunk = Buffer.alloc(65536);
  try {
    let offset = 0;
    while (offset < byteCount) {
      const n = fs.readSync(fd, chunk, 0, Math.min(chunk.length, byteCount - offset), offset);
      if (!n) throw new Error('baseline_file_truncated');
      hash.update(chunk.subarray(0, n)); offset += n;
    }
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}
