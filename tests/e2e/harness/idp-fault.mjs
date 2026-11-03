import { readFileSync, writeFileSync } from 'node:fs';

// Restore only this fault, preserving any other control changes during the test.
export async function withIdpDeleteFault(path, value, action, options = {}) {
  const read = options.read ?? readFileSync;
  const write = options.write ?? writeFileSync;
  const original = JSON.parse(read(path, 'utf8'));
  const hadFault = Object.hasOwn(original, 'idpDelete');
  let failed = false;
  try {
    write(path, JSON.stringify({ ...original, idpDelete: value }), {
      mode: 0o600,
    });
    return await action();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      const current = JSON.parse(read(path, 'utf8'));
      if (hadFault) current.idpDelete = original.idpDelete;
      else delete current.idpDelete;
      write(path, JSON.stringify(current), { mode: 0o600 });
    } catch (error) {
      if (!failed) throw error;
      try {
        options.onCleanupError?.();
      } catch {
        /* Keep the original failure. */
      }
    }
  }
}
