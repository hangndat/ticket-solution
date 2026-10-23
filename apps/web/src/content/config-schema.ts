/**
 * C-B typed config validation for admin editor + BFF allowlist.
 * No arbitrary HTML/CSS/JS; plain-text / FAQ items only.
 */

import {
  ASSET_LIMITS,
  EVENT_CONTENT_SECTION_KINDS,
  type EventBrandSnapshot,
  type EventConfigPayload,
  type EventContentSection,
  type EventContentSectionKind,
} from '@ticket/contracts';

export const CONFIG_SCHEMA_VERSION = 1;

/** Plain-text field caps (MVP). */
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

export function isSectionKind(value: unknown): value is EventContentSectionKind {
  return typeof value === 'string' && SECTION_KIND_SET.has(value);
}

export function defaultConfigPayload(): EventConfigPayload {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    brand: {
      primaryColor: '#0B3D2E',
      organizationName: '',
    },
    sections: EVENT_CONTENT_SECTION_KINDS.map((kind, order) => ({
      kind,
      id: `${kind}-1`,
      visible: kind === 'hero' || kind === 'info' || kind === 'redeem',
      order,
      body: defaultBodyForKind(kind),
    })),
  };
}

export function defaultBodyForKind(
  kind: EventContentSectionKind,
): AllowlistedSectionBody {
  if (kind === 'faq') return { title: 'FAQ', items: [] };
  if (kind === 'terms') return { title: 'Điều khoản', termsVersion: '', text: '' };
  if (kind === 'hero') return { title: '', text: '' };
  if (kind === 'redeem') return { title: 'Đổi vé', text: '' };
  if (kind === 'guide') return { title: 'Hướng dẫn', text: '' };
  return { title: 'Thông tin', text: '' };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  return value;
}

/** Reject control chars and obvious script/CSS injection vectors in plain fields. */
export function assertSafePlainText(
  fieldId: string,
  value: string,
  maxLen: number,
): ConfigValidationIssue | null {
  if (value.length > maxLen) {
    return {
      fieldId,
      code: 'CONFIG_TEXT_TOO_LONG',
      message: `${fieldId} vượt ${maxLen} ký tự.`,
    };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    return {
      fieldId,
      code: 'CONFIG_TEXT_INVALID',
      message: `${fieldId} chứa ký tự điều khiển.`,
    };
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
      message: `${fieldId} không được chứa HTML/JS/CSS.`,
    };
  }
  return null;
}

