/**
 * Server-side C-B typed config validation (single public schema — no HTML/CSS/JS).
 * Mirrors apps/web admin allowlist; API is the decision authority.
 */
import {
  ASSET_LIMITS,
  EVENT_CONTENT_SECTION_KINDS,
  type EventBrandSnapshot,
  type EventConfigPayload,
  type EventContentSection,
  type EventContentSectionKind,
} from '@ticket/contracts';
import { ConfigError, CONFIG_ERROR_CODES } from './config-error';

export const CONFIG_SCHEMA_VERSION = 1;
export const SUPPORTED_CONFIG_SCHEMA_VERSIONS = [CONFIG_SCHEMA_VERSION] as const;

export const CONFIG_TEXT_LIMITS = {
  organizationName: 200,
  primaryColor: 32,
  sectionId: 64,
  title: 200,
  text: 4000,
  termsVersion: 64,
  faqItems: 20,
  faqQuestion: 300,
  faqAnswer: 2000,
} as const;

const SECTION_KIND_SET = new Set<string>(EVENT_CONTENT_SECTION_KINDS);
const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export type ConfigValidationIssue = {
  fieldId: string;
  code: string;
  message: string;
};

export type FaqItem = { question: string; answer: string };

export type AllowlistedSectionBody = {
  title?: string;
  text?: string;
  termsVersion?: string;
  items?: FaqItem[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  return value;
}

export function isSectionKind(value: unknown): value is EventContentSectionKind {
  return typeof value === 'string' && SECTION_KIND_SET.has(value);
}

export function assertSafePlainText(
  fieldId: string,
  value: string,
  maxLen: number,
): ConfigValidationIssue | null {
  if (value.length > maxLen) {
    return {
      fieldId,
      code: 'CONFIG_TEXT_TOO_LONG',
      message: `${fieldId} exceeds ${maxLen} characters`,
    };
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // C0 controls except TAB (\t) and LF (\n); CR (\r) also rejected.
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f)
    ) {
      return {
        fieldId,
        code: 'CONFIG_TEXT_INVALID',
        message: `${fieldId} contains control characters`,
      };
    }
  }
  const lower = value.toLowerCase();
  if (
    lower.includes('<script') ||
    lower.includes('</script') ||
    lower.includes('javascript:') ||
    lower.includes('data:text/html') ||
    /on[a-z]+\s*=/.test(lower) ||
    lower.includes('<style') ||
    lower.includes('expression(')
  ) {
    return {
      fieldId,
      code: 'CONFIG_UNSAFE_MARKUP',
      message: `${fieldId} must not contain HTML/JS/CSS`,
    };
  }
  return null;
}

function defaultBodyForKind(kind: EventContentSectionKind): AllowlistedSectionBody {
  if (kind === 'faq') return { title: 'FAQ', items: [] };
  if (kind === 'terms') return { title: 'Terms', termsVersion: '', text: '' };
  if (kind === 'hero') return { title: '', text: '' };
  if (kind === 'redeem') return { title: 'Redeem', text: '' };
  if (kind === 'guide') return { title: 'Guide', text: '' };
  return { title: 'Info', text: '' };
}

