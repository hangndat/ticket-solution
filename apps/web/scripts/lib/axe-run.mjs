/**
 * Shared axe-core runner for UAT a11y scripts (animation settle + reduced motion).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_CORE_PATH = require.resolve('axe-core/axe.min.js');

/** WCAG tag set used across pr8xx-*-a11y.mjs scripts. */
export const AXE_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

const DEFAULT_ANIMATION_TIMEOUT_MS = 3000;
const DEFAULT_EXTRA_SETTLE_MS = 1000;

/**
 * Wait for in-flight CSS/Web Animations to finish (with timeout), per #825 F02 diagnosis.
 * @param {import('playwright').Page} page
 * @param {{ timeoutMs?: number; extraSettleMs?: number }} [opts]
 */
export async function waitForAnimationsSettled(page, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_ANIMATION_TIMEOUT_MS;
  const extraSettleMs = opts.extraSettleMs ?? DEFAULT_EXTRA_SETTLE_MS;

  await page.evaluate(async (timeout) => {
    const anims = document.getAnimations();
    if (!anims.length) return;
    const allFinished = Promise.all(
      anims.map((a) => a.finished.catch(() => undefined)),
    );
    const timer = new Promise((resolve) => setTimeout(resolve, timeout));
    await Promise.race([allFinished, timer]);
  }, timeoutMs);

  if (extraSettleMs > 0) {
    await page.waitForTimeout(extraSettleMs);
  }
}

/**
 * @param {import('axe-core').Result[]} violations
 */
export function filterSeriousCritical(violations) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

/** @param {import('axe-core').Result[]} violations */
export function summarizeSeriousCritical(violations) {
  return filterSeriousCritical(violations).map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
  }));
}

/**
 * Run axe on the current document after animation settle.
 * @param {import('playwright').Page} page
 * @param {{
 *   tags?: string[];
 *   animationTimeoutMs?: number;
 *   extraSettleMs?: number;
 *   beforeAxe?: (page: import('playwright').Page) => Promise<void>;
 * }} [opts]
 */
export async function runAxeOnPage(page, opts = {}) {
  const tags = opts.tags ?? AXE_WCAG_TAGS;
  const beforeAxe = opts.beforeAxe;

  if (beforeAxe) {
    await beforeAxe(page);
  }

  await waitForAnimationsSettled(page, {
    timeoutMs: opts.animationTimeoutMs,
    extraSettleMs: opts.extraSettleMs,
  });

  await page.addScriptTag({ path: AXE_CORE_PATH });

  const raw = await page.evaluate(async (tagValues) => {
    // @ts-expect-error axe injected
    return window.axe.run(document, {
      runOnly: { type: 'tag', values: tagValues },
    });
  }, tags);

  const violations = raw.violations ?? [];
  const seriousCritical = summarizeSeriousCritical(violations);

  return {
    violationCount: violations.length,
    seriousCritical,
    violations,
  };
}

/**
 * Playwright context options for default vs prefers-reduced-motion.
 * @param {'default' | 'reduce'} motion
 */
export function motionContextOptions(motion) {
  if (motion === 'reduce') {
    return { reducedMotion: 'reduce' };
  }
  return {};
}
