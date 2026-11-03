'use strict';

// Ephemeral local/CI signing material. Never print the private key or storage key.
const { createGateTestConfig } = require('../apps/api/test/gate-test-config.cjs');

const material = process.env.TICKET_CREDENTIAL_KEY;
if (!material || material.length < 16) {
  throw new Error('Local Gate smoke requires a credential storage key');
}
const { env } = createGateTestConfig(material, 'local-smoke-gate');
for (const [name, value] of Object.entries(env)) {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error('Gate smoke environment values must fit on one line');
  }
  process.stdout.write(`${name}=${value}\n`);
}
