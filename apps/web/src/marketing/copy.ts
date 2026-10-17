/**
 * O13 marketing copy dictionary — keys from docs/design/o13-platform-sales/copy-vi-en.md
 */

import type { MarketingLocale } from './hosts';

export type CopyKey =
  | 'meta.title'
  | 'meta.description'
  | 'nav.brand'
  | 'nav.demo'
  | 'nav.interest'
  | 'nav.login'
  | 'nav.privacy'
  | 'nav.support'
  | 'nav.locale.vi'
  | 'nav.locale.en'
  | 'nav.locale.label'
  | 'skip'
  | 'badge.demo'
  | 'footer.attendee'
  | 'footer.tagline'
  | 'hero.headline'
  | 'hero.support'
  | 'hero.cta.demo'
  | 'hero.cta.interest'
  | 'hero.cta.login'
  | 'hero.demo_note'
  | 'audience.title'
  | 'audience.lead'
  | 'audience.owner.title'
  | 'audience.owner.body'
  | 'audience.agency.title'
  | 'audience.agency.body'
  | 'audience.staff.title'
  | 'audience.staff.body'
  | 'audience.guest.title'
  | 'audience.guest.body'
  | 'workflow.title'
  | 'workflow.lead'
  | 'workflow.step1'
  | 'workflow.step2'
  | 'workflow.step3'
  | 'workflow.step4'
  | 'workflow.step5'
  | 'workflow.note'
  | 'whitelabel.title'
  | 'whitelabel.lead'
  | 'whitelabel.point1'
  | 'whitelabel.point2'
  | 'whitelabel.point3'
  | 'trust.title'
  | 'trust.lead'
  | 'trust.p1.title'
  | 'trust.p1.body'
  | 'trust.p2.title'
  | 'trust.p2.body'
  | 'trust.p3.title'
  | 'trust.p3.body'
  | 'demo.title'
  | 'demo.lead'
  | 'demo.cta'
  | 'demo.banner'
  | 'interest.title'
  | 'interest.lead'
  | 'interest.name'
  | 'interest.email'
  | 'interest.org'
  | 'interest.role'
  | 'interest.role.owner'
  | 'interest.role.agency'
  | 'interest.role.other'
  | 'interest.note'
  | 'interest.consent'
  | 'interest.consent.before'
  | 'interest.submit'
  | 'interest.sending'
  | 'interest.retry'
  | 'interest.success.title'
  | 'interest.success.body'
  | 'interest.error.generic'
  | 'interest.error.name'
  | 'interest.error.email'
  | 'interest.error.emailInvalid'
  | 'interest.error.org'
  | 'interest.error.role'
  | 'interest.error.consent'
  | 'cta.repeat.title'
  | 'cta.repeat.demo'
  | 'cta.repeat.interest'
  | 'privacy.title'
  | 'privacy.updated'
  | 'privacy.intro'
  | 'privacy.s1.title'
  | 'privacy.s1.body'
  | 'privacy.s2.title'
  | 'privacy.s2.body'
  | 'privacy.s3.title'
  | 'privacy.s3.body'
  | 'privacy.note'
  | 'support.title'
  | 'support.lead'
  | 'support.email.label'
  | 'support.email.value'
  | 'support.sla'
  | 'support.app'
  | 'support.sales'
  | 'support.guest'
  | 'hero.visual.label'
  | 'hero.visual.meta'
  | 'interest.role.placeholder'
  | 'interest.consent.privacy';

