import { SessionBoundary } from './session-boundary';
import { secureCredentialStore } from './secure-credential-store';
export const session = new SessionBoundary(secureCredentialStore);
