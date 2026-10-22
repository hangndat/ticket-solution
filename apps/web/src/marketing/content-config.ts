import type { MarketingLocale } from './hosts';

export type BentoCellConfig = {
  id: string;
  key: string;
  colSpan: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  featured?: boolean;
  image: { src: string; width: number; height: number };
};

/** Asymmetric bento layout per MKT-PD §3 (desktop 4-col). */
export const BENTO_CELLS: BentoCellConfig[] = [
  {
    id: 'bento-invite',
    key: 'bento.invite',
    colSpan: 2,
    featured: true,
    image: {
      src: '/marketing/bento-invite.webp',
      width: 1982,
      height: 1834,
    },
  },
  {
    id: 'bento-qr',
    key: 'bento.qr',
    colSpan: 1,
    image: {
      src: '/marketing/bento-qr.webp',
      width: 1280,
      height: 800,
    },
  },
  {
    id: 'bento-gate',
    key: 'bento.gate',
    colSpan: 1,
    featured: true,
    image: {
      src: '/marketing/bento-gate.webp',
      width: 1280,
      height: 955,
    },
  },
  {
    id: 'bento-offline',
    key: 'bento.offline',
    colSpan: 1,
    image: {
      src: '/marketing/bento-offline.webp',
      width: 390,
      height: 952,
    },
  },
  {
    id: 'bento-admin',
    key: 'bento.admin',
    colSpan: 2,
    image: {
      src: '/marketing/bento-admin.webp',
      width: 1280,
      height: 800,
    },
  },
  {
    id: 'bento-whitelabel',
    key: 'bento.whitelabel',
    colSpan: 1,
    image: {
      src: '/marketing/bento-whitelabel.webp',
      width: 1280,
      height: 800,
    },
  },
  {
    id: 'bento-ops',
    key: 'bento.ops',
    colSpan: 4,
    image: {
      src: '/marketing/bento-ops.webp',
      width: 1280,
      height: 800,
    },
  },
];

export const HERO_PREVIEW = {
  desktop: {
    src: '/marketing/app-redeem-desktop.webp',
    width: 1982,
    height: 1834,
  },
  mobile: {
    src: '/marketing/app-redeem-mobile.webp',
    width: 390,
    height: 844,
  },
} as const;

export type OutcomeMetricId = 'metric1' | 'metric2' | 'metric3';

export const OUTCOME_METRIC_IDS: OutcomeMetricId[] = [
  'metric1',
  'metric2',
  'metric3',
];

/** Illustrative bar heights (0–100) for static demo chart — not live data. */
export const OUTCOME_CHART_BARS = [42, 68, 55, 82, 74, 91, 63, 48] as const;

export type FaqItem = {
  id: string;
  question: Record<MarketingLocale, string>;
  answer: Record<MarketingLocale, string>;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: {
      vi: 'Vemoki có phải marketplace bán vé không?',
      en: 'Is Vemoki a ticket marketplace?',
    },
    answer: {
      vi:
        'Không. Vemoki là hệ vận hành in-person: mã mời, QR, cổng — không «tìm sự kiện» công khai như marketplace.',
      en:
        'No. Vemoki is in-person ops: invites, QR, gate — not public event discovery like a marketplace.',
    },
  },
  {
    id: 'faq-2',
    question: {
      vi: 'Có thanh toán hoặc bán vé trả phí trên nền tảng?',
      en: 'Paid checkout on the platform?',
    },
    answer: {
      vi:
        'MVP không có checkout, refund hay chuyển nhượng trên platform.',
      en: 'MVP has no checkout, refunds, or transfers on-platform.',
    },
  },
  {
    id: 'faq-3',
    question: {
      vi: 'Demo có phải khách hàng thật?',
      en: 'Is the demo a real customer?',
    },
    answer: {
      vi:
        'Không. Demo hiện tại là fixture giả lập để xem sản phẩm.',
      en: 'No. Current demos are simulated fixtures to explore the product.',
    },
  },
  {
    id: 'faq-4',
    question: {
      vi: 'Ai là người mua trang này?',
      en: 'Who is this page for?',
    },
    answer: {
      vi:
        'Tenant Owner, agency và đội vận hành doanh nghiệp — không phải khách cầm vé.',
      en:
        'Tenant owners, agencies, and enterprise ops teams — not ticket-holding guests.',
    },
  },
  {
    id: 'faq-5',
    question: {
      vi: 'Khách đổi mã ở đâu?',
      en: 'Where do guests redeem?',
    },
    answer: {
      vi:
        'Trên app.vemoki.com (web/iOS) dưới brand sự kiện — link từ footer marketing.',
      en:
        'On app.vemoki.com (web/iOS) under the event brand — see marketing footer.',
    },
  },
  {
    id: 'faq-6',
    question: {
      vi: 'Cổng hoạt động khi mạng yếu?',
      en: 'Gate with poor connectivity?',
    },
    answer: {
      vi:
        'Có thiết kế cổng multi-device offline (D7); không hứa mọi tình huống «online only».',
      en:
        'Multi-device offline gate is in scope (D7); we do not promise «online only» for every edge case.',
    },
  },
  {
    id: 'faq-7',
    question: {
      vi: 'White-label nghĩa là gì?',
      en: 'What does white-label mean?',
    },
    answer: {
      vi:
        'Khách thấy brand org/sự kiện; Vemoki hiện ở marketing, tài khoản và đăng nhập.',
      en:
        'Guests see org/event brand; Vemoki appears on marketing, account, and sign-in.',
    },
  },
  {
    id: 'faq-8',
    question: {
      vi: 'Dữ liệu tenant có tách biệt?',
      en: 'Is tenant data isolated?',
    },
    answer: {
      vi:
        'Có — shared PostgreSQL với RLS và phân quyền deny-by-default (O08).',
      en:
        'Yes — shared PostgreSQL with RLS and deny-by-default authz (O08).',
    },
  },
  {
    id: 'faq-9',
    question: {
      vi: 'Có app Android?',
      en: 'Native Android scanner?',
    },
    answer: {
      vi:
        'MVP tập trung iOS cho scanner; Android native không trong phạm vi O10.',
      en:
        'MVP focuses on iOS for scanning; native Android is out of scope (O10).',
    },
  },
  {
    id: 'faq-10',
    question: {
      vi: 'Làm sao bắt đầu sau khi gửi form quan tâm?',
      en: "After interest form, what's next?",
    },
    answer: {
      vi:
        'Chúng tôi liên hệ email — onboarding tenant ACTIVE qua Operator, không tự kích hoạt từ form marketing.',
      en:
        'We follow up by email — tenant ACTIVE is via Operator, not auto from the marketing form.',
    },
  },
];
