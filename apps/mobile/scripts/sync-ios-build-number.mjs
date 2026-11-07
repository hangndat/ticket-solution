#!/usr/bin/env node
/**
 * Keep the generated iOS Info.plist CFBundleVersion in sync with app.config.ts.
 * Run before local Release install (Dexter / TF).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'app.config.ts');
const plistCandidates = ['Vemoki', 'VemokiUAT']
  .map((name) => path.join(root, 'ios', name, 'Info.plist'))
  .filter((candidate) => fs.existsSync(candidate));

const config = fs.readFileSync(configPath, 'utf8');
const match = config.match(/buildNumber:\s*'(\d+)'/);
if (!match) {
  console.error('sync-ios-build-number: buildNumber not found in app.config.ts');
  process.exit(1);
}
const buildNumber = match[1];

if (plistCandidates.length !== 1) {
  console.error(
    'sync-ios-build-number: expected one generated Vemoki or VemokiUAT Info.plist — run expo prebuild first',
  );
  process.exit(1);
}
const plistPath = plistCandidates[0];

let plist = fs.readFileSync(plistPath, 'utf8');
const versionRe =
  /(<key>CFBundleVersion<\/key>\s*<string>)(\d+)(<\/string>)/;
if (!versionRe.test(plist)) {
  console.error('sync-ios-build-number: CFBundleVersion entry not found');
  process.exit(1);
}
plist = plist.replace(versionRe, `$1${buildNumber}$3`);
fs.writeFileSync(plistPath, plist);
console.log(`sync-ios-build-number: CFBundleVersion → ${buildNumber}`);