export function parseAllowlistedBody(
  kind: EventContentSectionKind,
  raw: unknown,
  fieldPrefix: string,
): { body: AllowlistedSectionBody; issues: ConfigValidationIssue[] } {
  const issues: ConfigValidationIssue[] = [];
  if (!isPlainObject(raw)) {
    issues.push({
      fieldId: fieldPrefix,
      code: 'CONFIG_BODY_REQUIRED',
      message: 'Section body must be an object',
    });
    return { body: defaultBodyForKind(kind), issues };
  }
  const unknownKeys = Object.keys(raw).filter(
    (k) => !['title', 'text', 'termsVersion', 'items'].includes(k),
  );
  if (unknownKeys.length > 0) {
    issues.push({
      fieldId: `${fieldPrefix}.unknown`,
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: `Disallowed keys: ${unknownKeys.join(', ')}`,
    });
  }

  const body: AllowlistedSectionBody = {};
  const title = asTrimmedString(raw.title);
  if (title !== undefined) {
    const issue = assertSafePlainText(
      `${fieldPrefix}.title`,
      title,
      CONFIG_TEXT_LIMITS.title,
    );
    if (issue) issues.push(issue);
    else body.title = title;
  }
  const text = asTrimmedString(raw.text);
  if (text !== undefined) {
    const issue = assertSafePlainText(
      `${fieldPrefix}.text`,
      text,
      CONFIG_TEXT_LIMITS.text,
    );
    if (issue) issues.push(issue);
    else body.text = text;
  }

  if (kind === 'terms') {
    const termsVersion = asTrimmedString(raw.termsVersion);
    if (termsVersion !== undefined) {
      const issue = assertSafePlainText(
        `${fieldPrefix}.termsVersion`,
        termsVersion,
        CONFIG_TEXT_LIMITS.termsVersion,
      );
      if (issue) issues.push(issue);
      else body.termsVersion = termsVersion;
    }
  } else if (raw.termsVersion !== undefined) {
    issues.push({
      fieldId: `${fieldPrefix}.termsVersion`,
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: 'termsVersion is only allowed on terms sections',
    });
  }

  if (kind === 'faq') {
    if (raw.items === undefined) {
      body.items = [];
    } else if (!Array.isArray(raw.items)) {
      issues.push({
        fieldId: `${fieldPrefix}.items`,
        code: 'CONFIG_FAQ_ITEMS_INVALID',
        message: 'FAQ items must be an array',
      });
    } else if (raw.items.length > CONFIG_TEXT_LIMITS.faqItems) {
      issues.push({
        fieldId: `${fieldPrefix}.items`,
        code: 'CONFIG_FAQ_TOO_MANY',
        message: `At most ${CONFIG_TEXT_LIMITS.faqItems} FAQ items`,
      });
    } else {
      const items: FaqItem[] = [];
      raw.items.forEach((item, index) => {
        if (!isPlainObject(item)) {
          issues.push({
            fieldId: `${fieldPrefix}.items[${index}]`,
            code: 'CONFIG_FAQ_ITEM_INVALID',
            message: 'Each FAQ item must be {question,answer}',
          });
          return;
        }
        const q = asTrimmedString(item.question) ?? '';
        const a = asTrimmedString(item.answer) ?? '';
        const qIssue = assertSafePlainText(
          `${fieldPrefix}.items[${index}].question`,
          q,
          CONFIG_TEXT_LIMITS.faqQuestion,
        );
        const aIssue = assertSafePlainText(
          `${fieldPrefix}.items[${index}].answer`,
          a,
          CONFIG_TEXT_LIMITS.faqAnswer,
        );
        if (qIssue) issues.push(qIssue);
        if (aIssue) issues.push(aIssue);
        if (!qIssue && !aIssue) items.push({ question: q, answer: a });
      });
      body.items = items;
    }
  } else if (raw.items !== undefined) {
    issues.push({
      fieldId: `${fieldPrefix}.items`,
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: 'items is only allowed on faq sections',
    });
  }

  return { body, issues };
}

export function parseBrand(raw: unknown): {
  brand: EventBrandSnapshot;
  issues: ConfigValidationIssue[];
} {
  const issues: ConfigValidationIssue[] = [];
  if (!isPlainObject(raw)) {
    return {
      brand: { primaryColor: '#0B3D2E', organizationName: '' },
      issues: [
        {
          fieldId: 'brand',
          code: 'CONFIG_BRAND_REQUIRED',
          message: 'brand must be an object',
        },
      ],
    };
  }

  const primaryColor = asTrimmedString(raw.primaryColor) ?? '';
  if (!HEX_COLOR.test(primaryColor)) {
    issues.push({
      fieldId: 'brand.primaryColor',
      code: 'CONFIG_BRAND_COLOR',
      message: 'primaryColor must be #RGB/#RRGGBB hex',
    });
  }

  const organizationName = asTrimmedString(raw.organizationName) ?? '';
  const orgIssue = assertSafePlainText(
    'brand.organizationName',
    organizationName,
    CONFIG_TEXT_LIMITS.organizationName,
  );
  if (orgIssue) issues.push(orgIssue);

  const brand: EventBrandSnapshot = {
    primaryColor: HEX_COLOR.test(primaryColor) ? primaryColor : '#0B3D2E',
    organizationName: orgIssue ? '' : organizationName,
  };

  if (raw.logoAssetId !== undefined) {
    if (typeof raw.logoAssetId !== 'string' || raw.logoAssetId.trim() === '') {
      issues.push({
        fieldId: 'brand.logoAssetId',
        code: 'CONFIG_ASSET_ID_INVALID',
        message: 'logoAssetId must be a non-empty string',
      });
    } else {
      brand.logoAssetId = raw.logoAssetId.trim();
    }
  }
  if (raw.bannerAssetId !== undefined) {
    if (
      typeof raw.bannerAssetId !== 'string' ||
      raw.bannerAssetId.trim() === ''
    ) {
      issues.push({
        fieldId: 'brand.bannerAssetId',
        code: 'CONFIG_ASSET_ID_INVALID',
        message: 'bannerAssetId must be a non-empty string',
      });
    } else {
      brand.bannerAssetId = raw.bannerAssetId.trim();
    }
  }

  const unknown = Object.keys(raw).filter(
    (k) =>
      !['primaryColor', 'organizationName', 'logoAssetId', 'bannerAssetId'].includes(
        k,
      ),
  );
  if (unknown.length > 0) {
    issues.push({
      fieldId: 'brand.unknown',
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: `Disallowed brand keys: ${unknown.join(', ')}`,
    });
  }

  return { brand, issues };
}