const VI: Record<CopyKey, string> = {
  'meta.title': 'Vemoki — Nền tảng sự kiện trực tiếp & cổng',
  'meta.description':
    'Multi-tenant cho organizer và agency: mã mời, QR, Gate có audit. Thương hiệu của bạn phía khách.',
  'nav.brand': 'vemoki',
  'nav.demo': 'Xem demo',
  'nav.interest': 'Đăng ký quan tâm',
  'nav.login': 'Đăng nhập',
  'nav.privacy': 'Quyền riêng tư',
  'nav.support': 'Hỗ trợ',
  'nav.locale.vi': 'VI',
  'nav.locale.en': 'EN',
  'nav.locale.label': 'Ngôn ngữ',
  skip: 'Bỏ qua nội dung',
  'badge.demo': 'Demo giả lập',
  'footer.attendee': 'Bạn có mã mời? Đổi vé trên ứng dụng',
  'footer.tagline': 'vemoki↗ · ops sự kiện trực tiếp',
  'hero.headline': 'Từ mã mời đến cổng — trên một nền tảng',
  'hero.support':
    'Multi-tenant cho organizer và agency. Khách thấy thương hiệu của bạn; Gate có audit, không phụ thuộc marketplace.',
  'hero.cta.demo': 'Xem demo',
  'hero.cta.interest': 'Đăng ký quan tâm',
  'hero.cta.login': 'Đăng nhập',
  'hero.demo_note': 'Demo hiện tại là giả lập — không phải khách hàng thật.',
  'audience.title': 'Ai dùng Vemoki',
  'audience.lead':
    'Trang này dành cho người mua vận hành sự kiện — không phải khách cầm vé.',
  'audience.owner.title': 'Tenant Owner',
  'audience.owner.body':
    'Tự chạy nhiều sự kiện trong tổ chức: phát hành mã, email vé, theo dõi cổng.',
  'audience.agency.title': 'Agency',
  'audience.agency.body':
    'Membership nhiều tenant — một platform, nhiều thương hiệu khách, không fork code.',
  'audience.staff.title': 'Nhân sự cổng',
  'audience.staff.body':
    'Quét QR trên iOS; chống trùng và audit theo sự kiện.',
  'audience.guest.title': 'Khách tham dự',
  'audience.guest.body':
    'Đổi mã trên web/iOS với brand sự kiện — không phải buyer của trang bán này.',
  'workflow.title': 'Luồng vận hành',
  'workflow.lead': 'Một chuỗi ops rõ — từ chuẩn bị đến cổng.',
  'workflow.step1': 'Tạo sự kiện & loại vé / nguồn mã',
  'workflow.step2': 'Phát hành invite hoặc import khách',
  'workflow.step3': 'Khách đổi mã → nhận QR',
  'workflow.step4': 'Gate quét, chống trùng, ghi audit',
  'workflow.step5': 'Xem tiến độ ops với mốc thời gian trung thực (asOf)',
  'workflow.note': 'Không phải marketplace “tìm sự kiện gần bạn”.',
  'whitelabel.title': 'Thương hiệu của bạn phía khách',
  'whitelabel.lead':
    'Trang sự kiện và trải nghiệm khách mang identity org/event. Vemoki xuất hiện ở marketing, tài khoản và đăng nhập.',
  'whitelabel.point1': 'Logo & màu sự kiện cấu hình được',
  'whitelabel.point2': 'Ba lớp brand: platform · org · event',
  'whitelabel.point3': 'Agency chạy nhiều client trên cùng platform',
  'trust.title': 'An toàn vận hành',
  'trust.lead': 'Thiết kế cho cổng thật — không dashboard “ảo real-time”.',
  'trust.p1.title': 'Tách tenant',
  'trust.p1.body': 'Dữ liệu và quyền theo tenant; deny-by-default.',
  'trust.p2.title': 'Check-in chắc',
  'trust.p2.body': 'Chống trùng vé; audit lại được sau sự kiện.',
  'trust.p3.title': 'Trung thực về độ trễ',
  'trust.p3.body':
    'Số liệu ops kèm mốc asOf — không hứa “tức thì tuyệt đối”.',
  'demo.title': 'Dùng thử bản demo giả lập',
  'demo.lead':
    'Mọi demo hiện nay là fixture để xem sản phẩm — không phải case study khách hàng.',
  'demo.cta': 'Mở demo trên ứng dụng',
  'demo.banner': 'Demo giả lập · không dùng làm bằng chứng khách thật',
  'interest.title': 'Đăng ký quan tâm',
  'interest.lead':
    'Để lại thông tin — chúng tôi liên hệ về demo hoặc onboarding. Không thanh toán trên form này.',
  'interest.name': 'Họ tên',
  'interest.email': 'Email công việc',
  'interest.org': 'Tổ chức',
  'interest.role': 'Vai trò',
  'interest.role.owner': 'Tenant Owner',
  'interest.role.agency': 'Agency',
  'interest.role.other': 'Khác',
  'interest.note': 'Ghi chú (không bắt buộc)',
  'interest.consent': 'Tôi đồng ý được liên hệ về Vemoki. Xem Quyền riêng tư.',
  'interest.consent.before': 'Tôi đồng ý được liên hệ về Vemoki. Xem',
  'interest.submit': 'Gửi đăng ký',
  'interest.sending': 'Đang gửi…',
  'interest.retry': 'Thử lại',
  'interest.success.title': 'Đã nhận đăng ký',
  'interest.success.body':
    'Cảm ơn bạn. Chúng tôi sẽ liên hệ qua email — chưa phải tài khoản production.',
  'interest.error.generic':
    'Không gửi được. Thử lại hoặc viết cho hỗ trợ.',
  'interest.error.name': 'Nhập họ tên',
  'interest.error.email': 'Nhập email',
  'interest.error.emailInvalid': 'Email không hợp lệ',
  'interest.error.org': 'Nhập tổ chức',
  'interest.error.role': 'Chọn vai trò',
  'interest.error.consent': 'Cần đồng ý để chúng tôi liên hệ',
  'cta.repeat.title': 'Sẵn sàng xem vận hành thật?',
  'cta.repeat.demo': 'Xem demo',
  'cta.repeat.interest': 'Đăng ký quan tâm',
  'privacy.title': 'Quyền riêng tư',
  'privacy.updated': 'Cập nhật: 2026-10-18',
  'privacy.intro':
    'Vemoki (`vemoki.com`) xử lý dữ liệu cần thiết để vận hành nền tảng sự kiện và trả lời đăng ký quan tâm.',
  'privacy.s1.title': 'Dữ liệu chúng tôi thu',
  'privacy.s1.body':
    'Tài khoản tổ chức; thông tin sự kiện và mã/vé; dữ liệu check-in; form quan tâm (tên, email, tổ chức, ghi chú); nhật ký kỹ thuật cần thiết.',
  'privacy.s2.title': 'Mục đích',
  'privacy.s2.body':
    'Cung cấp dịch vụ multi-tenant; gửi vé/thông báo liên quan sự kiện; hỗ trợ và follow-up GTM; bảo mật và chống lạm dụng.',
  'privacy.s3.title': 'Liên hệ',
  'privacy.s3.body':
    'Câu hỏi quyền riêng tư: dùng trang Hỗ trợ hoặc email liên hệ trên trang Hỗ trợ.',
  'privacy.note':
    'Bản tối thiểu cho ASC/trust — pháp lý chi tiết có thể mở rộng sau; không chặn ship stub P0.',
  'support.title': 'Hỗ trợ',
  'support.lead': 'Hỗ trợ organizer và agency dùng Vemoki.',
  'support.email.label': 'Email',
  'support.email.value': 'support@vemoki.com',
  'support.sla':
    'Phản hồi trong giờ làm việc (UTC+7), thường trong 1–2 ngày làm việc.',
  'support.app': 'Đăng nhập sản phẩm',
  'support.sales': 'Về trang bán',
  'support.guest': 'Khách có mã mời: đổi vé trên ứng dụng',
  'hero.visual.label': 'Gate · QR · audit',
  'hero.visual.meta': 'Bầu không khí sản phẩm — không collage thẻ',
  'interest.role.placeholder': 'Chọn vai trò',
  'interest.consent.privacy': 'Quyền riêng tư',
};

