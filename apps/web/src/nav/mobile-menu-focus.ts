/** Focusable controls inside the mobile nav drawer (for trap + initial focus). */
export const MOBILE_MENU_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: ParentNode): HTMLElement[] {
  if (!(container instanceof HTMLElement)) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(MOBILE_MENU_FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

/**
 * Tab cycle + Escape close for an open mobile menu.
 * Returns true when the event was handled (caller should preventDefault).
 */
export function handleMobileMenuKeyDown(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
  menuEl: HTMLElement,
): boolean {
  if (event.key !== 'Tab') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !menuEl.contains(active)) {
    return false;
  }
  const items = getFocusableElements(menuEl);
  if (items.length === 0) return false;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey) {
    if (active === first) {
      last.focus();
      return true;
    }
  } else if (active === last) {
    first.focus();
    return true;
  }
  return false;
}
