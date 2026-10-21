import { readFile, writeFile } from 'node:fs/promises';
import { createApp, createOpenApi } from './app';
async function main() {
  const existing = JSON.parse(
    await readFile('openapi.json', 'utf8'),
  ) as { paths: Record<string, unknown> };
  const pathOrder = Object.keys(existing.paths);
  const app = await createApp(false);
  try {
    await app.init();
    await writeFile(
      'openapi.json',
      JSON.stringify(createOpenApi(app, { pathOrder }), null, 2) + '\n',
    );
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  console.error('OpenAPI generation failed');
  process.exitCode = 1;
});
