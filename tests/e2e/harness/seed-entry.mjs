import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedRuntime } from './seed.mjs';
import { privateJson } from './runtime.mjs';

const state = JSON.parse(readFileSync(process.argv[2], 'utf8'));
await seedRuntime(state, state.caseIds);
privateJson(resolve(state.dir, 'seed-result.json'), {
  databaseUrl: state.databaseUrl,
  manifestPath: state.manifestPath,
});
