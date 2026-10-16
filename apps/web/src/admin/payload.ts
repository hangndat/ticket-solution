export const DEFAULT_CONFIG_PAYLOAD = '{\n  "title": ""\n}';

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

export function previewConfigJson(
  text: string,
): { ok: true; pretty: string } | { ok: false; code: string; message: string } {
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      code: 'CONFIG_PAYLOAD_REQUIRED',
      message: 'Payload phải là JSON object.',
    };
  }
  return { ok: true, pretty: JSON.stringify(value, null, 2) };
}
