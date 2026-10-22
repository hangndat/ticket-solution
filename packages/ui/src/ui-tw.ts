/**
 * Prefix Tailwind utilities with `ui:` — matches `prefix(ui)` in apps/web/app/globals.css
 * so legacy `.container` and other class names are not overridden.
 */
export function withUiPrefix(classes: string): string {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => {
      if (cls.startsWith('ui:')) {
        return cls;
      }
      const parts = cls.split(':');
      const util = parts.pop()!;
      if (!parts.length) {
        return `ui:${util}`;
      }
      return `ui:${parts.join(':')}:${util}`;
    })
    .join(' ');
}
