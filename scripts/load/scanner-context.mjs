/** Benchmark-only fixtures. Each scanner has a distinct verified OIDC identity. */
export async function createScannerContexts({
  databaseUrl, base, tenantId, eventIds, scannersPerEvent, users,
  tokenByEmail, httpJson, openSessions,
}) {
  const { default: backend } = await import('../../packages/backend/dist/index.js');
  const db = backend.createDatabase(databaseUrl, 4);
  const contexts = {};
  let next = 0;
  try {
    for (const eventId of eventIds) {
      contexts[eventId] = [];
      for (let i = 0; i < scannersPerEvent; i++) {
        const user = users[next++];
        const token = tokenByEmail.get(user?.email);
        if (!token) throw new Error('Scanner fixture is missing its OIDC token');
        const me = await httpJson('GET', `${base}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (me.status !== 200 || !me.json?.userId) {
          throw new Error(`Scanner identity resolution failed: HTTP ${me.status}`);
        }
        const userId = me.json.userId;
        await backend.withTenant(db, tenantId, async (tx) => {
          const membership = await backend.grantMembership(tx, {
            tenantId, userId, role: 'SCANNER', permissions: ['gate.confirm'],
          });
          await backend.grantEventAssignment(tx, {
            tenantId, eventId, membershipId: membership.membershipId,
            permissions: ['gate.confirm'],
          });
        });
        const [sessionId] = await openSessions(base, token, eventId, 1);
        contexts[eventId].push({ userId, sessionId, token });
      }
    }
    scannerContextSummary(contexts, eventIds, scannersPerEvent);
    return contexts;
  } finally {
    await db.$disconnect();
  }
}

/** Fail before load if sessions accidentally share identities or credentials. */
export function scannerContextSummary(contexts, eventIds, scannersPerEvent) {
  const all = eventIds.flatMap(eventId => contexts[eventId] ?? []);
  const expected = eventIds.length * scannersPerEvent;
  const userIds = new Set(all.map(scanner => scanner.userId));
  const sessions = new Set(all.map(scanner => scanner.sessionId));
  const subjects = new Set(all.map(scanner => {
    if (!scanner.userId || !scanner.sessionId || !scanner.token) {
      throw new Error('Incomplete scanner fixture');
    }
    const claims = JSON.parse(Buffer.from(scanner.token.split('.')[1], 'base64url').toString());
    if (!claims.iss || !claims.sub) throw new Error('Scanner token lacks identity claims');
    return JSON.stringify([claims.iss, claims.sub]);
  }));
  if (all.length !== expected || userIds.size !== expected || sessions.size !== expected || subjects.size !== expected ||
      eventIds.some(eventId => contexts[eventId]?.length !== scannersPerEvent)) {
    throw new Error('Scanner context requires one distinct identity and session per scanner');
  }
  return {
    model: 'one-identity-per-scanner', distinctIdentities: subjects.size,
    distinctUsers: userIds.size, distinctSessions: sessions.size,
    events: eventIds.length, scannersPerEvent,
  };
}

/** Keep both events active throughout the measured window, not in two phases. */
export function interleaveEventJobs(jobs) {
  const groups = new Map();
  for (const job of jobs) {
    if (!groups.has(job.eventId)) groups.set(job.eventId, []);
    groups.get(job.eventId).push(job);
  }
  const result = [];
  const length = Math.max(0, ...[...groups.values()].map(group => group.length));
  for (let i = 0; i < length; i++) {
    for (const group of groups.values()) if (group[i]) result.push(group[i]);
  }
  return result;
}
