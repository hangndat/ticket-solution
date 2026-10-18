import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // OIDC BFF login/logout must full-navigate (Set-Cookie + IdP redirect).
      '@next/next/no-location-assign-relative-destination': 'off',
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts', 'tests/**', '.uat-artifacts/**']),
]);