const EN: Record<CopyKey, string> = {
  'meta.title': 'Vemoki — In-person events & gate platform',
  'meta.description':
    'Multi-tenant for organizers and agencies: invite codes, QR, audited Gate. Your brand in front of guests.',
  'nav.brand': 'vemoki',
  'nav.demo': 'View demo',
  'nav.interest': 'Register interest',
  'nav.login': 'Log in',
  'nav.privacy': 'Privacy',
  'nav.support': 'Support',
  'nav.locale.vi': 'VI',
  'nav.locale.en': 'EN',
  'nav.locale.label': 'Language',
  skip: 'Skip to content',
  'badge.demo': 'Simulated demo',
  'footer.attendee': 'Have an invite code? Redeem on the app',
  'footer.tagline': 'vemoki↗ · in-person event ops',
  'hero.headline': 'From invite code to the gate — on one platform',
  'hero.support':
    'Multi-tenant for organizers and agencies. Guests see your brand; Gate stays audited — not a marketplace.',
  'hero.cta.demo': 'View demo',
  'hero.cta.interest': 'Register interest',
  'hero.cta.login': 'Log in',
  'hero.demo_note': 'Current demo is simulated — not a real customer.',
  'audience.title': 'Who Vemoki is for',
  'audience.lead':
    'This page is for event operators — not guests holding a ticket.',
  'audience.owner.title': 'Tenant Owner',
  'audience.owner.body':
    'Run multiple events in your org: issue codes, email tickets, track the gate.',
  'audience.agency.title': 'Agency',
  'audience.agency.body':
    'Membership across tenants — one platform, many client brands, no code forks.',
  'audience.staff.title': 'Gate staff',
  'audience.staff.body':
    'Scan QR on iOS; duplicate-safe check-in with per-event audit.',
  'audience.guest.title': 'Attendees',
  'audience.guest.body':
    'Redeem on web/iOS under the event brand — not the buyer of this sales page.',
  'workflow.title': 'How it runs',
  'workflow.lead': 'One clear ops chain — from prep to the gate.',
  'workflow.step1': 'Create event & ticket types / code sources',
  'workflow.step2': 'Issue invites or import guests',
  'workflow.step3': 'Guest redeems → gets QR',
  'workflow.step4': 'Gate scans, blocks duplicates, writes audit',
  'workflow.step5': 'Watch ops progress with honest as-of timing',
  'workflow.note': 'Not a “events near you” marketplace.',
  'whitelabel.title': 'Your brand in front of guests',
  'whitelabel.lead':
    'Event pages and guest flows carry org/event identity. Vemoki shows up on marketing, account, and sign-in.',
  'whitelabel.point1': 'Configurable event logo & colors',
  'whitelabel.point2': 'Three brand layers: platform · org · event',
  'whitelabel.point3': 'Agencies run many clients on one platform',
  'trust.title': 'Operational safety',
  'trust.lead': 'Built for real gates — not fake real-time dashboards.',
  'trust.p1.title': 'Tenant isolation',
  'trust.p1.body': 'Data and rights stay per tenant; deny-by-default.',
  'trust.p2.title': 'Reliable check-in',
  'trust.p2.body': 'Duplicate-safe admission; auditable after the event.',
  'trust.p3.title': 'Honest latency',
  'trust.p3.body':
    'Ops numbers carry an as-of mark — no absolute real-time promise.',
  'demo.title': 'Try the simulated demo',
  'demo.lead':
    'Every current demo is a fixture to explore the product — not a customer case study.',
  'demo.cta': 'Open demo in the app',
  'demo.banner': 'Simulated demo · not proof of real customers',
  'interest.title': 'Register your interest',
  'interest.lead':
    'Leave your details — we’ll follow up about a demo or onboarding. No payment on this form.',
  'interest.name': 'Full name',
  'interest.email': 'Work email',
  'interest.org': 'Organization',
  'interest.role': 'Role',
  'interest.role.owner': 'Tenant Owner',
  'interest.role.agency': 'Agency',
  'interest.role.other': 'Other',
  'interest.note': 'Notes (optional)',
  'interest.consent':
    'I agree to be contacted about Vemoki. See Privacy.',
  'interest.consent.before': 'I agree to be contacted about Vemoki. See',
  'interest.submit': 'Submit',
  'interest.sending': 'Sending…',
  'interest.retry': 'Try again',
  'interest.success.title': 'Interest received',
  'interest.success.body':
    'Thank you. We’ll follow up by email — this is not a production account yet.',
  'interest.error.generic':
    'Couldn’t send. Retry or contact support.',
  'interest.error.name': 'Enter your name',
  'interest.error.email': 'Enter your email',
  'interest.error.emailInvalid': 'Enter a valid email',
  'interest.error.org': 'Enter your organization',
  'interest.error.role': 'Select a role',
  'interest.error.consent': 'Consent required to contact you',
  'cta.repeat.title': 'Ready to see real ops?',
  'cta.repeat.demo': 'View demo',
  'cta.repeat.interest': 'Register interest',
  'privacy.title': 'Privacy',
  'privacy.updated': 'Updated: 2026-10-18',
  'privacy.intro':
    'Vemoki (`vemoki.com`) processes data needed to run the event platform and respond to interest registrations.',
  'privacy.s1.title': 'Data we collect',
  'privacy.s1.body':
    'Organization accounts; event and code/ticket data; check-in records; interest-form fields (name, email, org, notes); necessary technical logs.',
  'privacy.s2.title': 'Purposes',
  'privacy.s2.body':
    'Provide multi-tenant service; send event-related tickets/notices; support and GTM follow-up; security and abuse prevention.',
  'privacy.s3.title': 'Contact',
  'privacy.s3.body':
    'Privacy questions: use Support or the contact email listed there.',
  'privacy.note':
    'Minimum for ASC/trust — fuller legal text may follow; must not block P0 stub ship.',
  'support.title': 'Support',
  'support.lead': 'Support for organizers and agencies using Vemoki.',
  'support.email.label': 'Email',
  'support.email.value': 'support@vemoki.com',
  'support.sla':
    'We reply on business days (UTC+7), typically within 1–2 business days.',
  'support.app': 'Product sign-in',
  'support.sales': 'Back to sales',
  'support.guest': 'Guests with invite codes: redeem in the app',
  'hero.visual.label': 'Gate · QR · audit',
  'hero.visual.meta': 'Product atmosphere — not a card collage',
  'interest.role.placeholder': 'Select a role',
  'interest.consent.privacy': 'Privacy',
};

const DICTS: Record<MarketingLocale, Record<CopyKey, string>> = {
  vi: VI,
  en: EN,
};

export function t(locale: MarketingLocale, key: CopyKey): string {
  return DICTS[locale][key];
}

export function allCopyValues(locale: MarketingLocale): string[] {
  return Object.values(DICTS[locale]);
}

/**
 * Product claims forbidden on the sales page (AC-6 / copy review).
 * Negations like “Không thanh toán trên form” / “No payment on this form” are allowed.
 */
export const FORBIDDEN_COPY_PATTERNS: RegExp[] = [
  /(?<!không\s)thanh toán/i,
  /\bphí bán vé\b/i,
  /\brefund\b/i,
  /\bseat map\b/i,
  /\bapple wallet\b/i,
  /\bgoogle wallet\b/i,
  /\bandroid app\b/i,
  /\breal-time tuyệt đối\b/i,
  /#1 marketplace/i,
  /(?<!no\s)payment\b/i,
];
