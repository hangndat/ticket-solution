type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

/** Show «Dữ liệu mô phỏng» strip on attendee chrome (prototype / pilot honesty). */
export function isDemoDataStripEnabled(env: EnvBag = process.env): boolean {
  const raw =
    env.NEXT_PUBLIC_DEMO_DATA_STRIP?.trim() ??
    env.DEMO_DATA_STRIP?.trim() ??
    '';
  return raw === '1' || raw.toLowerCase() === 'true';
}