/**
 * Escape for safe text-node rendering. Never treat user content as HTML.
 */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      message: 'Section body phải là object.',
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
      message: `Khóa không cho phép: ${unknownKeys.join(', ')}.`,
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
      message: 'termsVersion chỉ dùng cho section terms.',
    });
  }

  if (kind === 'faq') {
    if (raw.items === undefined) {
      body.items = [];
    } else if (!Array.isArray(raw.items)) {
      issues.push({
        fieldId: `${fieldPrefix}.items`,
        code: 'CONFIG_FAQ_ITEMS_INVALID',
        message: 'FAQ items phải là mảng.',
      });
    } else if (raw.items.length > CONFIG_TEXT_LIMITS.faqItems) {
      issues.push({
        fieldId: `${fieldPrefix}.items`,
        code: 'CONFIG_FAQ_TOO_MANY',
        message: `Tối đa ${CONFIG_TEXT_LIMITS.faqItems} câu FAQ.`,
      });
    } else {
      const items: FaqItem[] = [];
      raw.items.forEach((item, index) => {
        if (!isPlainObject(item)) {
          issues.push({
            fieldId: `${fieldPrefix}.items[${index}]`,
            code: 'CONFIG_FAQ_ITEM_INVALID',
            message: 'Mỗi FAQ item phải là object {question,answer}.',
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
      message: 'items chỉ dùng cho section faq.',
    });
  }

  return { body, issues };
}

export function parseBrand(
  raw: unknown,
): { brand: EventBrandSnapshot; issues: ConfigValidationIssue[] } {
  const issues: ConfigValidationIssue[] = [];
  if (!isPlainObject(raw)) {
    return {
      brand: { primaryColor: '#0B3D2E', organizationName: '' },
      issues: [
        {
          fieldId: 'brand',
          code: 'CONFIG_BRAND_REQUIRED',
          message: 'brand object là bắt buộc.',
        },
      ],
    };
  }
  const organizationName = asTrimmedString(raw.organizationName) ?? '';
  const orgIssue = assertSafePlainText(
    'brand.organizationName',
    organizationName,
    CONFIG_TEXT_LIMITS.organizationName,
  );
  if (orgIssue) issues.push(orgIssue);

  const primaryColor = asTrimmedString(raw.primaryColor) ?? '';
  if (!HEX_COLOR.test(primaryColor)) {
    issues.push({
      fieldId: 'brand.primaryColor',
      code: 'CONFIG_COLOR_INVALID',
      message: 'primaryColor phải là mã hex #RGB/#RRGGBB.',
    });
  }

  const brand: EventBrandSnapshot = {
    primaryColor: HEX_COLOR.test(primaryColor) ? primaryColor : '#0B3D2E',
    organizationName: orgIssue ? '' : organizationName,
  };

  if (raw.logoAssetId !== undefined) {
    if (typeof raw.logoAssetId !== 'string' || raw.logoAssetId.trim() === '') {
      issues.push({
        fieldId: 'brand.logoAssetId',
        code: 'CONFIG_ASSET_ID_INVALID',
        message: 'logoAssetId phải là chuỗi không rỗng.',
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
        message: 'bannerAssetId phải là chuỗi không rỗng.',
      });
    } else {
      brand.bannerAssetId = raw.bannerAssetId.trim();
    }
  }

  const unknown = Object.keys(raw).filter(
    (k) =>
      ![
        'primaryColor',
        'organizationName',
        'logoAssetId',
        'bannerAssetId',
      ].includes(k),
  );
  if (unknown.length > 0) {
    issues.push({
      fieldId: 'brand.unknown',
      code: 'CONFIG_BODY_UNKNOWN_KEYS',
      message: `Khóa brand không cho phép: ${unknown.join(', ')}.`,
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
      payload: defaultConfigPayload(),
      issues: [
        {
          fieldId: 'payload',
          code: 'CONFIG_PAYLOAD_REQUIRED',
          message: 'Payload phải là JSON object.',
        },
      ],
    };
  }

  if (raw.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    issues.push({
      fieldId: 'schemaVersion',
      code: 'CONFIG_SCHEMA_UNSUPPORTED',
      message: `Chỉ hỗ trợ schemaVersion ${CONFIG_SCHEMA_VERSION}.`,
    });
  }

  const { brand, issues: brandIssues } = parseBrand(raw.brand);
  issues.push(...brandIssues);

  if (!Array.isArray(raw.sections)) {
    issues.push({
      fieldId: 'sections',
      code: 'CONFIG_SECTIONS_REQUIRED',
      message: 'sections phải là mảng.',
    });
    return { ok: false, payload: defaultConfigPayload(), issues };
  }

  if (raw.sections.length !== EVENT_CONTENT_SECTION_KINDS.length) {
    issues.push({
      fieldId: 'sections',
      code: 'CONFIG_SECTIONS_COUNT',
      message: `Cần đúng ${EVENT_CONTENT_SECTION_KINDS.length} section kinds cố định.`,
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
        message: 'Section phải là object.',
      });
      return;
    }
    if (!isSectionKind(section.kind)) {
      issues.push({
        fieldId: `${prefix}.kind`,
        code: 'CONFIG_SECTION_KIND',
        message: 'kind phải thuộc allowlist 6 loại.',
      });
      return;
    }
    if (seenKinds.has(section.kind)) {
      issues.push({
        fieldId: `${prefix}.kind`,
        code: 'CONFIG_SECTION_DUPLICATE',
        message: `Trùng kind ${section.kind}.`,
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
          message: 'id section bắt buộc.',
        },
      );
    } else if (seenIds.has(id)) {
      issues.push({
        fieldId: `${prefix}.id`,
        code: 'CONFIG_SECTION_ID_DUPLICATE',
        message: `Trùng id ${id}.`,
      });
    } else {
      seenIds.add(id);
    }

    if (typeof section.visible !== 'boolean') {
      issues.push({
        fieldId: `${prefix}.visible`,
        code: 'CONFIG_SECTION_VISIBLE',
        message: 'visible phải là boolean.',
      });
    }
    if (typeof section.order !== 'number' || !Number.isInteger(section.order)) {
      issues.push({
        fieldId: `${prefix}.order`,
        code: 'CONFIG_SECTION_ORDER',
        message: 'order phải là integer.',
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
        message: `Thiếu section kind ${kind}.`,
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
        message: 'formDefinitionId phải là chuỗi.',
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
        message: 'termsVersion phải là chuỗi.',
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
      message: `Khóa payload không cho phép: ${unknown.join(', ')}.`,
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

export function visibleSectionsInOrder(
  payload: EventConfigPayload,
): EventContentSection[] {
  return [...payload.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);
}

export { ASSET_LIMITS, EVENT_CONTENT_SECTION_KINDS };
