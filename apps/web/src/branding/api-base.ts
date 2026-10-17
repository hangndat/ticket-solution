/** API base for public branding fetch — no contracts dependency. */
export function brandingApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}
