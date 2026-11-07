import type { GateScanStatusKind } from './gate-scan-status-ui.ts';

export function scanDecisionCopy(kind: GateScanStatusKind): {
  eyebrow: string;
  guidance: string;
} {
  switch (kind) {
    case 'processing':
    case 'holding':
    case 'confirming':
      return {
        eyebrow: 'ĐANG XỬ LÝ',
        guidance: 'Không nhận mã mới khi lượt này chưa có kết quả.',
      };
    case 'admitted':
      return {
        eyebrow: 'ĐÃ GHI NHẬN CHECK-IN',
        guidance: 'Chỉ trạng thái này cho phép khách qua cổng.',
      };
    case 'already-checked-in':
      return {
        eyebrow: 'VÉ ĐÃ SỬ DỤNG',
        guidance: 'Vé đã được dùng trước đó. Không cho khách qua.',
      };
    case 'denied':
      return {
        eyebrow: 'VÉ KHÔNG HỢP LỆ CHO LƯỢT NÀY',
        guidance: 'Không cho khách qua. Kiểm tra lý do hiển thị ở trên.',
      };
    case 'queued':
      return {
        eyebrow: 'LƯU TRÊN MÁY',
        guidance: 'Chưa xác nhận vào cổng. Chờ đồng bộ với máy chủ.',
      };
    case 'unknown':
    case 'recorded':
      return {
        eyebrow: 'CHƯA CÓ XÁC NHẬN',
        guidance: 'Không cho khách qua khi kết quả chưa rõ.',
      };
    default:
      return { eyebrow: '', guidance: '' };
  }
}
