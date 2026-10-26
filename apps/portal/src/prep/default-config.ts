import type { EventConfigPayload } from '@ticket/contracts';

/** Fixed-schema first draft for brand/config PREP (no HTML). */
export function buildMinimalConfigPayload(input: {
  organizationName: string;
  primaryColor: string;
  termsText?: string;
  termsVersion?: string;
}): EventConfigPayload {
  const termsVersion = (input.termsVersion ?? 'terms-v1').trim() || 'terms-v1';
  const termsText = (input.termsText ?? '').trim();
  return {
    schemaVersion: 1,
    brand: {
      organizationName: input.organizationName.trim(),
      primaryColor: input.primaryColor.trim(),
    },
    sections: [
      {
        kind: 'hero',
        id: 'hero-1',
        visible: true,
        order: 0,
        body: { title: input.organizationName.trim() || 'Sự kiện' },
      },
      {
        kind: 'info',
        id: 'info-1',
        visible: false,
        order: 1,
        body: { title: 'Thông tin' },
      },
      {
        kind: 'redeem',
        id: 'redeem-1',
        visible: false,
        order: 2,
        body: { title: 'Nhận vé' },
      },
      {
        kind: 'guide',
        id: 'guide-1',
        visible: false,
        order: 3,
        body: { title: 'Hướng dẫn' },
      },
      {
        kind: 'faq',
        id: 'faq-1',
        visible: false,
        order: 4,
        body: { title: 'FAQ', items: [] },
      },
      {
        kind: 'terms',
        id: 'terms-1',
        visible: true,
        order: 5,
        body: {
          termsVersion,
          ...(termsText ? { text: termsText } : {}),
        },
      },
    ],
    termsVersion,
  };
}

export function isMinimalBrandOk(payload: EventConfigPayload): boolean {
  const name = (payload.brand.organizationName ?? '').trim();
  const color = (payload.brand.primaryColor ?? '').trim();
  return name.length > 0 && color.length > 0;
}

export function hasTermsContent(payload: EventConfigPayload): boolean {
  const terms = payload.sections.find((s) => s.kind === 'terms');
  if (!terms) return false;
  const body = terms.body as { termsVersion?: string; text?: string };
  return (
    (body.termsVersion ?? '').trim().length > 0 ||
    (body.text ?? '').trim().length > 0
  );
}
