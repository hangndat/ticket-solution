import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  acquireLane,
  laneConfig,
  laneSecrets,
  releaseLane,
  removeLaneDir,
} from '../harness/lane.mjs';
import {
  createRuntime,
  destroyRuntime,
  MC_IMAGE,
  ROOT,
} from '../harness/runtime.mjs';

// Explicit opt-in: this test creates and destroys only a previously absent lane16.
test(
  'isolated lane observer permissions and cleanup on success and failure',
  {
    skip: process.env.E2E_VERIFY_LANE_CLEANUP !== '1',
    timeout: 600_000,
  },
  async () => {
    const lane = laneConfig(16);
    function docker(args, options = {}) {
      const result = spawnSync('docker', args, {
        cwd: ROOT,
        encoding: 'utf8',
        ...options,
      });
      if (result.error) throw result.error;
      return result;
    }
    const containers = () =>
      docker([
        'ps',
        '-aq',
        '--filter',
        `label=com.docker.compose.project=${lane.project}`,
      ]);
    const networks = () =>
      docker([
        'network',
        'ls',
        '-q',
        '--filter',
        `label=com.docker.compose.project=${lane.project}`,
      ]);
    assert.equal(
      existsSync(lane.dir),
      false,
      'lane16 must be unused before test',
    );
    assert.equal(
      containers().stdout.trim(),
      '',
      'lane16 containers must not already exist',
    );
    assert.equal(
      networks().stdout.trim(),
      '',
      'lane16 network must not already exist',
    );
    const held = await acquireLane({
      lane: 16,
      runId: `cleanup-test-${process.pid}`,
      timeoutMs: 1000,
    });
    let state;
    try {
      for (const outcome of ['success', 'failure']) {
        state = await createRuntime(['SEC-05'], { lane: held });
        const observer = state.minio.identities.observer;
        const bucket = state.minio.buckets.imports;
        const policy = `e2e-observer-${state.id}`;
        const root = {
          accessKey: 'e2e-access',
          secretKey: laneSecrets(lane).minio,
        };
        const mc = (identity, args, input) =>
          docker(
            [
              'run',
              '--rm',
              '--network',
              `${lane.project}_default`,
              '--env',
              'MC_HOST_e2e',
              '--interactive',
              '--entrypoint',
              'mc',
              MC_IMAGE,
              ...args,
            ],
            {
              env: {
                ...process.env,
                MC_HOST_e2e: `http://${identity.accessKey}:${identity.secretKey}@minio:9000`,
              },
              input,
            },
          );
        assert.equal(
          mc(root, ['admin', 'user', 'info', 'e2e', observer.accessKey]).status,
          0,
          'observer exists before cleanup',
        );
        assert.equal(
          mc(root, ['admin', 'policy', 'info', 'e2e', policy]).status,
          0,
          'policy exists before cleanup',
        );
        assert.equal(
          mc(observer, ['ls', `e2e/${bucket}`]).status,
          0,
          'observer can list fixture imports',
        );
        assert.notEqual(
          mc(observer, ['ls', `e2e/${state.minio.buckets.assets}`]).status,
          0,
          'observer cannot list other bucket',
        );
        assert.notEqual(
          mc(observer, ['cat', `e2e/${bucket}/bootstrap-shared`]).status,
          0,
          'observer cannot read objects',
        );
        assert.notEqual(
          mc(observer, ['pipe', `e2e/${bucket}/observer-write`], 'synthetic')
            .status,
          0,
          'observer cannot write objects',
        );
        try {
          if (outcome === 'failure') throw new Error('synthetic run failure');
        } catch (error) {
          assert.equal(error.message, 'synthetic run failure');
        } finally {
          await destroyRuntime(state);
        }
        assert.equal(
          mc(root, ['admin', 'user', 'list', 'e2e']).status,
          0,
          'admin remains reachable after cleanup',
        );
        assert.equal(
          mc(root, ['admin', 'policy', 'list', 'e2e']).status,
          0,
          'policy service remains reachable',
        );
        assert.notEqual(
          mc(root, ['admin', 'user', 'info', 'e2e', observer.accessKey]).status,
          0,
          'observer user removed',
        );
        assert.notEqual(
          mc(root, ['admin', 'policy', 'info', 'e2e', policy]).status,
          0,
          'observer policy removed',
        );
        assert.notEqual(
          mc(root, ['stat', `e2e/${bucket}`]).status,
          0,
          'run bucket removed',
        );
        assert.equal(
          existsSync(join(state.dir, 'lane-object-cleanup.log')),
          false,
          'object cleanup reported no failures',
        );
        assert.equal(
          existsSync(join(state.dir, 'lane-cleanup.log')),
          false,
          'lane cleanup reported no failures',
        );
        state = undefined;
      }
    } finally {
      if (state) await destroyRuntime(state);
      if (existsSync(lane.composePath)) {
        const down = docker([
          'compose',
          '--project-name',
          lane.project,
          '-f',
          lane.composePath,
          'down',
          '--volumes',
          '--remove-orphans',
        ]);
        assert.equal(down.status, 0, 'owned lane teardown succeeds');
      }
      assert.equal(
        containers().stdout.trim(),
        '',
        'owned lane containers removed',
      );
      assert.equal(networks().stdout.trim(), '', 'owned lane network removed');
      releaseLane(held);
      removeLaneDir(lane);
    }
  },
);
