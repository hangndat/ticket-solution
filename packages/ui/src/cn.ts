import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class names (shadcn / Aceternity convention). Safe on server and client. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Marketing / Live Pulse routes style primitives via legacy `.mkt-*` CSS (unlayered wins on main). */
export function usesLegacyChromeClass(className?: string): boolean {
  if (!className) return false;
  return className.split(/\s+/).some((token) => token.startsWith('mkt-'));
}
