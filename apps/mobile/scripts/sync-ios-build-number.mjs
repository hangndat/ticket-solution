#!/usr/bin/env node
/**
 * Keep gitignored ios/Vemoki/Info.plist CFBundleVersion in sync with app.config.ts.
 * Run before local Release install (Dexter / TF).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'app.config.ts');
const plistPath = path.join(root, 'ios/Vemoki/Info.plist');

const config = fs.readFileSync(configPath, 'utf8');
const match = config.match(/buildNumber:\s*'(\d+)'/);
if (!match) {
  console.error('sync-ios-build-number: buildNumber not found in app.config.ts');
  process.exit(1);
}
const buildNumber = match[1];

if (!fs.existsSync(plistPath)) {
  console.error(
    'sync-ios-build-number: missing ios/Vemoki/Info.plist — run expo prebuild first',
  );
  process.exit(1);
}

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
