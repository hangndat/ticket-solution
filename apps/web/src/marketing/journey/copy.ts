import type { MarketingLocale } from '../hosts';

/** Cinematic ticket journey copy — kept beside the module so the sales dictionary stays untouched. */
export type JourneyChapterId = 'invitation' | 'arrival' | 'gateway' | 'moment';

type JourneyCopy = {
  metaTitle: string;
  metaDescription: string;
  chapters: Record<
    JourneyChapterId,
    { index: string; label: string; title: string; body: string }
  >;
  brandTitle: string;
  brandBody: string;
  ticket: { event: string; date: string; gate: string; holder: string; admit: string };
  scanOk: string;
  scrollHint: string;
};

const VI: JourneyCopy = {
  metaTitle: 'Hành trình một tấm vé',
  metaDescription:
    'Theo chân một tấm vé điện tử từ lời mời, check-in tại cổng đến khoảnh khắc trên sân khấu — vận hành bởi Vemoki.',
  chapters: {
    invitation: {
      index: '01',
      label: 'Lời mời',
      title: 'Tấm vé tìm đến bạn.',
      body: 'Phát hành, gửi và lưu trong ví — một tấm vé điện tử duy nhất, an toàn từ giây đầu tiên.',
    },
    arrival: {
      index: '02',
      label: 'Đến nơi',
      title: 'Đêm hội đang chờ.',
      body: 'Không xếp hàng in vé. Tấm vé đi cùng bạn trên con đường dẫn đến ánh đèn.',
    },
    gateway: {
      index: '03',
      label: 'Cửa vào',
      title: 'Một lần quét. Cổng mở.',
      body: 'Mã QR được xác thực ngay tại cổng — kể cả khi mạng chập chờn.',
    },
    moment: {
      index: '04',
      label: 'Khoảnh khắc',
      title: 'Bạn đã ở đây.',
      body: 'Phần còn lại là âm nhạc.',
    },
  },
  brandTitle: 'Từ tấm vé đến khoảnh khắc.',
  brandBody: 'Vemoki vận hành vé, check-in và trải nghiệm khán giả cho sự kiện của bạn.',
  ticket: {
    event: 'Lumen Night',
    date: 'Sat · 21:00',
    gate: 'Gate A',
    holder: 'General Admission',
    admit: 'Admit one',
  },
  scanOk: 'Hợp lệ',
  scrollHint: 'Cuộn để bắt đầu',
};

const EN: JourneyCopy = {
  metaTitle: 'The journey of a ticket',
  metaDescription:
    'Follow a digital ticket from invitation through gate check-in to the moment on the main stage — powered by Vemoki.',
  chapters: {
    invitation: {
      index: '01',
      label: 'Invitation',
      title: 'Your ticket finds you.',
      body: 'Issued, delivered and kept in the wallet — one secure digital ticket from the very first second.',
    },
    arrival: {
      index: '02',
      label: 'Arrival',
      title: 'The night is waiting.',
      body: 'No print queues. Your ticket walks with you down the path toward the lights.',
    },
    gateway: {
      index: '03',
      label: 'Gateway',
      title: 'One scan. The gate opens.',
      body: 'The QR code is verified right at the gate — even when the network is not.',
    },
    moment: {
      index: '04',
      label: 'The Moment',
      title: 'You’re in.',
      body: 'The rest is music.',
    },
  },
  brandTitle: 'From ticket to moment.',
  brandBody: 'Vemoki runs ticketing, check-in and the attendee experience for your event.',
  ticket: VI.ticket,
  scanOk: 'Verified',
  scrollHint: 'Scroll to begin',
};

export function journeyCopy(locale: MarketingLocale): JourneyCopy {
  return locale === 'en' ? EN : VI;
}

export type { JourneyCopy };
