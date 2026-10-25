const {
  createDatabase,
  createNoopEmailAdapter,
  relayOutboxOnce,
} = require('../../dist');

const db = createDatabase(process.env.DATABASE_URL, 2);
relayOutboxOnce(db, createNoopEmailAdapter(), 'worker-crash-process', 10, {
  credentialKeyMaterial: process.env.TEST_CREDENTIAL_KEY,
  publicWebBaseUrl: 'https://tickets.example.test',
  env: { NODE_ENV: 'test' },
  apns: {
    async send() {
      process.stdout.write('APNS_ACCEPTED\n');
      process.exit(91);
    },
  },
}).catch((error) => {
  process.stderr.write(
    (error instanceof Error ? error.message : 'relay failed') + '\n',
  );
  process.exit(92);
});
