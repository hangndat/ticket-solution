import { createWorker } from './index';
void createWorker()
  .then((app) => {
    console.info('W0 worker idle: no job processors registered');
    const keepAlive = setInterval(() => {}, 60_000);
    const clear = () => clearInterval(keepAlive);
    process.once('SIGINT', clear);
    process.once('SIGTERM', clear);
    // Nest shutdown hooks close the application context on either signal.
    void app;
  })
  .catch(() => {
    console.error('Worker startup failed; check configuration');
    process.exitCode = 1;
  });
