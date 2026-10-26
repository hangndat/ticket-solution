import {
  EVENT_CONTENT_SECTION_KINDS,
  type ConfigPreviewResponse,
  type EventConfigPayload,
} from '@ticket/contracts';

export type ConfigFields = {
  organizationName: string;
  primaryColor: string;
  termsText: string;
};

export function hasConfigVersionConflict(
  loadedVersion: number | null,
  latestVersion: number | null,
): boolean {
  return loadedVersion !== latestVersion;
}

export function configFields(payload: EventConfigPayload): ConfigFields {
  const terms = payload.sections.find((section) => section.kind === 'terms');
  return {
    organizationName: payload.brand.organizationName,
    primaryColor: payload.brand.primaryColor,
    termsText: typeof terms?.body.text === 'string' ? terms.body.text : '',
  };
}

/** Only form fields that changed since load are written into the saved snapshot. */
export function mergeConfigFields(
  base: EventConfigPayload,
  original: ConfigFields,
  edited: ConfigFields,
): EventConfigPayload {
  const organizationName = edited.organizationName.trim();
  const primaryColor = edited.primaryColor.trim();
  const termsText = edited.termsText.trim();
  return {
    ...base,
    brand: {
      ...base.brand,
      ...(edited.organizationName !== original.organizationName
        ? { organizationName }
        : {}),
      ...(edited.primaryColor !== original.primaryColor
        ? { primaryColor }
        : {}),
    },
    sections: base.sections.map((section) =>
      section.kind === 'terms' && edited.termsText !== original.termsText
        ? { ...section, body: { ...section.body, text: termsText } }
        : section,
    ),
  };
}

export function isConfigPreview(
  value: unknown,
  version: number,
): value is ConfigPreviewResponse {
  if (!value || typeof value !== 'object') return false;
  const preview = value as Partial<ConfigPreviewResponse>;
  const payload = preview.payload;
  const kinds = Array.isArray(payload?.sections)
    ? new Set(payload.sections.map((section) => section?.kind))
    : null;
  return (
    preview.version === version &&
    !!payload &&
    typeof payload === 'object' &&
    Number.isInteger(payload.schemaVersion) &&
    !!payload.brand &&
    typeof payload.brand.organizationName === 'string' &&
    typeof payload.brand.primaryColor === 'string' &&
    Array.isArray(payload.sections) &&
    payload.sections.length === EVENT_CONTENT_SECTION_KINDS.length &&
    kinds?.size === EVENT_CONTENT_SECTION_KINDS.length &&
    EVENT_CONTENT_SECTION_KINDS.every((kind) => kinds.has(kind)) &&
    payload.sections.every(
      (section) =>
        !!section &&
        typeof section.id === 'string' &&
        typeof section.kind === 'string' &&
        typeof section.visible === 'boolean' &&
        typeof section.order === 'number' &&
        !!section.body &&
        typeof section.body === 'object',
    )
  );
}
