'use strict';

const {
  createDatabase,
  relayOutboxOnce,
  createSmtpEmailAdapter,
  readEmailEnvironment,
} = require('../../dist');

const db = createDatabase(process.env.DATABASE_URL, 2);
const base = createSmtpEmailAdapter(readEmailEnvironment(process.env));
const email = {
  async sendMembershipInvite() {
    throw new Error('not used');
  },
  async sendGuestInvitation() {
    throw new Error('not used');
  },
  async sendTicketIssued(payload) {
    const result = await base.sendTicketIssued(payload);
    process.stdout.write('SMTP_ACCEPTED\n');
    process.exit(91);
    return result;
  },
};

relayOutboxOnce(db, email, 'worker-crash-smtp-process', 10, {
  credentialKeyMaterial: process.env.TEST_CREDENTIAL_KEY,
  publicWebBaseUrl:
    process.env.PUBLIC_WEB_BASE_URL || 'https://tickets.example.test',
  env: process.env,
}).catch((error) => {
  process.stderr.write(
    (error instanceof Error ? error.message : 'relay failed') + '\n',
  );
  process.exit(92);
});
