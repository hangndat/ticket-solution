import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { t } from '../src/i18n/t';
import {
  PORTAL_AA_PRIMARY,
  PORTAL_AA_TEXT_SECONDARY,
  PORTAL_AA_TEXT_TERTIARY,
  PORTAL_ANTD_THEME,
  contrastRatio,
} from '../src/theme/portal-antd-theme';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function readPortal(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('#947 skip-link focus visibility', () => {
  it('does not park the skip-link at left:-9999px', () => {
    const css = readPortal('app/globals.css');
    const skip = css.slice(css.indexOf('.portal-skip-link'));
    assert.doesNotMatch(skip.slice(0, 400), /left:\s*-9999px/);
    assert.match(skip, /clip-path:\s*inset\(50%\)/);
  });

  it('reveals skip-link on :focus, :focus-visible, and --visible class', () => {
    const css = readPortal('app/globals.css');
    assert.match(css, /\.portal-skip-link:focus/);
    assert.match(css, /\.portal-skip-link:focus-visible/);
    assert.match(css, /\.portal-skip-link\.portal-skip-link--visible/);
    assert.match(css, /position:\s*fixed/);
    assert.match(css, /left:\s*8px/);
  });

  it('keeps skip-link first and targeting #portal-main', () => {
    const shell = readPortal('src/components/portal-shell.tsx');
    const skipAt = shell.indexOf('className="portal-skip-link"');
    const hrefAt = shell.indexOf('href="#portal-main"');
    const mainAt = shell.indexOf('id="portal-main"');
    assert.ok(hrefAt > 0 && skipAt > 0 && hrefAt < skipAt);
    assert.ok(skipAt < mainAt);
    assert.match(shell, /portal-skip-link--visible/);
    assert.match(shell, /document\.activeElement === el/);
  });
});

describe('#947 guests EN copy', () => {
  it('guest tabs and section chrome use catalog keys, not VI literals', () => {
    const workspace = readPortal('src/guests/guest-workspace.tsx');
    assert.match(workspace, /t\('guests\.tab\.invitations'\)/);
    assert.match(workspace, /t\('guests\.tab\.redemptions'\)/);
    assert.match(workspace, /t\('guests\.tab\.tickets'\)/);
    assert.doesNotMatch(workspace, /label: 'Lời mời'/);
    assert.doesNotMatch(workspace, /label: 'Vé'/);
    assert.doesNotMatch(workspace, /label: 'Yêu cầu đổi mã'/);
    const page = readPortal(
      'app/t/[tenantId]/e/[eventId]/guests/page.tsx',
    );
    assert.match(page, /t\('guests\.section\.list'\)/);
    assert.match(page, /t\('guests\.section\.ops'\)/);
    assert.doesNotMatch(page, /label: 'Danh sách'/);
  });

  it('EN tab labels differ from VI', () => {
    assert.equal(t('vi', 'guests.tab.invitations'), 'Lời mời');
    assert.equal(t('en', 'guests.tab.invitations'), 'Invitations');
    assert.equal(t('en', 'guests.tab.tickets'), 'Tickets');
    assert.equal(t('en', 'guests.section.list'), 'List');
    assert.notEqual(
      t('vi', 'guests.tab.redemptions'),
      t('en', 'guests.tab.redemptions'),
    );
  });
});

describe('#947 antd AA contrast floor', () => {
  it('primary/link/secondary tokens meet WCAG 2 AA on white', () => {
    const token = PORTAL_ANTD_THEME.token;
    assert.equal(token.colorPrimary, PORTAL_AA_PRIMARY);
    assert.ok(contrastRatio(PORTAL_AA_PRIMARY) >= 4.5);
    assert.ok(contrastRatio(token.colorLink!) >= 4.5);
    assert.ok(contrastRatio(PORTAL_AA_TEXT_SECONDARY) >= 4.5);
    assert.ok(contrastRatio(PORTAL_AA_TEXT_TERTIARY) >= 4.5);
    assert.ok(contrastRatio('#1677ff') < 4.5);
  });

  it('ConfigProvider applies PORTAL_ANTD_THEME', () => {
    const providers = readPortal('src/components/providers.tsx');
    assert.match(providers, /theme=\{PORTAL_ANTD_THEME\}/);
  });
});
