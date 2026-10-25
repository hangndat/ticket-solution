import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TENANT_PRIMARY_COLOR,
  PORTAL_ALERT_TOKENS,
  VEMOKI_COLORS,
  vemokiTheme,
} from '../src/theme/vemoki';
import { buildVemokiRootCssBlock } from '../src/theme/vemoki-root-vars';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const brandTokens = JSON.parse(
  readFileSync(join(repoRoot, 'brand/vemoki/tokens.json'), 'utf8'),
) as { colors: Record<string, string> };

const PORTAL_ANTD = {
  colorPrimary: '#7C4DED',
  colorError: '#B3213A',
  ink: '#172039',
  paper: '#F6F8FC',
  muted: '#53607B',
  line: '#DFE5F0',
};

test('portal Ant theme uses enterprise violet primary (DEC-02), not signal red', () => {
  assert.equal(vemokiTheme.token?.colorPrimary, PORTAL_ANTD.colorPrimary);
  assert.equal(VEMOKI_COLORS.primary, PORTAL_ANTD.colorPrimary);
  assert.equal(vemokiTheme.components?.Button?.borderRadius, 10);
  assert.equal(vemokiTheme.token?.colorInfo, '#397DFF');
  assert.equal(vemokiTheme.token?.borderRadius, 12);
});

test('tenant brand default matches enterprise violet primary', () => {
  assert.equal(DEFAULT_TENANT_PRIMARY_COLOR, VEMOKI_COLORS.primary);
  assert.equal(DEFAULT_TENANT_PRIMARY_COLOR, '#7C4DED');
  assert.equal(VEMOKI_COLORS.signal, brandTokens.colors.signal);
});

test('portal alert tokens use light paper surfaces (VD10-R-01)', () => {
  assert.equal(vemokiTheme.token?.colorInfoBg, PORTAL_ALERT_TOKENS.colorInfoBg);
  assert.equal(
    vemokiTheme.components?.Alert?.colorInfoBg,
    PORTAL_ALERT_TOKENS.colorInfoBg,
  );
  assert.equal(vemokiTheme.components?.Button?.primaryShadow, 'none');
});

test('portal surface colors align with portal-antd-theme quiet enterprise', () => {
  assert.equal(VEMOKI_COLORS.ink, PORTAL_ANTD.ink);
  assert.equal(VEMOKI_COLORS.paper, PORTAL_ANTD.paper);
  assert.equal(VEMOKI_COLORS.muted, PORTAL_ANTD.muted);
  assert.equal(VEMOKI_COLORS.line, PORTAL_ANTD.line);
  assert.equal(vemokiTheme.token?.colorError, PORTAL_ANTD.colorError);
  assert.equal(vemokiTheme.components?.Layout?.siderBg, VEMOKI_COLORS.siderBg);
});

test('portal root CSS vars are emitted from VEMOKI_COLORS (no duplicate hex in globals.css)', () => {
  const globals = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../app/globals.css'),
    'utf8',
  );
  const rootCss = buildVemokiRootCssBlock();
  for (const [key, value] of Object.entries({
    ink: VEMOKI_COLORS.ink,
    paper: VEMOKI_COLORS.paper,
    signal: VEMOKI_COLORS.signal,
    focus: VEMOKI_COLORS.focus,
    line: VEMOKI_COLORS.line,
    muted: VEMOKI_COLORS.muted,
  })) {
    assert.ok(
      rootCss.toLowerCase().includes(value.toLowerCase()),
      `root CSS must include brand ${key}`,
    );
    assert.equal(
      globals.toLowerCase().includes(value.toLowerCase()),
      false,
      `globals.css must not duplicate brand hex for ${key}`,
    );
  }
  assert.ok(rootCss.includes(`--vemoki-sider: ${VEMOKI_COLORS.siderBg}`));
  assert.ok(
    rootCss.includes(`--vemoki-primary: ${VEMOKI_COLORS.primary}`),
    'root CSS must expose product primary for non-Ant surfaces',
  );
  assert.equal(
    globals.includes('--vemoki-signal'),
    false,
    'globals.css must not use legacy signal red for chrome',
  );
  assert.ok(
    globals.includes('var(--vemoki-primary)'),
    'loading spinner must use product primary token',
  );
});
