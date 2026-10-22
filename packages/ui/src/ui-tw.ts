/**
 * Prefix Tailwind utilities with `ui:` — matches `prefix(ui)` in apps/web/app/globals.css
 * so legacy `.container` and other class names are not overridden.
 */
export function withUiPrefix(classes: string): string {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => {
      if (cls.includes('ui:')) {
        return cls;
      }
      const parts = cls.split(':');
      const util = parts.pop()!;
      const variant = parts.length ? `${parts.join(':')}:` : '';
      return `${variant}ui:${util}`;
    })
    .join(' ');
}
