/**
 * Published form/terms bodies for WEB-05 — must match tests/e2e/harness/seed.mjs
 * eventPayload() and the v2 save payload in live.test.mjs #[WEB-05].
 */
export const WEB05_PUBLISHED_FORM_V1 = {
  formVersion: 'form-v1',
  fields: [
    { id: 'full_name', label: 'Họ tên', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'phone', label: 'Điện thoại', type: 'phone', required: true },
    {
      id: 'shirt',
      label: 'Áo',
      type: 'select',
      required: true,
      options: [{ id: 'm', label: 'M' }],
    },
    { id: 'agree', label: 'Đồng ý', type: 'checkbox', required: true },
  ],
};

export const WEB05_PUBLISHED_TERMS_V1 = {
  termsVersion: 'terms-v1',
  body: 'Synthetic test terms',
};

export const WEB05_PUBLISHED_TERMS_V2 = {
  termsVersion: 'terms-v2',
  body: 'Synthetic v2',
};

export const WEB05_PUBLISHED_FORM_V2 = {
  formVersion: 'form-v2',
  fields: [
    { id: 'full_name', label: 'Name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'phone', label: 'Phone', type: 'phone', required: true },
    {
      id: 'shirt',
      label: 'Shirt',
      type: 'select',
      required: true,
      options: [{ id: 'm', label: 'M' }],
    },
    { id: 'agree', label: 'Agree', type: 'checkbox', required: true },
  ],
};

/** Config v2 POST body (owner publish in WEB-05 H). */
export function web05ConfigV2Payload(tenantLabel = 'Tenant WEB-05 v2') {
  return {
    schemaVersion: 1,
    brand: {
      primaryColor: '#164E63',
      organizationName: tenantLabel,
    },
    sections: [
      {
        kind: 'hero',
        id: 'hero',
        visible: true,
        order: 0,
        body: { title: 'E2E WEB-05 v2', text: 'Synthetic' },
      },
      {
        kind: 'info',
        id: 'info',
        visible: true,
        order: 1,
        body: { title: 'Info', text: 'v2' },
      },
      {
        kind: 'redeem',
        id: 'redeem',
        visible: true,
        order: 2,
        body: { title: 'Redeem', text: '' },
      },
      {
        kind: 'guide',
        id: 'guide',
        visible: false,
        order: 3,
        body: { title: 'Guide', text: '' },
      },
      {
        kind: 'faq',
        id: 'faq',
        visible: true,
        order: 4,
        body: { title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
      },
      {
        kind: 'terms',
        id: 'terms',
        visible: true,
        order: 5,
        body: {
          title: 'Terms',
          termsVersion: WEB05_PUBLISHED_TERMS_V2.termsVersion,
          text: WEB05_PUBLISHED_TERMS_V2.body,
        },
      },
    ],
    formDefinitionId: 'form-v2',
    termsVersion: WEB05_PUBLISHED_TERMS_V2.termsVersion,
    form: WEB05_PUBLISHED_FORM_V2,
  };
}
