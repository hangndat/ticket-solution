'use client';

import { useCallback, useState } from 'react';
import {
  interpretSourceCreate,
  interpretTicketTypeCreate,
  type SourceView,
  type TicketTypeView,
} from './event-setup';
import type { AdminScope } from './scope';
import { fetchJson } from '../redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

type Params = {
  scope: () => AdminScope;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onClearSiblingViews: () => void;
  onTicketTypeCreated: (ticketTypeId: string) => void;
  onSourceCreated: (sourceId: string) => void;
};

export function useTicketSourceApi({
  scope,
  onBusy,
  onBumpNotice,
  onClearSiblingViews,
  onTicketTypeCreated,
  onSourceCreated,
}: Params) {
  const [ticketTypeLabelInput, setTicketTypeLabelInput] = useState('GA');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceName, setSourceName] = useState('Invite');
  const [approvalMode, setApprovalMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [ticketTypeView, setTicketTypeView] = useState<TicketTypeView | null>(
    null,
  );
  const [sourceView, setSourceView] = useState<SourceView | null>(null);

  const clearViews = useCallback(() => {
    setTicketTypeView(null);
    setSourceView(null);
  }, []);

  const createTicketType = useCallback(async () => {
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const result = await fetchJson(
      '/api/bff/admin/ticket-types',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          label: ticketTypeLabelInput.trim(),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretTicketTypeCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'created') {
      setTicketTypeId(next.ticketTypeId);
      onTicketTypeCreated(next.ticketTypeId);
    }
    onBumpNotice();
    setTicketTypeView(next);
    onBusy(false);
  }, [
    clearViews,
    onBumpNotice,
    onBusy,
    onClearSiblingViews,
    onTicketTypeCreated,
    scope,
    ticketTypeLabelInput,
  ]);

  const createSource = useCallback(async () => {
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const result = await fetchJson(
      '/api/bff/admin/sources',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          name: sourceName.trim(),
          approvalMode,
          ticketTypeId: ticketTypeId.trim(),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretSourceCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'created') {
      setSourceId(next.sourceId);
      onSourceCreated(next.sourceId);
    }
    onBumpNotice();
    setSourceView(next);
    onBusy(false);
  }, [
    approvalMode,
    clearViews,
    onBumpNotice,
    onBusy,
    onClearSiblingViews,
    onSourceCreated,
    scope,
    sourceName,
    ticketTypeId,
  ]);

  return {
    ticketTypeLabelInput,
    setTicketTypeLabelInput,
    ticketTypeId,
    setTicketTypeId,
    sourceId,
    setSourceId,
    sourceName,
    setSourceName,
    approvalMode,
    setApprovalMode,
    ticketTypeView,
    sourceView,
    clearViews,
    createTicketType,
    createSource,
  };
}
