#!/usr/bin/env node
/**
 * Sync apps/mobile theme from brand/vemoki/tokens.json (SoT).
 * Writes apps/mobile/src/theme/tokens.generated.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(mobileRoot, '../..');
const tokensJsonPath = path.join(repoRoot, 'brand/vemoki/tokens.json');
const outPath = path.join(mobileRoot, 'src/theme/tokens.generated.ts');

const HEADER = `// Auto-generated — do not edit
// Source: brand/vemoki/tokens.json — regenerate: node apps/mobile/scripts/sync-tokens.mjs
`;

/** @param {string} repoRootDir */
export function loadBrandJson(repoRootDir = repoRoot) {
  const raw = fs.readFileSync(
    path.join(repoRootDir, 'brand/vemoki/tokens.json'),
    'utf8',
  );
  return JSON.parse(raw);
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]) {
  return `#${[r, g, b]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(a, b, weightA) {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const w = weightA;
  const wB = 1 - w;
  return toHex([
    Math.round(ar * w + br * wB),
    Math.round(ag * w + bg * wB),
    Math.round(ab * w + bb * wB),
  ]);
}

function parsePx(value) {
  if (typeof value === 'number') return value;
  const m = String(value).match(/^(\d+(?:\.\d+)?)px$/);
  if (!m) throw new Error(`Expected px value, got ${value}`);
  return Number(m[1]);
}

function firstShadowLayer(css) {
  if (css === 'none') return 'none';
  const m = css.match(
    /0\s+-?\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px(?:\s+\d+(?:\.\d+)?px)?\s+rgba\([^)]+\)/i,
  );
  if (!m) throw new Error(`Unparsed shadow: ${css}`);
  return m[0];
}

/** First box-shadow layer → RN iOS shadow fields (TOKENS.md WP-5). */
function shadowLayerToViewStyle(layer, androidElevation) {
  if (layer === 'none') {
    return {
      shadowOpacity: 0,
      elevation: 0,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 0,
      shadowColor: 'transparent',
    };
  }
  const first = firstShadowLayer(layer);
  const m = first.match(
    /^0\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+\d+(?:\.\d+)?px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})$/i,
  );
  if (!m) {
    throw new Error(`Unparsed shadow layer: ${first}`);
  }
  const offsetY = Number.parseFloat(m[1]);
  const blur = Number.parseFloat(m[2]);
  const color = m[3];
  let shadowOpacity = 1;
  let shadowColor = color;
  const rgba = color.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgba) {
    shadowOpacity = Number.parseFloat(rgba[4]);
    shadowColor = `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
  }
  return {
    shadowColor,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity,
    shadowRadius: blur,
    elevation: androidElevation,
  };
}

function formatViewStyle(style, indent) {
  const pad = indent;
  const inner = `${pad}  shadowColor: '${style.shadowColor}',\n${pad}  shadowOffset: { width: ${style.shadowOffset.width}, height: ${style.shadowOffset.height} },\n${pad}  shadowOpacity: ${style.shadowOpacity},\n${pad}  shadowRadius: ${style.shadowRadius},\n${pad}  elevation: ${style.elevation},`;
  return inner;
}

/**
 * @param {ReturnType<typeof loadBrandJson>} json
 * @returns {string}
 */
export function buildTokensModule(json) {
  const { ink, paper, signal, focus, line, muted, destructive, admit, unknown } =
    json.colors;
  const paperDeep = mixHex(paper, ink, 0.88);
  const inkMuted = muted;
  const inkFaint = `rgba(${parseHex(ink).join(', ')}, 0.18)`;

  const space = {
    xxs: json.space.xxs,
    xs: json.space.xs,
    sm: json.space.sm,
    md: json.space.md,
    lg: json.space.lg,
    xl: json.space.xl,
    xxl: json.space['2xl'],
    xxxl: json.space['3xl'],
    huge: json.space['4xl'],
  };

  const radius = {
    sm: parsePx(json.radius.sm),
    md: parsePx(json.radius.md),
    lg: parsePx(json.radius.lg),
    xl: parsePx(json.radius.xl),
    pill: 999,
  };

  const shadowInk = ink;
  const noneStyle = shadowLayerToViewStyle(json.shadow.none, 0);
  const cardStyle = {
    ...shadowLayerToViewStyle(json.shadow.soft, 2),
    shadowColor: shadowInk,
  };
  const sheetStyle = {
    ...shadowLayerToViewStyle(json.shadow.frame, 4),
    shadowColor: shadowInk,
  };

  const brandBlock = `export const brandGenerated = {
  ink: '${ink}',
  paper: '${paper}',
  signal: '${signal}',
  focus: '${focus}',
  line: '${line}',
  muted: '${muted}',
  destructive: '${destructive}',
  admit: '${admit}',
  unknown: '${unknown}',
  paperDeep: '${paperDeep}',
  inkMuted: '${inkMuted}',
  inkFaint: '${inkFaint}',
  wordmark: '${json.wordmark}',
  signalMark: '${json.signal}',
} as const;`;

  const spaceBlock = `export const spaceGenerated = ${JSON.stringify(space, null, 2)} as const;`;

  const radiusBlock = `export const radiusGenerated = ${JSON.stringify(radius, null, 2)} as const;`;

  return `${HEADER}
import type { ViewStyle } from 'react-native';

${brandBlock}

${spaceBlock}

${radiusBlock}

/** iOS shadow + Android elevation — shadow.soft → card, shadow.frame → sheet (TOKENS.md). */
export const elevationGenerated: Record<'none' | 'card' | 'sheet', ViewStyle> = {
  none: {
${formatViewStyle(noneStyle, '  ')}
  },
  card: {
${formatViewStyle(cardStyle, '  ')}
  },
  sheet: {
${formatViewStyle(sheetStyle, '  ')}
  },
};
`;
}

/** @param {string} source */
export function writeTokensFile(source, out = outPath) {
  fs.writeFileSync(out, source, 'utf8');
}

function main() {
  const json = loadBrandJson();
  const source = buildTokensModule(json);
  writeTokensFile(source);
  console.log(`sync-tokens: wrote ${path.relative(repoRoot, outPath)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
