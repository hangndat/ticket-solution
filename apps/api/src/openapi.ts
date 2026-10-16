import { writeFile } from 'node:fs/promises';
import { createApp, createOpenApi } from './app';
async function main() {
  const app = await createApp(false);
  try {
    await app.init();
    await writeFile(
      'openapi.json',
      JSON.stringify(createOpenApi(app), null, 2) + '\n',
    );
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  console.error('OpenAPI generation failed');
  process.exitCode = 1;
});
