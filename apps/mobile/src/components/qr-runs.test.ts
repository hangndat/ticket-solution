import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qrDarkRuns } from './qr-runs.ts';

test('runs reconstruct the exact QR matrix, including gaps and the final module', () => {
  const matrix = [[true, true, false, true], [false, true, true, true], [true, false, false, true]];
  const drawn = matrix.map((row) => row.map(() => false));
  for (const run of qrDarkRuns(matrix)) {
    for (let x = run.x; x < run.x + run.width; x++) drawn[run.y][x] = true;
  }
  assert.deepEqual(drawn, matrix);
  assert.equal(qrDarkRuns(matrix).length, 5);
});
