import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { ROOT } from './runtime.mjs';

const app = process.argv[2];
if (!['web', 'portal'].includes(app)) throw new Error('Unknown frontend');
const next = createRequire(resolve(ROOT, `apps/${app}/package.json`))('next');
const origin = new URL(process.env.WEB_PUBLIC_ORIGIN);
// Next builds absolute middleware rewrite URLs from these options. The public
// HTTPS endpoint belongs to the proxy; the app listener stays loopback HTTP.
const server = next({
  dev: false,
  dir: resolve(ROOT, `apps/${app}`),
  hostname: origin.hostname,
  port: Number(origin.port || 443),
});
await server.prepare();
const http = createServer(server.getRequestHandler());
http.listen(Number(process.env.PORT), '127.0.0.1');
const close = async () => {
  http.closeAllConnections();
  http.close();
  await server.close();
};
process.once('SIGTERM', close);
process.once('SIGINT', close);
