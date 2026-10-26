import type { EventDetail } from '@ticket/contracts';
import type { PortalFetchResult } from '../client/portal-fetch';

type FormFields<T> = { setFieldsValue: (values: T) => void };

export type MetadataSaveRequest = {
  expectedRevision: number;
  name: string;
  idempotencyKey: string;
};

export function metadataSaveRequest(
  pending: MetadataSaveRequest | null,
  revision: number,
  name: string,
  newKey: () => string,
): MetadataSaveRequest {
  return pending ?? {
    expectedRevision: revision,
    name: name.trim(),
    idempotencyKey: newKey(),
  };
}

export function metadataOutcomeUnknown(res: PortalFetchResult): boolean {
  return (
    res.networkError ||
    res.timedOut ||
    res.status >= 500 ||
    (res.json !== null &&
      typeof res.json === 'object' &&
      (res.json as { retryable?: unknown }).retryable === true)
  );
}

export function hasUnsavedSetupChanges(
  metaDirty: boolean,
  cloneDirty: boolean,
) {
  return metaDirty || cloneDirty;
}

/** Refresh server defaults without replacing edits made while the request was in flight. */
export function applySetupReload(
  event: Pick<EventDetail, 'name' | 'slug'>,
  metaForm: FormFields<{ name: string }>,
  cloneForm: FormFields<{ slug: string; name: string }>,
  dirty: { meta: boolean; clone: boolean },
  cloneName: string,
) {
  if (!dirty.meta) metaForm.setFieldsValue({ name: event.name });
  if (!dirty.clone) {
    cloneForm.setFieldsValue({ slug: `${event.slug}-copy`, name: cloneName });
  }
}
