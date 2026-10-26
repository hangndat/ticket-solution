'use client';

import { useEffect } from 'react';

const dirtyForms = new Map<symbol, string>();
let installed = false;
let skipNextPop = false;

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

function popState() {
  if (skipNextPop) {
    skipNextPop = false;
    return;
  }
  if (!confirmDiscardIfDirty()) {
    skipNextPop = true;
    window.history.forward();
  }
}

function install() {
  if (
    installed ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  )
    return;
  installed = true;
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('click', clickLink, true);
  window.addEventListener('popstate', popState, true);
}

function uninstallIfEmpty() {
  if (!installed || dirtyForms.size !== 0) return;
  installed = false;
  window.removeEventListener('beforeunload', beforeUnload);
  document.removeEventListener('click', clickLink, true);
  window.removeEventListener('popstate', popState, true);
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
  install();
  return () => {
    dirtyForms.delete(id);
    uninstallIfEmpty();
  };
}
