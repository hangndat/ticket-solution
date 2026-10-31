'use strict';

const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Isolated Redis for JOB R-layer ops restart checks (not worker SoT). */
async function startRedis() {
  const name = `ticket-e2e-redis-${randomBytes(6).toString('hex')}`;
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.e2e.backend=true',
    '-p',
    '127.0.0.1::6379',
    'redis:7-alpine',
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        docker('exec', name, 'redis-cli', 'ping');
        ready = true;
        break;
      } catch {
        /* container starting */
      }
      await sleep(250);
    }
    if (!ready) throw new Error('Isolated Redis did not become ready');
    const port = docker('port', name, '6379/tcp').split(':').at(-1);
    return {
      name,
      url: `redis://127.0.0.1:${port}`,
      async restart() {
        docker('restart', name);
        for (let attempt = 0; attempt < 40; attempt++) {
          try {
            docker('exec', name, 'redis-cli', 'ping');
            return;
          } catch {
            await sleep(250);
          }
        }
        throw new Error('Redis did not become ready after restart');
      },
      stop() {
        docker('rm', '-f', name);
      },
    };
  } catch (error) {
    docker('rm', '-f', name);
    throw error;
  }
}

module.exports = { startRedis };
