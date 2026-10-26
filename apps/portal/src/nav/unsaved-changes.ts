'use client';

import { useEffect } from 'react';

const dirtyForms = new Map<symbol, string>();
const HISTORY_POSITION = '__portalHistoryPosition';

export function confirmDiscardIfDirty(prompt?: string): boolean {
  if (dirtyForms.size === 0) return true;
  return window.confirm(prompt ?? dirtyForms.values().next().value ?? '');
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (dirtyForms.size === 0) return;
  event.preventDefault();
  event.returnValue = '';
}

function clickLink(event: MouseEvent) {
  if (
    dirtyForms.size === 0 ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest('a[href]');
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.hasAttribute('download') ||
    link.getAttribute('target') === '_blank'
  )
    return;
  const destination = new URL(link.href, window.location.href);
  if (
    destination.href === window.location.href ||
    (destination.hash &&
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search)
  )
    return;
  if (!confirmDiscardIfDirty()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

/** Track same-document entries before a form becomes dirty, including Forward. */
export function installUnsavedNavigation(): () => void {
  const history = window.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  let position = 0;
  let restoring = false;
  const initial = history.state?.[HISTORY_POSITION];
  if (typeof initial === 'number') position = initial;
  originalReplace.call(
    history,
    { ...history.state, [HISTORY_POSITION]: position },
    '',
  );

  const push: History['pushState'] = function (data, unused, url) {
    const next = position + 1;
    originalPush.call(
      history,
      { ...data, [HISTORY_POSITION]: next },
      unused,
      url,
    );
    position = next;
  };
  const replace: History['replaceState'] = function (data, unused, url) {
    originalReplace.call(
      history,
      { ...data, [HISTORY_POSITION]: position },
      unused,
      url,
    );
  };
  history.pushState = push;
  history.replaceState = replace;

  const popState = (event: PopStateEvent) => {
    if (restoring) {
      restoring = false;
      event.stopImmediatePropagation();
      return;
    }
    const destination = event.state?.[HISTORY_POSITION];
    if (typeof destination !== 'number') return;
    const delta = destination - position;
    if (delta !== 0 && !confirmDiscardIfDirty()) {
      // Next must not render the rejected route or unmount the dirty form.
      event.stopImmediatePropagation();
      restoring = true;
      history.go(-delta);
      return;
    }
    position = destination;
  };
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('click', clickLink, true);
  window.addEventListener('popstate', popState, true);
  return () => {
    window.removeEventListener('beforeunload', beforeUnload);
    document.removeEventListener('click', clickLink, true);
    window.removeEventListener('popstate', popState, true);
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace)
      history.replaceState = originalReplace;
  };
}

/** Register only actual editable data forms; filter and search inputs do not count. */
export function useUnsavedChanges(dirty: boolean, prompt: string) {
  useEffect(() => {
    if (!dirty) return;
    return registerDirtyForm(prompt);
  }, [dirty, prompt]);
}

export function registerDirtyForm(prompt: string): () => void {
  const id = Symbol('dirty-form');
  dirtyForms.set(id, prompt);
  return () => {
    dirtyForms.delete(id);
  };
}
