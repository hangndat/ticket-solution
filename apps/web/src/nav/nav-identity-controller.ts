'use client';

import type { NavCapabilitiesStore } from './nav-capabilities-store';
import {
  navSessionAvatarFromText,
  type NavSessionAvatar,
} from './nav-session-avatar';

async function loadAvatar(): Promise<NavSessionAvatar | null> {
  const response = await fetch('/api/bff/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return navSessionAvatarFromText(await response.text());
}

/** Keeps the persistent header's avatar bound to each completed discovery. */
export class NavIdentityController {
  private avatar: NavSessionAvatar | null;
  private version = 0;
  private listeners = new Set<(avatar: NavSessionAvatar | null) => void>();

  constructor(
    private readonly nav: NavCapabilitiesStore,
    initialAvatar: NavSessionAvatar | null,
    private readonly avatarLoader: () => Promise<NavSessionAvatar | null> = loadAvatar,
  ) {
    this.avatar = initialAvatar;
  }

  getAvatar = () => this.avatar;

  subscribe = (listener: (avatar: NavSessionAvatar | null) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  clear() {
    this.version += 1;
    this.publish(null);
  }

  private publish(avatar: NavSessionAvatar | null) {
    this.avatar = avatar;
    for (const listener of this.listeners) listener(avatar);
  }

  async revalidate(): Promise<void> {
    this.clear();
    const pending = this.nav.refresh();
    // refresh publishes guest synchronously; subscribers may call clear again.
    const version = this.version;
    const snapshot = await pending;
    if (version !== this.version || !snapshot.caps.authenticated) return;
    try {
      const avatar = await this.avatarLoader();
      if (version === this.version) this.publish(avatar);
    } catch {
      // A failed identity lookup cannot restore a prior user's avatar.
    }
  }
}