export function parseConfigPayload(raw: unknown): {
  ok: boolean;
  payload: EventConfigPayload;
  issues: ConfigValidationIssue[];
} {
  const issues: ConfigValidationIssue[] = [];
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      payload: {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        brand: { primaryColor: '#0B3D2E', organizationName: '' },
        sections: [],
      },
      issues: [
        {
          fieldId: 'payload',
          code: 'CONFIG_PAYLOAD_REQUIRED',
          message: 'Payload must be a JSON object',
        },
      ],
    };
  }

  const schemaVersion =
    typeof raw.schemaVersion === 'number' ? raw.schemaVersion : undefined;
  if (
    schemaVersion === undefined ||
    !(SUPPORTED_CONFIG_SCHEMA_VERSIONS as readonly number[]).includes(
      schemaVersion,
    )
  ) {
    issues.push({
      fieldId: 'schemaVersion',
      code: 'CONFIG_SCHEMA_UNSUPPORTED',
      message: `Only schemaVersion ${CONFIG_SCHEMA_VERSION} is supported`,
    });
  }

  const { brand, issues: brandIssues } = parseBrand(raw.brand);
  issues.push(...brandIssues);

  if (!Array.isArray(raw.sections)) {
    issues.push({
      fieldId: 'sections',
      code: 'CONFIG_SECTIONS_REQUIRED',
      message: 'sections must be an array',
    });
    return {
      ok: false,
      payload: {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        brand,
        sections: [],
      },
      issues,
    };
  }

  if (raw.sections.length !== EVENT_CONTENT_SECTION_KINDS.length) {
    issues.push({
      fieldId: 'sections',
      code: 'CONFIG_SECTIONS_COUNT',
      message: `Exactly ${EVENT_CONTENT_SECTION_KINDS.length} fixed section kinds required`,
    });
  }

  const seenKinds = new Set<string>();
  const seenIds = new Set<string>();
  const sections: EventContentSection[] = [];

  raw.sections.forEach((section, index) => {
    const prefix = `sections[${index}]`;
    if (!isPlainObject(section)) {
      issues.push({
        fieldId: prefix,
        code: 'CONFIG_SECTION_INVALID',
        message: 'Section must be an object',
      });
      return;
    }
    if (!isSectionKind(section.kind)) {
      issues.push({
        fieldId: `${prefix}.kind`,
        code: 'CONFIG_SECTION_KIND',
        message: 'kind must be one of the 6 allowlisted section kinds',
      });
      return;
    }
    if (seenKinds.has(section.kind)) {
      issues.push({
        fieldId: `${prefix}.kind`,
        code: 'CONFIG_SECTION_DUPLICATE',
        message: `Duplicate kind ${section.kind}`,
      });
    }
    seenKinds.add(section.kind);

    const id = asTrimmedString(section.id) ?? '';
    const idIssue = assertSafePlainText(
      `${prefix}.id`,
      id,
      CONFIG_TEXT_LIMITS.sectionId,
    );
    if (!id || idIssue) {
      issues.push(
        idIssue ?? {
          fieldId: `${prefix}.id`,
          code: 'CONFIG_SECTION_ID',
          message: 'section id is required',
        },
      );
    } else if (seenIds.has(id)) {
      issues.push({
        fieldId: `${prefix}.id`,
        code: 'CONFIG_SECTION_ID_DUPLICATE',
        message: `Duplicate id ${id}`,
      });
    } else {
      seenIds.add(id);
    }

    if (typeof section.visible !== 'boolean') {
      issues.push({
        fieldId: `${prefix}.visible`,
        code: 'CONFIG_SECTION_VISIBLE',
        message: 'visible must be boolean',
      });
    }
    if (typeof section.order !== 'number' || !Number.isInteger(section.order)) {
      issues.push({
        fieldId: `${prefix}.order`,
        code: 'CONFIG_SECTION_ORDER',
        message: 'order must be an integer',
      });
    }

    const { body, issues: bodyIssues } = parseAllowlistedBody(
      section.kind,
      section.body,
      `${prefix}.body`,
    );
    issues.push(...bodyIssues);

    sections.push({
      kind: section.kind,
      id: id || `${section.kind}-${index}`,
      visible: section.visible === true,
      order: typeof section.order === 'number' ? section.order : index,
      body,
    });
  });

  for (const kind of EVENT_CONTENT_SECTION_KINDS) {
    if (!seenKinds.has(kind)) {
      issues.push({
        fieldId: 'sections',
        code: 'CONFIG_SECTION_MISSING',
        message: `Missing section kind ${kind}`,
      });
    }
  }

  let formDefinitionId: string | undefined;
  if (raw.formDefinitionId !== undefined) {
    if (
      typeof raw.formDefinitionId !== 'string' ||
      raw.formDefinitionId.trim() === ''
    ) {
      issues.push({
        fieldId: 'formDefinitionId',
        code: 'CONFIG_FORM_ID_INVALID',
        message: 'formDefinitionId must be a string',
      });
    } else {
      formDefinitionId = raw.formDefinitionId.trim();
    }
  }
  let termsVersion: string | undefined;
  if (raw.termsVersion !== undefined) {
    if (typeof raw.termsVersion !== 'string') {
      issues.push({
        fieldId: 'termsVersion',
        code: 'CONFIG_TERMS_INVALID',
        message: 'termsVersion must be a string',
      });
    } else {
      const issue = assertSafePlainText(
        'termsVersion',
        raw.termsVersion,
        CONFIG_TEXT_LIMITS.termsVersion,
      );
      if (issue) issues.push(issue);
      else termsVersion = raw.termsVersion;
    }
  }

  const unknown = Object.keys(raw).filter(
    (k) =>
      ![
        'schemaVersion',
        'brand',
        'sections',
        'formDefinitionId',
        'termsVersion',
      ].includes(k),
  );
  if (unknown.length > 0) {
    issues.push({
      fieldId: 'payload.unknown',
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: `Disallowed payload keys: ${unknown.join(', ')}`,
    });
  }

  const payload: EventConfigPayload = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    brand,
    sections: sections.sort((a, b) => a.order - b.order),
    ...(formDefinitionId ? { formDefinitionId } : {}),
    ...(termsVersion ? { termsVersion } : {}),
  };

  return { ok: issues.length === 0, payload, issues };
}

/** Throws ConfigError when payload is not a valid typed C-B document. */
export function requireValidConfigPayload(
  raw: unknown,
): EventConfigPayload {
  const parsed = parseConfigPayload(raw);
  if (!parsed.ok) {
    const first = parsed.issues[0];
    if (first?.code === 'CONFIG_SCHEMA_UNSUPPORTED') {
      throw new ConfigError(
        CONFIG_ERROR_CODES.CONFIG_SCHEMA_UNSUPPORTED,
        first.message,
      );
    }
    if (first?.code === 'CONFIG_PAYLOAD_REQUIRED') {
      throw new ConfigError(
        CONFIG_ERROR_CODES.CONFIG_PAYLOAD_REQUIRED,
        first.message,
      );
    }
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
      first?.message ?? 'Config payload failed validation',
    );
  }
  return parsed.payload;
}

export function isSchemaCompatible(schemaVersion: number): boolean {
  return (SUPPORTED_CONFIG_SCHEMA_VERSIONS as readonly number[]).includes(
    schemaVersion,
  );
}

export { ASSET_LIMITS, EVENT_CONTENT_SECTION_KINDS };
