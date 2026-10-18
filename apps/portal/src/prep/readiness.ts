/**
 * Client-side publish readiness from known portal UI state.
 * Unknown stays unknown — never fake OK. Publish ≠ redeem ≠ Gate.
 */

export type PrepReadinessKey =
  | 'types'
  | 'sources'
  | 'quota'
  | 'form'
  | 'brand';

export type PrepReadinessStatus = 'ok' | 'missing' | 'unknown';

export type PrepReadinessItem = {
  key: PrepReadinessKey;
  label: string;
  status: PrepReadinessStatus;
  detail: string;
};

export type PrepReadinessInput = {
  hasEventContext: boolean;
  hasTicketType: boolean;
  hasSource: boolean;
  quotaKnown: boolean;
  quotaCapacity: number | null;
  hasTermsOrPublished: boolean;
  hasBrand: boolean;
};

const LABELS: Record<PrepReadinessKey, string> = {
  types: 'Loại vé',
  sources: 'Nguồn mã',
  quota: 'Hạn mức',
  form: 'Biểu mẫu / điều khoản',
  brand: 'Nhận diện tối thiểu',
};

export function derivePrepReadiness(
  input: PrepReadinessInput,
): PrepReadinessItem[] {
  if (!input.hasEventContext) {
    return (Object.keys(LABELS) as PrepReadinessKey[]).map((key) => ({
      key,
      label: LABELS[key],
      status: 'unknown' as const,
      detail: 'Chưa chọn sự kiện — chưa đánh giá sẵn sàng.',
    }));
  }

  let quotaStatus: PrepReadinessStatus = 'unknown';
  let quotaDetail = 'Chưa đọc hạn mức — chưa xác định.';
  if (input.quotaKnown) {
    quotaStatus = 'ok';
    quotaDetail =
      input.quotaCapacity === null
        ? 'Không giới hạn (capacity null).'
        : `Đã cấu hình capacity ${input.quotaCapacity}.`;
  }

  return [
    {
      key: 'types',
      label: LABELS.types,
      status: input.hasTicketType ? 'ok' : 'missing',
      detail: input.hasTicketType
        ? 'Đã có loại vé trong danh mục.'
        : 'Thiếu loại vé — tạo ticket type.',
    },
    {
      key: 'sources',
      label: LABELS.sources,
      status: input.hasSource ? 'ok' : 'missing',
      detail: input.hasSource
        ? 'Đã có nguồn mã trong danh mục.'
        : 'Thiếu nguồn mã — tạo source.',
    },
    {
      key: 'quota',
      label: LABELS.quota,
      status: quotaStatus,
      detail: quotaDetail,
    },
    {
      key: 'form',
      label: LABELS.form,
      status: input.hasTermsOrPublished ? 'ok' : 'missing',
      detail: input.hasTermsOrPublished
        ? 'Điều khoản/draft hoặc đã publish cấu hình.'
        : 'Thiếu điều khoản hoặc chưa publish cấu hình.',
    },
    {
      key: 'brand',
      label: LABELS.brand,
      status: input.hasBrand ? 'ok' : 'missing',
      detail: input.hasBrand
        ? 'Đã có tên tổ chức và màu nhận diện.'
        : 'Thiếu tên tổ chức hoặc màu nhận diện tối thiểu.',
    },
  ];
}

export function readinessAllOk(items: PrepReadinessItem[]): boolean {
  return items.every((i) => i.status === 'ok');
}

export function readinessSummary(items: PrepReadinessItem[]): string {
  const missing = items.filter((i) => i.status === 'missing');
  const unknown = items.filter((i) => i.status === 'unknown');
  if (missing.length === 0 && unknown.length === 0) {
    return 'Đủ sẵn sàng theo dữ liệu form — xuất bản vẫn do backend enforce. Publish ≠ mở redeem ≠ mở Gate.';
  }
  const parts: string[] = [];
  if (missing.length) {
    parts.push(`Thiếu: ${missing.map((m) => m.label).join(', ')}`);
  }
  if (unknown.length) {
    parts.push(`Chưa rõ: ${unknown.map((u) => u.label).join(', ')}`);
  }
  return `${parts.join(' · ')} — không đánh dấu xuất bản thành công khi còn thiếu/chưa rõ.`;
}
