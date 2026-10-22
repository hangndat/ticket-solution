import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class names (shadcn / Aceternity convention). Safe on server and client. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Live Pulse legacy chrome — skip Tailwind utilities so unlayered CSS keeps prod parity (D-1). */
const LEGACY_CHROME_CLASS = /^(mkt-|demo-|catalog-|surface-)/;

export function usesLegacyChromeClass(className?: string): boolean {
  if (!className) return false;
  return className.split(/\s+/).some((token) => LEGACY_CHROME_CLASS.test(token));
}
