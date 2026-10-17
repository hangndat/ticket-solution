import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
} from './contract-shape';

type EventScope = { tenantId: string; eventId: string };

export function ticketTypesPath(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/ticket-types`;
}

export function sourcesPath(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/sources`;
}

export type TicketTypeView =
  | { kind: 'created'; ticketTypeId: string; label: string }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type SourceView =
  | {
      kind: 'created';
      sourceId: string;
      name: string;
      approvalMode: 'AUTO' | 'MANUAL';
      ticketTypeId: string;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const TICKET_TYPE_UNKNOWN =
  'Kết quả tạo ticket type chưa biết. Không coi là đã tạo.';

export const SOURCE_UNKNOWN =
  'Kết quả tạo source chưa biết. Không coi là đã tạo.';

export function interpretTicketTypeCreate(
  status: number,
  json: unknown,
  networkError: boolean,
): TicketTypeView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: TICKET_TYPE_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 || status === 201) {
    if (
      body &&
      isNonEmptyString(body.ticketTypeId) &&
      isNonEmptyString(body.label)
    ) {
      return {
        kind: 'created',
        ticketTypeId: body.ticketTypeId.trim(),
        label: body.label.trim(),
      };
    }
    return { kind: 'unknown', message: TICKET_TYPE_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: TICKET_TYPE_UNKNOWN };
}

export function interpretSourceCreate(
  status: number,
  json: unknown,
  networkError: boolean,
): SourceView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: SOURCE_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 || status === 201) {
    if (
      body &&
      isNonEmptyString(body.sourceId) &&
      isNonEmptyString(body.name) &&
      (body.approvalMode === 'AUTO' || body.approvalMode === 'MANUAL') &&
      isNonEmptyString(body.ticketTypeId)
    ) {
      return {
        kind: 'created',
        sourceId: body.sourceId.trim(),
        name: body.name.trim(),
        approvalMode: body.approvalMode,
        ticketTypeId: body.ticketTypeId.trim(),
      };
    }
    return { kind: 'unknown', message: SOURCE_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: SOURCE_UNKNOWN };
}

export function ticketTypeLabel(view: TicketTypeView): string {
  if (view.kind === 'created') {
    return `Đã tạo ticket type ${view.ticketTypeId} (${view.label}).`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function sourceLabel(view: SourceView): string {
  if (view.kind === 'created') {
    return `Đã tạo source ${view.sourceId} (${view.name}, ${view.approvalMode}) → type ${view.ticketTypeId}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}
