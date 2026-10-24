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
  | 'nav.features'
  | 'nav.how'
  | 'nav.solutions'
  | 'nav.faq'
  | 'nav.locale.vi'
  | 'nav.locale.en'
  | 'nav.locale.label'
  | 'nav.menu.open'
  | 'nav.menu.close'
  | 'nav.menu.label'
  | 'skip'
  | 'badge.demo'
  | 'footer.attendee'
  | 'footer.tagline'
  | 'hero.eyebrow'
  | 'hero.headline'
  | 'hero.sub'
  | 'hero.proof1'
  | 'hero.proof2'
  | 'hero.proof3'
  | 'hero.proofs.label'
  | 'hero.preview.alt'
  | 'hero.preview.caption'
  | 'hero.preview.tabs_label'
  | 'hero.preview.tab.wallet'
  | 'hero.preview.tab.gate'
  | 'hero.preview.url.wallet'
  | 'hero.preview.url.gate'
  | 'hero.preview.nav.wallet'
  | 'hero.preview.nav.gate'
  | 'hero.preview.wallet.title'
  | 'hero.preview.wallet.sub'
  | 'hero.preview.ticket.unused'
  | 'hero.preview.event.river'
  | 'hero.preview.gate.hint'
  | 'hero.preview.gate.ok'
  | 'hero.preview.gate.dup'
  | 'hero.preview.gate.event'
  | 'hero.preview.phone.meta'
  | 'hero.marquee'
  | 'hero.cta.demo'
  | 'hero.cta.interest'
  | 'hero.cta.login'
  | 'hero.login_prefix'
  | 'hero.demo_note'
  | 'hero.media.alt'
  | 'hero.media.caption'
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
  | 'whitelabel.point1.body'
  | 'whitelabel.point2'
  | 'whitelabel.point2.body'
  | 'whitelabel.point3'
  | 'whitelabel.point3.body'
  | 'trust.title'
  | 'trust.lead'
  | 'trust.p1.title'
  | 'trust.p1.body'
  | 'trust.p2.title'
  | 'trust.p2.body'
  | 'trust.p3.title'
  | 'trust.p3.body'
  | 'trust.p4.title'
  | 'trust.p4.body'
  | 'trust.p5.title'
  | 'trust.p5.body'
  | 'bento.title'
  | 'bento.lead'
  | 'bento.invite.title'
  | 'bento.invite.body'
  | 'bento.invite.alt'
  | 'bento.qr.title'
  | 'bento.qr.body'
  | 'bento.qr.alt'
  | 'bento.gate.title'
  | 'bento.gate.body'
  | 'bento.gate.alt'
  | 'bento.offline.title'
  | 'bento.offline.body'
  | 'bento.offline.alt'
  | 'bento.admin.title'
  | 'bento.admin.body'
  | 'bento.admin.alt'
  | 'bento.whitelabel.title'
  | 'bento.whitelabel.body'
  | 'bento.whitelabel.alt'
  | 'bento.ops.title'
  | 'bento.ops.body'
  | 'bento.ops.alt'
  | 'outcomes.title'
  | 'outcomes.disclaimer'
  | 'outcomes.lead'
  | 'outcomes.metric1.label'
  | 'outcomes.metric1.value'
  | 'outcomes.metric2.label'
  | 'outcomes.metric2.value'
  | 'outcomes.metric3.label'
  | 'outcomes.metric3.value'
  | 'outcomes.chart.caption'
  | 'faq.title'
  | 'demo.title'
  | 'demo.lead'
  | 'demo.cta'
  | 'interest.title'
  | 'interest.lead'
  | 'interest.name'
  | 'interest.email'
  | 'interest.org'
  | 'interest.role'
  | 'interest.role.owner'
  | 'interest.role.agency'
  | 'interest.role.other'
  | 'interest.org_kind'
  | 'interest.org_kind.agency'
  | 'interest.org_kind.brand_enterprise'
  | 'interest.org_kind.venue'
  | 'interest.org_kind.independent'
  | 'interest.org_kind.other'
  | 'interest.org_kind.placeholder'
  | 'interest.events_per_year'
  | 'interest.events_per_year.0'
  | 'interest.events_per_year.1-5'
  | 'interest.events_per_year.6-20'
  | 'interest.events_per_year.21+'
  | 'interest.events_per_year.placeholder'
  | 'interest.typical_scale'
  | 'interest.typical_scale.under_500'
  | 'interest.typical_scale.500_2000'
  | 'interest.typical_scale.2000_10000'
  | 'interest.typical_scale.over_10000'
  | 'interest.typical_scale.placeholder'
  | 'interest.note'
  | 'interest.consent'
  | 'interest.consent.before'
  | 'interest.submit'
  | 'interest.secondary_demo'
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
  | 'privacy.title'
  | 'privacy.updated'
  | 'privacy.intro'
  | 'privacy.s1.title'
  | 'privacy.s1.body'
  | 'privacy.s2.title'
  | 'privacy.s2.body'
  | 'privacy.s3.title'
  | 'privacy.s3.body'
  | 'privacy.s4.title'
  | 'privacy.s4.body'
  | 'privacy.s5.title'
  | 'privacy.s5.body'
  | 'privacy.s6.title'
  | 'privacy.s6.body'
  | 'privacy.s7.title'
  | 'privacy.s7.body'
  | 'privacy.note'
  | 'support.title'
  | 'support.lead'
  | 'support.email.label'
  | 'support.email.value'
  | 'support.sla'
  | 'support.app'
  | 'support.sales'
  | 'support.guest'
  | 'interest.role.placeholder'
  | 'interest.consent.privacy';

