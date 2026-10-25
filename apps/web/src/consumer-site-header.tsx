import { loadNavCapabilitiesServer } from './nav/load-nav-capabilities-server';
import { loadNavSessionAvatarServer } from './nav/load-nav-session-server';
import { SiteNav } from './site-chrome';

/** Persistent consumer header — SSR nav + avatar so route changes do not remount chrome. */
export async function ConsumerSiteHeader() {
  const [{ caps, links }, avatar] = await Promise.all([
    loadNavCapabilitiesServer(),
    loadNavSessionAvatarServer(),
  ]);

  return (
    <SiteNav
      initialSnapshot={{
        caps,
        links,
        resolved: true,
        loading: false,
      }}
      initialAvatar={avatar}
    />
  );
}
