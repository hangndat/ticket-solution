import type { EventDetail } from '@ticket/contracts';

type FormFields<T> = { setFieldsValue: (values: T) => void };

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
