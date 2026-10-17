/**
 * Legacy JSON textarea helpers — DEFAULT is now typed C-B EventConfigPayload.
 * Prefer config-editor.ts for section/brand mutations.
 */

import { defaultConfigPayload, parseConfigPayload } from './config-schema';
import { payloadToJson } from './config-editor';

export const DEFAULT_CONFIG_PAYLOAD = payloadToJson(defaultConfigPayload());

export type PayloadEditor = {
  text: string;
  lockedText: string | null;
  publishedSnapshot: string | null;
};

export function initialPayloadEditor(
  text: string = DEFAULT_CONFIG_PAYLOAD,
): PayloadEditor {
  return { text, lockedText: null, publishedSnapshot: null };
}

export function payloadLocked(editor: PayloadEditor): boolean {
  return editor.lockedText !== null;
}

export function editConfigPayload(
  editor: PayloadEditor,
  next: string,
): PayloadEditor {
  if (payloadLocked(editor)) return editor;
  return { ...editor, text: next };
}

export function lockPublishedPayload(editor: PayloadEditor): PayloadEditor {
  return { ...editor, lockedText: editor.text, publishedSnapshot: editor.text };
}

export function startNewConfigDraft(editor: PayloadEditor): PayloadEditor {
  return {
    text: editor.publishedSnapshot ?? editor.text,
    lockedText: null,
    publishedSnapshot: editor.publishedSnapshot,
  };
}

/**
 * Validates typed C-B payload. Pretty JSON alone is NOT acceptance —
 * callers must still use ConfigRenderer for rendered preview.
 */
export function previewConfigJson(
  text: string,
):
  | { ok: true; pretty: string }
  | { ok: false; code: string; message: string } {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      code: 'INVALID_JSON',
      message: 'Payload phải là JSON object.',
    };
  }
  const parsed = parseConfigPayload(value);
  if (!parsed.ok) {
    const first = parsed.issues[0];
    return {
      ok: false,
      code: first?.code ?? 'CONFIG_PAYLOAD_REQUIRED',
      message: first?.message ?? 'Payload không hợp lệ theo schema C-B.',
    };
  }
  return { ok: true, pretty: payloadToJson(parsed.payload) };
}
