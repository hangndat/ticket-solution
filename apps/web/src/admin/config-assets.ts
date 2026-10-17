/**
 * Client-side asset upload validation before init/finalize (C-B ASSET_LIMITS).
 * Server still re-validates magic bytes / re-encode — client MIME is not proof.
 */

import {
  ASSET_LIMITS,
  type AssetMime,
  type AssetUploadInitBody,
} from '@ticket/contracts';

export type AssetClientError = {
  code: string;
  message: string;
};

const ALLOWED = new Set<string>(ASSET_LIMITS.allowedMime);

export function isAllowedAssetMime(value: string): value is AssetMime {
  return ALLOWED.has(value);
}

export function validateAssetFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true; body: AssetUploadInitBody } | { ok: false; error: AssetClientError } {
  const filename = file.name?.trim() ?? '';
  if (!filename) {
    return {
      ok: false,
      error: { code: 'ASSET_INVALID', message: 'Thiếu tên tệp.' },
    };
  }
  const lower = filename.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.js') ||
    lower.endsWith('.css') ||
    lower.endsWith('.xml')
  ) {
    return {
      ok: false,
      error: {
        code: 'ASSET_INVALID',
        message: 'Chỉ cho phép PNG/JPEG/WebP — không SVG/HTML/JS.',
      },
    };
  }

  const contentType = file.type?.trim().toLowerCase() ?? '';
  if (!isAllowedAssetMime(contentType)) {
    return {
      ok: false,
      error: {
        code: 'ASSET_INVALID',
        message: `MIME không hợp lệ (${contentType || 'empty'}). Chỉ image/png|jpeg|webp.`,
      },
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: { code: 'ASSET_INVALID', message: 'Kích thước tệp không hợp lệ.' },
    };
  }
  if (file.size > ASSET_LIMITS.maxBytes) {
    return {
      ok: false,
      error: {
        code: 'ASSET_LIMIT',
        message: `Tối đa ${ASSET_LIMITS.maxBytes} bytes (5 MiB).`,
      },
    };
  }

  return {
    ok: true,
    body: {
      filename,
      contentType,
      byteLength: file.size,
    },
  };
}

export function validateImageDimensions(input: {
  widthPx: number;
  heightPx: number;
}): AssetClientError | null {
  const { widthPx, heightPx } = input;
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    widthPx < 1 ||
    heightPx < 1
  ) {
    return { code: 'ASSET_INVALID', message: 'Kích thước ảnh không hợp lệ.' };
  }
  if (widthPx > ASSET_LIMITS.maxWidthPx || heightPx > ASSET_LIMITS.maxHeightPx) {
    return {
      code: 'ASSET_LIMIT',
      message: `Tối đa ${ASSET_LIMITS.maxWidthPx}×${ASSET_LIMITS.maxHeightPx}px.`,
    };
  }
  if (widthPx * heightPx > ASSET_LIMITS.maxPixels) {
    return {
      code: 'ASSET_LIMIT',
      message: `Tối đa ${ASSET_LIMITS.maxPixels} pixels.`,
    };
  }
  return null;
}

export type AssetSlot = 'logo' | 'banner';

export function assetSlotLabel(slot: AssetSlot): string {
  return slot === 'logo' ? 'Logo' : 'Banner';
}
