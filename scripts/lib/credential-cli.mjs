#!/usr/bin/env node
/** CLI: seal|open for restore drills. Usage: seal <plain> <key> | open <enc> <key> */
import { openCredentialToken, sealCredentialToken } from './credential-crypto.mjs';

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'seal' && a != null && b != null) {
  process.stdout.write(JSON.stringify(sealCredentialToken(a, b)));
  process.exit(0);
}
if (cmd === 'open' && a != null && b != null) {
  process.stdout.write(openCredentialToken(a, b));
  process.exit(0);
}
console.error('usage: credential-cli.mjs seal <plain> <key> | open <enc> <key>');
process.exit(1);
