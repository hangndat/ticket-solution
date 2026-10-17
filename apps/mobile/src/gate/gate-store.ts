import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { recoverOps, type GateOp } from '@/gate/gate-scan';

const MAX_OPS = 5;
const FILE = 'gate-ops-v1.json';
let memoryOps = '';

function opsUri(): string | null {
  return documentDirectory
    ? `${documentDirectory}ticket-gate-offline/${FILE}`
    : null;
}

async function ensureRoot(): Promise<void> {
  if (!documentDirectory) return;
  try {
    await makeDirectoryAsync(`${documentDirectory}ticket-gate-offline/`, {
      intermediates: true,
    });
  } catch {
    /* exists */
  }
}

export async function loadGateOps(): Promise<GateOp[]> {
  let raw = memoryOps;
  const uri = opsUri();
  if (uri) {
    try {
      await ensureRoot();
      const fromDisk = await readAsStringAsync(uri);
      if (typeof fromDisk === 'string' && fromDisk.length > 0) {
        raw = fromDisk;
        memoryOps = fromDisk;
      }
    } catch {
      /* missing */
    }
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return recoverOps(parsed as GateOp[]);
  } catch {
    return [];
  }
}

export async function saveGateOps(ops: readonly GateOp[]): Promise<void> {
  const trimmed = ops.slice(0, MAX_OPS);
  const json = JSON.stringify(trimmed);
  memoryOps = json;
  const uri = opsUri();
  if (!uri) return;
  try {
    await ensureRoot();
    await writeAsStringAsync(uri, json, { encoding: 'utf8' });
  } catch {
    /* memory-only */
  }
}
