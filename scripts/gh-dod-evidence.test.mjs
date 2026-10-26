import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./gh-dod-evidence.sh", import.meta.url));
const firstSha = "a".repeat(40);
const nextSha = "b".repeat(40);

for (const changed of [false, true]) {
  test(`CI watch ${changed ? "rejects a changed head" : "returns only final evidence"}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "gh-dod-watch-test-"));
    const gh = join(dir, "gh");
    const counter = join(dir, "counter");
    writeFileSync(counter, "0");
    writeFileSync(gh, `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
if (a[0] === 'api' && a[1].includes('/pulls/')) {
  const n = Number(fs.readFileSync(process.env.TEST_COUNTER, 'utf8')) + 1;
  fs.writeFileSync(process.env.TEST_COUNTER, String(n));
  const sha = n > 1 ? process.env.TEST_HEAD_AFTER : process.env.TEST_HEAD_FIRST;
  console.log(sha + '\\topen\\ttrue');
} else if (a[0] === 'pr' && a[1] === 'checks') {
  console.log('progress tick');
} else if (a[0] === 'api' && a[1].includes('/check-runs')) {
  console.log('ci\\tcompleted\\tsuccess');
} else { process.exit(7); }
`, { mode: 0o700 });
    try {
      const result = spawnSync("/bin/bash", [script, "12", "--watch", firstSha], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_COUNTER: counter, TEST_HEAD_FIRST: firstSha, TEST_HEAD_AFTER: changed ? nextSha : firstSha },
      });
      if (changed) {
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /PR head changed during watch/);
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /head.sha=aaaa/);
        assert.match(result.stdout, /ci\tcompleted\tsuccess/);
        assert.doesNotMatch(result.stdout, /progress tick/);
      }
      assert.equal(readFileSync(counter, "utf8"), "2");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
}
