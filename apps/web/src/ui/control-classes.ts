import { inputVariants } from '@ticket/ui';

/**
 * Shared height/border/radius/focus/disabled/error styling for native
 * `<select>` and `<textarea>` elements, matching the `Input` primitive
 * (`inputVariants` in packages/ui) since those tags have no shared
 * component yet.
 */
export function controlClass(error?: boolean) {
  return inputVariants({ state: error ? 'error' : 'default' });
}
