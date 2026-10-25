import 'server-only';

import { ssrUpstreamGet } from '../bff/upstream';
import {
  navSessionAvatarFromJson,
  type NavSessionAvatar,
} from './nav-session-avatar';

const REQUEST_TIMEOUT_MS = 5_000;

export async function loadNavSessionAvatarServer(): Promise<NavSessionAvatar | null> {
  const me = await ssrUpstreamGet('/v1/me', { timeoutMs: REQUEST_TIMEOUT_MS });
  if (me.status < 200 || me.status >= 300) return null;
  return navSessionAvatarFromJson(me.body);
}
