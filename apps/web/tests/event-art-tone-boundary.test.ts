import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('eventArtTone import boundary (F01 / PR #735)', () => {
  it('event-art-tone.ts is server-safe (no use client)', () => {
    const src = readFileSync(join(webRoot, 'src/ui/event-art-tone.ts'), 'utf8');
    assert.doesNotMatch(src, /['"]use client['"]/);
  });

  it('EventPage imports tone from server-safe module, not event-media client bundle', () => {
    const page = readFileSync(
      join(webRoot, 'app/t/[tenantSlug]/events/[eventSlug]/page.tsx'),
      'utf8',
    );
    assert.match(page, /from ['"].*event-art-tone['"]/);
    assert.doesNotMatch(page, /event-media/);
  });

  it('event-media client module reuses shared tone helper', () => {
    const media = readFileSync(join(webRoot, 'src/ui/event-media.tsx'), 'utf8');
    assert.match(media, /from ['"].\/event-art-tone['"]/);
    assert.doesNotMatch(
      media,
      /export function eventArtTone/,
      'tone must not be defined inside use client module',
    );
  });
});
