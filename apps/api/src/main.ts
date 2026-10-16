import { createApp, readApiEnvironment } from './app';
async function main() {
  const env = readApiEnvironment(process.env);
  const app = await createApp({ logging: true, fromEnv: true });
  try {
    await app.listen(env.port, env.host);
  } catch (error) {
    await app.close();
    throw error;
  }
}
void main().catch(() => {
  console.error('API startup failed; check configuration and bind address');
  process.exitCode = 1;
});
