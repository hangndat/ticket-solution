/**
 * Typed C-B config editor state — replaces prettyJSON-only draft workflow.
 */

import {
  EVENT_CONTENT_SECTION_KINDS,
  type EventBrandSnapshot,
  type EventConfigPayload,
  type EventContentSection,
  type EventContentSectionKind,
} from '@ticket/contracts';
import {
  defaultBodyForKind,
  defaultConfigPayload,
  parseConfigPayload,
  type AllowlistedSectionBody,
  type ConfigValidationIssue,
  type FaqItem,
} from './config-schema';

export type ConfigEditor = {
  payload: EventConfigPayload;
  locked: boolean;
  /** Live published snapshot — draft edits must never mutate this. */
  publishedSnapshot: EventConfigPayload | null;
};

export function initialConfigEditor(
  payload: EventConfigPayload = defaultConfigPayload(),
): ConfigEditor {
  return { payload, locked: false, publishedSnapshot: null };
}

export function configEditorLocked(editor: ConfigEditor): boolean {
  return editor.locked;
}

export function lockPublishedConfig(editor: ConfigEditor): ConfigEditor {
  return {
    payload: structuredClone(editor.payload),
    locked: true,
    publishedSnapshot: structuredClone(editor.payload),
  };
}

export function startNewConfigDraftFromPublished(
  editor: ConfigEditor,
): ConfigEditor {
  const base = editor.publishedSnapshot ?? editor.payload;
  return {
    payload: structuredClone(base),
    locked: false,
    publishedSnapshot: editor.publishedSnapshot
      ? structuredClone(editor.publishedSnapshot)
      : null,
  };
}

export function validateEditor(
  editor: ConfigEditor,
): { ok: true; payload: EventConfigPayload } | { ok: false; issues: ConfigValidationIssue[] } {
  const parsed = parseConfigPayload(editor.payload);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return { ok: true, payload: parsed.payload };
}

function withPayload(
  editor: ConfigEditor,
  next: EventConfigPayload,
): ConfigEditor {
  if (editor.locked) return editor;
  return { ...editor, payload: next };
}

export function updateBrand(
  editor: ConfigEditor,
  patch: Partial<EventBrandSnapshot>,
): ConfigEditor {
  return withPayload(editor, {
    ...editor.payload,
    brand: { ...editor.payload.brand, ...patch },
  });
}

export function setSectionVisible(
  editor: ConfigEditor,
  kind: EventContentSectionKind,
  visible: boolean,
): ConfigEditor {
  return withPayload(editor, {
    ...editor.payload,
    sections: editor.payload.sections.map((s) =>
      s.kind === kind ? { ...s, visible } : s,
    ),
  });
}

export function setSectionBody(
  editor: ConfigEditor,
  kind: EventContentSectionKind,
  body: AllowlistedSectionBody,
): ConfigEditor {
  return withPayload(editor, {
    ...editor.payload,
    sections: editor.payload.sections.map((s) =>
      s.kind === kind ? { ...s, body: { ...body } } : s,
    ),
  });
}

export function setFaqItems(
  editor: ConfigEditor,
  items: FaqItem[],
): ConfigEditor {
  const section = editor.payload.sections.find((s) => s.kind === 'faq');
  if (!section) return editor;
  const body = { ...(section.body as AllowlistedSectionBody), items };
  return setSectionBody(editor, 'faq', body);
}

/** Move section kind up (-1) or down (+1) in order; reassigns contiguous order. */
export function moveSection(
  editor: ConfigEditor,
  kind: EventContentSectionKind,
  direction: -1 | 1,
): ConfigEditor {
  if (editor.locked) return editor;
  const sorted = [...editor.payload.sections].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((s) => s.kind === kind);
  if (index < 0) return editor;
  const target = index + direction;
  if (target < 0 || target >= sorted.length) return editor;
  const swapped = [...sorted];
  const tmp = swapped[index]!;
  swapped[index] = swapped[target]!;
  swapped[target] = tmp;
  const sections: EventContentSection[] = swapped.map((s, order) => ({
    ...s,
    order,
  }));
  return withPayload(editor, { ...editor.payload, sections });
}

export function ensureAllSectionKinds(editor: ConfigEditor): ConfigEditor {
  const byKind = new Map(editor.payload.sections.map((s) => [s.kind, s]));
  const sections: EventContentSection[] = [];
  EVENT_CONTENT_SECTION_KINDS.forEach((kind, order) => {
    const existing = byKind.get(kind);
    if (existing) {
      sections.push({ ...existing, order });
    } else {
      sections.push({
        kind,
        id: `${kind}-1`,
        visible: false,
        order,
        body: defaultBodyForKind(kind),
      });
    }
  });
  return withPayload(editor, { ...editor.payload, sections });
}

/** Draft must not equal published reference after edit (version isolation). */
export function draftIsolatedFromPublished(editor: ConfigEditor): boolean {
  if (!editor.publishedSnapshot) return true;
  return editor.payload !== editor.publishedSnapshot;
}

export function payloadToJson(payload: EventConfigPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function editorFromJsonText(text: string): {
  ok: true;
  editor: ConfigEditor;
} | {
  ok: false;
  code: string;
  message: string;
  issues?: ConfigValidationIssue[];
} {
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
    return {
      ok: false,
      code: parsed.issues[0]?.code ?? 'CONFIG_PAYLOAD_REQUIRED',
      message: parsed.issues[0]?.message ?? 'Payload không hợp lệ.',
      issues: parsed.issues,
    };
  }
  return { ok: true, editor: initialConfigEditor(parsed.payload) };
}
