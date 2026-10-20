import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

describe('admin section hooks (Issue #639)', () => {
  it('exports API hooks alongside section components', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const hooks = [
      'src/admin/use-event-lifecycle-api.ts',
      'src/admin/use-ticket-source-api.ts',
      'src/admin/use-redemption-approval-api.ts',
      'src/admin/use-cs-api.ts',
      'src/admin/use-export-api.ts',
      'src/admin/use-event-report-api.ts',
    ];
    for (const rel of hooks) {
      const src = readFileSync(join(root, rel), 'utf8');
      assert.match(src, /export function use\w+Api/);
    }
    const sections = [
      'app/admin/event-lifecycle-section.tsx',
      'app/admin/ticket-source-section.tsx',
      'app/admin/redemption-approval-section.tsx',
      'app/admin/cs-section.tsx',
      'app/admin/export-section.tsx',
      'app/admin/event-report-section.tsx',
      'app/admin/admin-readiness-aside.tsx',
    ];
    for (const rel of sections) {
      const src = readFileSync(join(root, rel), 'utf8');
      assert.match(src, /export function \w+/);
    }
    const shell = readFileSync(join(root, 'app/admin/admin-form.tsx'), 'utf8');
    assert.ok(shell.includes('EventLifecycleSection'));
    assert.ok(shell.includes('AdminReadinessAside'));
    assert.ok(!shell.includes('data-testid="event-report-numbers"'));
  });
});
