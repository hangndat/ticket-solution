import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import ts from 'typescript';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const shim = pathToFileURL(resolvePath(root, 'scripts/durable-test-native.mjs')).href;
const native = new Set([
  'expo-secure-store', 'expo', 'react-native', 'expo-auth-session',
  'expo-web-browser', 'expo-constants', 'expo-crypto', 'expo-notifications',
  'expo-linking', 'expo-router', '@expo/ui', 'expo-symbols',
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (native.has(specifier) || specifier.startsWith('@expo/ui/') || specifier.startsWith('expo-router/')) return { url: shim, shortCircuit: true };
    let target = specifier;
    if (specifier.startsWith('@/')) target = pathToFileURL(resolvePath(root, 'src', specifier.slice(2))).href;
    if (target.startsWith('file:') || target.startsWith('.')) {
      const url = new URL(target, context.parentURL);
      const path = fileURLToPath(url);
      if (!existsSync(path)) {
        for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
          if (existsSync(path + ext)) return { url: pathToFileURL(path + ext).href, shortCircuit: true };
        }
      }
      if (existsSync(path)) return { url: url.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const fileName = fileURLToPath(url);
      const source = readFileSync(fileName, 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(source, { fileName, compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        } }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