const VI: Record<CopyKey, string> = {
  'meta.title': 'Vemoki — Hệ điều hành sự kiện trực tiếp',
  'meta.description':
    'Event Operating System multi-tenant cho agency và doanh nghiệp sự kiện: mã mời, QR, cổng có audit — không marketplace.',
  'nav.brand': 'vemoki',
  'nav.demo': 'Xem demo',
  'nav.interest': 'Đăng ký quan tâm',
  'nav.login': 'Đăng nhập',
  'nav.privacy': 'Quyền riêng tư',
  'nav.support': 'Hỗ trợ',
  'nav.features': 'Tính năng',
  'nav.how': 'Cách hoạt động',
  'nav.solutions': 'Giải pháp',
  'nav.faq': 'Câu hỏi thường gặp',
  'nav.locale.vi': 'VI',
  'nav.locale.en': 'EN',
  'nav.locale.label': 'Ngôn ngữ',
  'nav.menu.open': 'Menu',
  'nav.menu.close': 'Đóng',
  'nav.menu.label': 'Menu điều hướng',
  skip: 'Bỏ qua nội dung',
  'badge.demo': 'Demo giả lập',
  'footer.attendee': 'Bạn có mã mời? Đổi vé trên ứng dụng',
  'footer.tagline': 'vemoki↗ · Event Operating System',
  'hero.eyebrow': 'Dành cho nhà tổ chức sự kiện',
  'hero.headline': 'Vận hành sự kiện từ mã mời đến cổng.',
  'hero.sub':
    'Phát mã mời, quản lý vé và kiểm soát cổng trong cùng một hệ thống. Khách tham dự nhìn thấy thương hiệu của bạn.',
  'hero.proof1': 'Mã mời → đổi vé → QR ký theo sự kiện',
  'hero.proof2': 'Cổng chống trùng + audit',
  'hero.proof3': 'Tách tenant + RLS + deny-by-default',
  'hero.proofs.label': 'Điểm mạnh sản phẩm',
  'hero.preview.alt':
    'Màn hình đổi mã vé trong ứng dụng Vemoki (môi trường pilot)',
  'hero.preview.caption':
    'UI composition có nhãn Demo — không dữ liệu khách thật.',
  'hero.preview.tabs_label': 'Xem trước sản phẩm',
  'hero.preview.tab.wallet': 'Vé & ví',
  'hero.preview.tab.gate': 'Staff iOS',
  'hero.preview.url.wallet': 'app.vemoki.com/wallet',
  'hero.preview.url.gate': 'Vemoki Staff · iOS',
  'hero.preview.nav.wallet': 'Vé của tôi',
  'hero.preview.nav.gate': 'Cổng · Staff iOS',
  'hero.preview.wallet.title': 'Vé của tôi',
  'hero.preview.wallet.sub': '3 vé · 2 sự kiện (demo)',
  'hero.preview.ticket.unused': 'Chưa sử dụng',
  'hero.preview.event.river': 'Đêm nhạc bên sông',
  'hero.preview.gate.hint': 'Nhân sự cổng quét trên app Staff (iPhone)',
  'hero.preview.gate.ok': 'Quét hợp lệ · audit ghi nhận',
  'hero.preview.gate.dup': 'Chống trùng: bật',
  'hero.preview.gate.event': 'Sự kiện: MFest (fixture)',
  'hero.preview.phone.meta': 'Vé phổ thông · Cổng A',
  'hero.marquee': 'EOS · Invite → QR → Gate ·',
  'hero.cta.demo': 'Xem sản phẩm',
  'hero.cta.interest': 'Trao đổi nhu cầu',
  'hero.cta.login': 'Đăng nhập',
  'hero.login_prefix': 'Đã có tài khoản?',
  'hero.demo_note': 'Demo giả lập — không phải khách hàng thật.',
  'hero.media.alt': 'Ảnh chụp trang Khám phá Vemoki với các sự kiện demo',
  'hero.media.caption': 'Trang Khám phá · ảnh chụp sản phẩm thật, dữ liệu demo',
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
  'whitelabel.point1.body':
    'Guest surface lấy asset và palette theo event đã publish — không skin-only một màu.',
  'whitelabel.point2': 'Ba lớp brand: platform · org · event',
  'whitelabel.point2.body':
    'Marketing/account/IdP giữ Vemoki; org và event không lẫn chrome platform sai ngữ cảnh.',
  'whitelabel.point3': 'Agency chạy nhiều client trên cùng platform',
  'whitelabel.point3.body':
    'Membership nhiều tenant — không fork code per-client.',
  'trust.title': 'Tin cậy cho vận hành cổng thật',
  'trust.lead':
    'Thiết kế cho sự kiện trực tiếp — không dashboard «ảo real-time».',
  'trust.p1.title': 'Tách tenant',
  'trust.p1.body':
    'PostgreSQL shared schema + RLS và phân quyền deny-by-default theo tenant.',
  'trust.p2.title': 'Cổng chống trùng',
  'trust.p2.body':
    'Check-in ghi audit; QR ký theo sự kiện; thu hồi vé vô hiệu mã cũ.',
  'trust.p3.title': 'Cổng khi mạng yếu',
  'trust.p3.body':
    'D7: luồng cổng multi-device có thiết kế offline — không hứa «luôn online 100%».',
  'trust.p4.title': 'Số liệu trung thực',
  'trust.p4.body':
    'Dashboard ops kèm mốc cập nhật lúc; pilot mục tiêu trễ ≤10s — không «tức thì tuyệt đối».',
  'trust.p5.title': 'Bảo mật vận hành',
  'trust.p5.body':
    'TLS, rate limit, MFA admin, log không chứa token QR/OTP thô.',
  'bento.title': 'Năng lực vận hành trong một hệ',
  'bento.lead':
    'Mỗi khối là luồng thật trong sản phẩm — không slide «tương lai».',
  'bento.invite.title': 'Mã mời → vé',
  'bento.invite.body':
    'Nguồn mã, quota, đổi mã có xác minh email.',
  'bento.invite.alt':
    'Màn hình đổi mã vé trong ứng dụng Vemoki (môi trường pilot)',
  'bento.qr.title': 'Vé & QR ký',
  'bento.qr.body':
    'Token ký theo sự kiện; không nhúng PII trong QR.',
  'bento.qr.alt':
    'Màn hình vé và mã QR trong ứng dụng Vemoki (môi trường pilot)',
  'bento.gate.title': 'Cổng & audit',
  'bento.gate.body':
    'Quét trên app Staff iOS; chống trùng; log staff/device và audit.',
  'bento.gate.alt':
    'Màn hình quét cổng Staff iOS trong ứng dụng Vemoki (môi trường pilot)',
  'bento.offline.title': 'Cổng multi-device',
  'bento.offline.body':
    'Thiết kế offline D7; vé xem offline trên app.',
  'bento.offline.alt':
    'Màn hình cổng trên điện thoại trong ứng dụng Vemoki (môi trường pilot)',
  'bento.admin.title': 'Quản trị sự kiện',
  'bento.admin.body':
    'Sự kiện, loại vé, import khách, email vé.',
  'bento.admin.alt':
    'Màn hình quản trị sự kiện trong ứng dụng Vemoki (môi trường pilot)',
  'bento.whitelabel.title': 'White-label khách',
  'bento.whitelabel.body':
    'Brand org/event trên trang khách; platform ở marketing/IdP.',
  'bento.whitelabel.alt':
    'Trang chi tiết sự kiện với thương hiệu tổ chức trong ứng dụng Vemoki (môi trường pilot)',
  'bento.ops.title': 'Ops & báo cáo',
  'bento.ops.body':
    'Dashboard gần real-time pilot; báo cáo có định nghĩa chỉ số.',
  'bento.ops.alt':
    'Màn hình báo cáo vận hành trong ứng dụng Vemoki (môi trường pilot)',
  'outcomes.title': 'Kết quả vận hành (minh họa)',
  'outcomes.disclaimer':
    'Minh hoạ — dữ liệu mô phỏng, không phải khách hàng thật.',
  'outcomes.lead':
    'Số dưới đây giải thích loại chỉ số bạn theo dõi trong pilot — không phải benchmark đã ký hợp đồng.',
  'outcomes.metric1.label': 'Thời gian xử lý check-in (p50)',
  'outcomes.metric1.value': '~1,2 giây',
  'outcomes.metric2.label': 'Lượt quét trùng bị chặn (phiên demo)',
  'outcomes.metric2.value': '14',
  'outcomes.metric3.label': 'Vé đã cấp / cổng mở (fixture)',
  'outcomes.metric3.value': '1.240 / 3',
  'outcomes.chart.caption':
    'Biểu đồ minh họa luồng vào cổng theo giờ — dữ liệu giả lập.',
  'faq.title': 'Câu hỏi thường gặp',
  'demo.title': 'Khám phá bản demo',
  'demo.lead':
    'Dữ liệu minh họa để trải nghiệm sản phẩm, không phải sự kiện hay khách hàng thật.',
  'demo.cta': 'Mở demo trên ứng dụng',
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
  'interest.org_kind': 'Loại tổ chức (không bắt buộc)',
  'interest.org_kind.agency': 'Agency sự kiện',
  'interest.org_kind.brand_enterprise': 'Thương hiệu / doanh nghiệp',
  'interest.org_kind.venue': 'Địa điểm / venue',
  'interest.org_kind.independent': 'Độc lập / freelancer',
  'interest.org_kind.other': 'Khác',
  'interest.org_kind.placeholder': 'Chọn loại tổ chức',
  'interest.events_per_year': 'Số sự kiện/năm (ước lượng, không bắt buộc)',
  'interest.events_per_year.0': '0',
  'interest.events_per_year.1-5': '1–5',
  'interest.events_per_year.6-20': '6–20',
  'interest.events_per_year.21+': '21+',
  'interest.events_per_year.placeholder': 'Chọn khoảng',
  'interest.typical_scale': 'Quy mô điển hình (không bắt buộc)',
  'interest.typical_scale.under_500': 'Dưới 500 khách',
  'interest.typical_scale.500_2000': '500–2.000',
  'interest.typical_scale.2000_10000': '2.000–10.000',
  'interest.typical_scale.over_10000': 'Trên 10.000',
  'interest.typical_scale.placeholder': 'Chọn quy mô',
  'interest.note': 'Ghi chú (không bắt buộc)',
  'interest.consent': 'Tôi đồng ý được liên hệ về Vemoki. Xem Quyền riêng tư.',
  'interest.consent.before': 'Tôi đồng ý được liên hệ về Vemoki. Xem',
  'interest.submit': 'Gửi đăng ký',
  'interest.secondary_demo': 'Hoặc xem demo',
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
  'privacy.title': 'Quyền riêng tư',
  'privacy.updated': 'Cập nhật: 2026-10-18',
  'privacy.intro':
    'Vemoki (`vemoki.com`) xử lý dữ liệu cần thiết để vận hành nền tảng sự kiện và trả lời đăng ký quan tâm. Thời gian lưu giữ, vùng dữ liệu và mức hỗ trợ dưới đây là chính sách hiện hành cho bản MVP.',
  'privacy.s1.title': 'Dữ liệu chúng tôi thu',
  'privacy.s1.body':
    'Tài khoản / phiên đăng nhập (email, mã định danh từ nhà cung cấp đăng nhập Keycloak / user ID); thông tin sự kiện và mã/vé / nội dung QR hiển thị; dữ liệu check-in; mã thiết bị nhận thông báo đẩy (Apple Push) khi bật thông báo; form quan tâm hoặc form sự kiện (tên, email, tổ chức, vai trò, loại tổ chức/quy mô sự kiện nếu bạn chọn điền, điện thoại nếu sự kiện yêu cầu); nhật ký kỹ thuật cần thiết (IP, trình duyệt, thời gian). Không bán dữ liệu; MVP không dùng SDK quảng cáo / theo dõi xuyên app.',
  'privacy.s2.title': 'Mục đích',
  'privacy.s2.body':
    'Xác thực và phân quyền; cấp / hiển thị / xác thực vé; gửi thông báo giao dịch (email và, nếu bật, thông báo đẩy); hỗ trợ và theo dõi bán hàng; bảo mật, nhật ký kiểm toán và chống lạm dụng; tiếp nhận yêu cầu xóa tài khoản như mô tả bên dưới.',
  'privacy.s3.title': 'Máy ảnh và thông báo',
  'privacy.s3.body':
    'Máy ảnh (app iOS Gate): quét mã QR vé trên thiết bị tại cổng cho nhân sự được cấp quyền. Quét realtime trên thiết bị — mặc định không lưu ảnh vào thư viện và không tải ảnh quét lên máy chủ. Thông báo: tùy chọn; dùng cho cập nhật giao vé / nhắc sự kiện; có thể tắt trong Cài đặt iOS.',
  'privacy.s4.title': 'Lưu giữ',
  'privacy.s4.body':
    'Yêu cầu xóa tài khoản: xử lý xóa hoặc ẩn danh dữ liệu cá nhân liên quan trong ≤ 30 ngày (không xóa ngay lập tức — giữ đối soát khiếu nại theo chính sách). Vé / check-in: giữ 365 ngày rồi xóa hoặc ẩn danh dữ liệu cá nhân, giữ số liệu tổng hợp. Nhật ký kiểm toán: giữ tới 730 ngày. Tệp QR/export: liên kết tải ngắn hạn; tệp hết hạn nghiệp vụ được gỡ trong ≤ 90 ngày. Sao lưu tôn trọng yêu cầu xóa trong cửa sổ phục hồi đã công bố; bộ nhớ tạm trên thiết bị được xóa khi đăng xuất / đổi người dùng.',
  'privacy.s5.title': 'Yêu cầu xóa tài khoản',
  'privacy.s5.body':
    'Người dùng đã đăng nhập: trên web mở Tài khoản (`/account`) hoặc trong app iOS mở Account → «Yêu cầu xóa tài khoản». Khi gửi, yêu cầu đã được tiếp nhận — chưa phải xóa ngay. Chúng tôi xử lý xóa hoặc ẩn danh trong ≤ 30 ngày; nhật ký kiểm toán có thể giữ tới 730 ngày theo chính sách. Không bắt buộc gọi điện hay mở ticket hỗ trợ để khởi tạo yêu cầu.',
  'privacy.s6.title': 'Vùng dữ liệu',
  'privacy.s6.body':
    'Một vùng máy chủ: cơ sở dữ liệu, lưu trữ tệp, Keycloak và email cùng quốc gia với máy chủ. Không tách nhiều vùng trong MVP; quốc gia host ghi trong thỏa thuận xử lý dữ liệu khi có tenant thật.',
  'privacy.s7.title': 'Liên hệ',
  'privacy.s7.body':
    'Câu hỏi quyền riêng tư: trang Hỗ trợ (`/support`) hoặc `support@vemoki.com` / `privacy@vemoki.com` (khi alias sẵn sàng). Liên hệ tạm: hangndat@gmail.com.',
  'privacy.note':
    'Các số liệu trên khớp chính sách hiện hành (18/10/2026). Mục tiêu phục hồi kỹ thuật nội bộ chưa dùng làm cam kết hỗ trợ cho đến khi kiểm tra trên máy chủ đích.',
  'support.title': 'Hỗ trợ',
  'support.lead': 'Hỗ trợ organizer và agency dùng Vemoki. Liên hệ bên dưới cũng dùng cho câu hỏi quyền riêng tư / yêu cầu xóa tài khoản nếu cần.',
  'support.email.label': 'Email',
  'support.email.value': 'support@vemoki.com',
  'support.sla':
    'Ngoài cửa sổ sự kiện: giờ hành chính T2–T6 (giờ VN). Trong cửa sổ Gate/opening: on-call P1 24/7 theo lịch event (P1 ≤ 30 phút; P2 ≤ 4 giờ business / ≤ 1 giờ trong cửa sổ; P3 ≤ 2 ngày làm việc). Không ghi OTP/QR/PII thô vào ticket.',
  'support.app': 'Đăng nhập sản phẩm',
  'support.sales': 'Về trang bán',
  'support.guest': 'Khách có mã mời: đổi vé trên ứng dụng',
  'interest.role.placeholder': 'Chọn vai trò',
  'interest.consent.privacy': 'Quyền riêng tư',
};

