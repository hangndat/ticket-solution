/**
 * Client-side publish readiness derived from known admin UI state.
 * Does not invent API fields — unknown stays unknown (not fake OK).
 */

import type {
  EventConfigPayload,
  EventContentSection,
} from '@ticket/contracts';
import type { AdminDecision } from './decide';
import type { EventReportView } from './report';
import { reportShowsNumbers } from './report';

export type ReadinessKey =
  | 'types'
  | 'sources'
  | 'quota'
  | 'form'
  | 'brand';

export type ReadinessStatus = 'ok' | 'missing' | 'unknown';

export type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

export type ReadinessInput = {
  /** Selected / created ticket type id in the form. */
  ticketTypeId: string;
  /** Selected / created source id in the form. */
  sourceId: string;
  /** Last successful quota decision, if any. */
  quotaDecision: Extract<AdminDecision, { kind: 'quota' }> | null;
  /** Last report view (numbers only when shown). */
  report: EventReportView | null;
  /** Explicit quota typed for first import (empty = not declared here). */
  eventQuotaInput: string;
  /** Config editor payload currently in the form. */
  configPayload: EventConfigPayload;
  /** True after a successful publish lock in this session. */
  configPublished: boolean;
  /** Event context loaded. */
  hasEventContext: boolean;
};

const LABELS: Record<ReadinessKey, string> = {
  types: 'Loại vé',
  sources: 'Nguồn mã',
  quota: 'Hạn mức',
  form: 'Biểu mẫu / điều khoản',
  brand: 'Nhận diện tối thiểu',
};

function termsSectionOk(payload: EventConfigPayload): boolean {
  const terms = payload.sections.find(
    (s: EventContentSection) => s.kind === 'terms',
  );
  if (!terms) return false;
  const body = terms.body as { termsVersion?: string; text?: string };
  const version = (body.termsVersion ?? '').trim();
  const text = (body.text ?? '').trim();
  return version.length > 0 || text.length > 0;
}

function brandOk(payload: EventConfigPayload): boolean {
  const name = (payload.brand.organizationName ?? '').trim();
  const color = (payload.brand.primaryColor ?? '').trim();
  return name.length > 0 && color.length > 0;
}

function quotaFromReport(
  report: EventReportView | null,
): { known: true; capacity: number | null } | { known: false } {
  if (!report || !reportShowsNumbers(report)) return { known: false };
  return { known: true, capacity: report.quota.capacity };
}

export function deriveAdminReadiness(input: ReadinessInput): ReadinessItem[] {
  if (!input.hasEventContext) {
    return (Object.keys(LABELS) as ReadinessKey[]).map((key) => ({
      key,
      label: LABELS[key],
      status: 'unknown' as const,
      detail: 'Chưa chọn sự kiện — chưa đánh giá sẵn sàng.',
    }));
  }

  const typesOk = input.ticketTypeId.trim().length > 0;
  const sourcesOk = input.sourceId.trim().length > 0;

  let quotaStatus: ReadinessStatus = 'unknown';
  let quotaDetail = 'Chưa đọc hạn mức — chưa xác định.';
  if (input.quotaDecision) {
    if (input.quotaDecision.capacity === null) {
      quotaStatus = 'ok';
      quotaDetail = 'Không giới hạn (capacity null).';
    } else {
      quotaStatus = 'ok';
      quotaDetail = `Đã cấu hình: ${input.quotaDecision.allocated} / ${input.quotaDecision.capacity}.`;
    }
  } else {
    const fromReport = quotaFromReport(input.report);
    if (fromReport.known) {
      if (fromReport.capacity === null) {
        quotaStatus = 'ok';
        quotaDetail = 'Không giới hạn (capacity null — từ báo cáo).';
      } else {
        quotaStatus = 'ok';
        quotaDetail = `Đã cấu hình (báo cáo): capacity ${fromReport.capacity}.`;
      }
    } else if (input.eventQuotaInput.trim() !== '') {
      const n = Number(input.eventQuotaInput);
      if (Number.isFinite(n) && n >= 0) {
        quotaStatus = 'ok';
        quotaDetail = `Đã nhập hạn mức lần đầu: ${n}.`;
      } else {
        quotaStatus = 'missing';
        quotaDetail = 'Hạn mức nhập không hợp lệ.';
      }
    }
  }

  const formOk = termsSectionOk(input.configPayload) || input.configPublished;
  const brandReady = brandOk(input.configPayload);

  return [
    {
      key: 'types',
      label: LABELS.types,
      status: typesOk ? 'ok' : 'missing',
      detail: typesOk
        ? 'Đã có loại vé trong ngữ cảnh form.'
        : 'Thiếu loại vé — tạo hoặc chọn ticket type.',
    },
    {
      key: 'sources',
      label: LABELS.sources,
      status: sourcesOk ? 'ok' : 'missing',
      detail: sourcesOk
        ? 'Đã có nguồn mã trong ngữ cảnh form.'
        : 'Thiếu nguồn mã — tạo hoặc chọn source.',
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
      status: formOk ? 'ok' : 'missing',
      detail: formOk
        ? input.configPublished
          ? 'Đã publish cấu hình (biểu mẫu/điều khoản trong phiên bản).'
          : 'Điều khoản / biểu mẫu đã có nội dung trong draft.'
        : 'Thiếu điều khoản hoặc chưa publish cấu hình.',
    },
    {
      key: 'brand',
      label: LABELS.brand,
      status: brandReady ? 'ok' : 'missing',
      detail: brandReady
        ? 'Đã có tên tổ chức và màu nhận diện.'
        : 'Thiếu tên tổ chức hoặc màu nhận diện tối thiểu.',
    },
  ];
}

export function readinessAllOk(items: ReadinessItem[]): boolean {
  return items.every((i) => i.status === 'ok');
}

export function readinessSummary(items: ReadinessItem[]): string {
  if (items.some((i) => i.status === 'unknown') && items.every((i) => i.status !== 'missing')) {
    const unknown = items.filter((i) => i.status === 'unknown');
    if (unknown.length === items.length) {
      return 'Chưa chọn sự kiện — checklist chưa đánh giá.';
    }
  }
  const missing = items.filter((i) => i.status === 'missing');
  const unknown = items.filter((i) => i.status === 'unknown');
  if (missing.length === 0 && unknown.length === 0) {
    return 'Đủ sẵn sàng theo dữ liệu form hiện có — xuất bản vẫn do backend enforce.';
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
