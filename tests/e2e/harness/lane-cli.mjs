#!/usr/bin/env node
// Quản lý lane pool: xem trạng thái và hạ stack của lane. Lane được provision
// bởi run đầu tiên dùng nó (`pnpm test:e2e:smoke --lane`).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  ROOT,
  laneConfig,
  laneLockState,
  lanePool,
  laneStatus,
  removeLaneDir,
} from './lane.mjs';

const [action = 'status', target] = process.argv.slice(2);

function docker(args) {
  return execFileSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8e6,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function down(laneId) {
  const lane = laneConfig(laneId);
  const lock = laneLockState(lane);
  if (!lock.free) {
    throw new Error(
      `BLOCKED: ${lane.name} đang được run ${lock.holder?.runId || 'khác'} giữ; không hạ stack đang chạy`,
    );
  }
  if (existsSync(lane.composePath)) {
    docker([
      'compose',
      '--project-name',
      lane.project,
      '-f',
      lane.composePath,
      'down',
      '--volumes',
      '--remove-orphans',
    ]);
  } else {
    // Lane chưa từng chạy hoặc compose file đã mất: dọn theo label của lane.
    const ids = docker([
      'ps',
      '-aq',
      '--filter',
      `label=vemoki.e2e.lane=${lane.name}`,
    ])
      .split('\n')
      .filter(Boolean);
    if (ids.length) docker(['rm', '-f', ...ids]);
  }
  removeLaneDir(lane);
  console.log(`${lane.name}: đã hạ stack và xoá state của lane`);
}

if (action === 'status') {
  const rows = laneStatus(target ? Number(target) : lanePool());
  for (const row of rows) {
    console.log(
      [
        row.name.padEnd(7),
        `tls:${row.tlsPort}`,
        row.provisioned ? 'provisioned' : 'chưa dựng',
        row.busy ? `bận (${row.holder?.runId || 'không rõ'})` : 'rảnh',
        row.stale ? 'lock cũ sẽ được thu hồi' : '',
      ]
        .filter(Boolean)
        .join('  '),
    );
  }
} else if (action === 'down') {
  if (target === 'all' || target === undefined) {
    for (let id = 1; id <= lanePool(); id += 1) down(id);
  } else {
    down(Number(target));
  }
} else {
  console.error(
    'Usage: node tests/e2e/harness/lane-cli.mjs status|down [<lane>|all]',
  );
  process.exit(2);
}