const EN: Record<CopyKey, string> = {
  'meta.title': 'Vemoki — In-person Event Operating System',
  'meta.description':
    'Multi-tenant Event Operating System for agencies and enterprise event teams: invites, QR, audited gate — not a marketplace.',
  'nav.brand': 'vemoki',
  'nav.demo': 'View demo',
  'nav.interest': 'Register interest',
  'nav.login': 'Log in',
  'nav.privacy': 'Privacy',
  'nav.support': 'Support',
  'nav.features': 'Features',
  'nav.how': 'How it works',
  'nav.solutions': 'Solutions',
  'nav.faq': 'FAQ',
  'nav.locale.vi': 'VI',
  'nav.locale.en': 'EN',
  'nav.locale.label': 'Language',
  'nav.menu.open': 'Menu',
  'nav.menu.close': 'Close',
  'nav.menu.label': 'Navigation menu',
  skip: 'Skip to content',
  'badge.demo': 'Simulated demo',
  'footer.attendee': 'Have an invite code? Redeem on the app',
  'footer.tagline': 'vemoki↗ · Event Operating System',
  'hero.eyebrow': 'For event organizers',
  'hero.headline': 'Run events from invite to gate.',
  'hero.sub':
    'Send invites, manage tickets, and control the gate in one system. Guests see your brand.',
  'hero.proof1': 'Invite → redeem → event-scoped signed QR',
  'hero.proof2': 'Duplicate-safe gate + audit',
  'hero.proof3': 'Tenant isolation + RLS + deny-by-default',
  'hero.proofs.label': 'Product proof points',
  'hero.preview.alt':
    'Redeem ticket screen in the Vemoki app (pilot environment)',
  'hero.preview.caption':
    'UI composition labeled Demo — no real guest data.',
  'hero.preview.tabs_label': 'Product preview',
  'hero.preview.tab.wallet': 'Tickets & wallet',
  'hero.preview.tab.gate': 'Staff iOS',
  'hero.preview.url.wallet': 'app.vemoki.com/wallet',
  'hero.preview.url.gate': 'Vemoki Staff · iOS',
  'hero.preview.nav.wallet': 'My tickets',
  'hero.preview.nav.gate': 'Gate · Staff iOS',
  'hero.preview.wallet.title': 'My tickets',
  'hero.preview.wallet.sub': '3 tickets · 2 events (demo)',
  'hero.preview.ticket.unused': 'Unused',
  'hero.preview.event.river': 'Riverside night',
  'hero.preview.gate.hint': 'Gate staff scan with the Staff app on iPhone',
  'hero.preview.gate.ok': 'Valid scan · audit recorded',
  'hero.preview.gate.dup': 'Duplicate block: on',
  'hero.preview.gate.event': 'Event: MFest (fixture)',
  'hero.preview.phone.meta': 'General · Gate A',
  'hero.marquee': 'EOS · Invite → QR → Gate ·',
  'hero.cta.demo': 'Explore the product',
  'hero.cta.interest': 'Discuss your needs',
  'hero.cta.login': 'Log in',
  'hero.login_prefix': 'Already have an account?',
  'hero.demo_note': 'Simulated demo — not a real customer.',
  'hero.media.alt': 'Screenshot of the Vemoki Discover page with demo events',
  'hero.media.caption': 'Discover page · real product screenshot, demo data',
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
  'whitelabel.point1.body':
    'Guest surfaces use published event assets and palette — not a one-color skin.',
  'whitelabel.point2': 'Three brand layers: platform · org · event',
  'whitelabel.point2.body':
    'Marketing/account/IdP stay Vemoki; org and event never fall back to the wrong platform chrome.',
  'whitelabel.point3': 'Agencies run many clients on one platform',
  'whitelabel.point3.body':
    'Multi-tenant membership — no per-client code forks.',
  'trust.title': 'Built for real gate operations',
  'trust.lead':
    'Designed for in-person events — not vanity real-time dashboards.',
  'trust.p1.title': 'Tenant isolation',
  'trust.p1.body':
    'Shared PostgreSQL with RLS and deny-by-default tenant authz.',
  'trust.p2.title': 'Duplicate-safe admission',
  'trust.p2.body':
    'Audited check-in; event-scoped signed QR; revocation rotates tokens.',
  'trust.p3.title': 'Gate when connectivity is limited',
  'trust.p3.body':
    'D7: multi-device gate designed for limited connectivity — not «100% online only».',
  'trust.p4.title': 'Honest metrics',
  'trust.p4.body':
    'Ops views show an as-of time; pilot target latency ≤10s — not absolute instant.',
  'trust.p5.title': 'Security baseline',
  'trust.p5.body':
    'TLS, rate limits, admin MFA, logs exclude raw QR/OTP tokens.',
  'bento.title': 'Operations capabilities in one system',
  'bento.lead':
    'Each tile is a real product flow — not a future roadmap slide.',
  'bento.invite.title': 'Invite → ticket',
  'bento.invite.body':
    'Code sources, quotas, redeem with verified email.',
  'bento.invite.alt':
    'Redeem ticket screen in the Vemoki app (pilot environment)',
  'bento.qr.title': 'Signed QR tickets',
  'bento.qr.body':
    'Event-scoped signed tokens; no PII in QR payload.',
  'bento.qr.alt':
    'Wallet ticket and QR screen in the Vemoki app (pilot environment)',
  'bento.gate.title': 'Gate & audit',
  'bento.gate.body':
    'Scan on the Staff iOS app; duplicate block; staff/device audit trail.',
  'bento.gate.alt':
    'Staff iOS gate scan screen in the Vemoki app (pilot environment)',
  'bento.offline.title': 'Multi-device gate',
  'bento.offline.body':
    'D7 offline gate design; ticket display offline in app.',
  'bento.offline.alt':
    'Mobile gate screen in the Vemoki app (pilot environment)',
  'bento.admin.title': 'Event administration',
  'bento.admin.body':
    'Events, ticket types, guest import, ticket email.',
  'bento.admin.alt':
    'Event admin screen in the Vemoki app (pilot environment)',
  'bento.whitelabel.title': 'Guest white-label',
  'bento.whitelabel.body':
    'Org/event brand on guest surfaces; platform on marketing/IdP.',
  'bento.whitelabel.alt':
    'Branded event detail page in the Vemoki app (pilot environment)',
  'bento.ops.title': 'Ops reporting',
  'bento.ops.body':
    'Near real-time pilot dashboard; defined metrics in reports.',
  'bento.ops.alt':
    'Operations reporting screen in the Vemoki app (pilot environment)',
  'outcomes.title': 'Operational outcomes (illustration)',
  'outcomes.disclaimer':
    'Illustration — simulated data, not real customers.',
  'outcomes.lead':
    'Figures below show the kinds of metrics you track in pilot — not contracted benchmarks.',
  'outcomes.metric1.label': 'Check-in handling time (p50)',
  'outcomes.metric1.value': '~1.2s',
  'outcomes.metric2.label': 'Duplicate scans blocked (demo session)',
  'outcomes.metric2.value': '14',
  'outcomes.metric3.label': 'Tickets issued / gates open (fixture)',
  'outcomes.metric3.value': '1,240 / 3',
  'outcomes.chart.caption':
    'Illustrative hourly entry chart — simulated data.',
  'faq.title': 'Frequently asked questions',
  'demo.title': 'Explore the demo',
  'demo.lead':
    'Try the product with sample data, not real events or customers.',
  'demo.cta': 'Open demo in the app',
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
  'interest.org_kind': 'Organization type (optional)',
  'interest.org_kind.agency': 'Event agency',
  'interest.org_kind.brand_enterprise': 'Brand / enterprise',
  'interest.org_kind.venue': 'Venue',
  'interest.org_kind.independent': 'Independent / freelancer',
  'interest.org_kind.other': 'Other',
  'interest.org_kind.placeholder': 'Select organization type',
  'interest.events_per_year': 'Events per year (estimate, optional)',
  'interest.events_per_year.0': '0',
  'interest.events_per_year.1-5': '1–5',
  'interest.events_per_year.6-20': '6–20',
  'interest.events_per_year.21+': '21+',
  'interest.events_per_year.placeholder': 'Select range',
  'interest.typical_scale': 'Typical event size (optional)',
  'interest.typical_scale.under_500': 'Under 500 attendees',
  'interest.typical_scale.500_2000': '500–2,000',
  'interest.typical_scale.2000_10000': '2,000–10,000',
  'interest.typical_scale.over_10000': 'Over 10,000',
  'interest.typical_scale.placeholder': 'Select size band',
  'interest.note': 'Notes (optional)',
  'interest.consent':
    'I agree to be contacted about Vemoki. See Privacy.',
  'interest.consent.before': 'I agree to be contacted about Vemoki. See',
  'interest.submit': 'Submit',
  'interest.secondary_demo': 'Or view demo',
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
  'privacy.title': 'Privacy',
  'privacy.updated': 'Updated: 2026-10-18',
  'privacy.intro':
    'Vemoki (`vemoki.com`) processes data needed to run the event platform and respond to interest registrations. Retention, residency, and support figures below are the current MVP policy.',
  'privacy.s1.title': 'Data we collect',
  'privacy.s1.body':
    'Account / session identifiers (email, login provider Keycloak identifier / user ID); event and code/ticket data / display QR contents; check-in records; device push tokens (Apple Push) when notifications are enabled; interest or event form fields (name, email, organization, role, optional organization type/event scale if you provide them, phone if the event requires them); necessary technical logs (IP, browser, timestamps). We do not sell personal data; the MVP does not use advertising SDKs or cross-app tracking.',
  'privacy.s2.title': 'Purposes',
  'privacy.s2.body':
    'Authenticate and authorize; issue / display / validate tickets; send transactional notices (email and, if enabled, push notifications); support and sales follow-up; security, audit logs, and abuse prevention; honor account-deletion requests as described below.',
  'privacy.s3.title': 'Camera and notifications',
  'privacy.s3.body':
    'Camera (iOS Gate app): on-device scanning of ticket QR codes at the gate for authorized staff. Scanning is realtime on-device — by default we do not save photos to the library and do not upload scan images to our servers. Notifications: optional; used for ticket-delivery updates and event reminders; disable in iOS Settings.',
  'privacy.s4.title': 'Retention',
  'privacy.s4.body':
    'Account deletion requests: we delete or de-identify related personal data within ≤ 30 days (not immediate erasure — we keep records needed for complaint handling under policy). Tickets / check-in: keep 365 days then delete or de-identify personal data; keep aggregates. Audit logs: retained up to 730 days. QR/export files: short-lived download links; files past business expiry are removed within ≤ 90 days. Backups respect deletion within the published recovery window; on-device caches clear on logout / user switch.',
  'privacy.s5.title': 'Account deletion requests',
  'privacy.s5.body':
    'Signed-in users: on the web open Account (`/account`), or in the iOS app open Account → “Request account deletion” / «Yêu cầu xóa tài khoản». When you submit, the request has been received — that is not immediate erasure. We process deletion or de-identification within ≤ 30 days; audit logs may remain up to 730 days under policy. You do not need a phone call or support ticket to start a request.',
  'privacy.s6.title': 'Data residency',
  'privacy.s6.body':
    'Single-region hosting: database, file storage, Keycloak, and email in the same country as the host. No multi-region split in MVP; host country is recorded in the data processing agreement when a real tenant onboard.',
  'privacy.s7.title': 'Contact',
  'privacy.s7.body':
    'Privacy questions: Support (`/support`) or `support@vemoki.com` / `privacy@vemoki.com` (when the alias is ready). Interim contact: hangndat@gmail.com.',
  'privacy.note':
    'Figures match current policy (2026-10-18). Internal technical recovery targets are not published as support commitments until verified on the target host.',
  'support.title': 'Support',
  'support.lead': 'Support for organizers and agencies using Vemoki. Use the contact below for privacy questions or account-deletion follow-up if needed.',
  'support.email.label': 'Email',
  'support.email.value': 'support@vemoki.com',
  'support.sla':
    'Outside event windows: business hours Mon–Fri (Vietnam time). During Gate/opening windows: on-call P1 24/7 per event schedule (P1 ≤ 30 minutes; P2 ≤ 4 hours business / ≤ 1 hour in-window; P3 ≤ 2 business days). Do not log raw OTP/QR/PII in tickets.',
  'support.app': 'Product sign-in',
  'support.sales': 'Back to sales',
  'support.guest': 'Guests with invite codes: redeem in the app',
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
