import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. `aps-environment` must be `production` for Release /
 * TestFlight / Archive; Debug / simulator keep `development` (APNs sandbox).
 *
 * Set one of: APS_ENVIRONMENT=production | APP_VARIANT=production |
 * EXPO_PUBLIC_APS_ENVIRONMENT=production before `expo prebuild` / Archive.
 * Never use EAS Cloud Build for this project.
 *
 * Production builds also bake public Vemoki EXPO_PUBLIC_* defaults into
 * `extra.ticketPublic` (and process.env for Metro inline) when unset — TF/device
 * archives must not ship with empty API/OIDC (Gate fail-closed "sign in / API").
 */
function resolveApsEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): 'development' | 'production' {
  const raw =
    env.APS_ENVIRONMENT?.trim() ||
    env.APP_VARIANT?.trim() ||
    env.EXPO_PUBLIC_APS_ENVIRONMENT?.trim() ||
    '';
  return raw === 'production' ? 'production' : 'development';
}

/**
 * Public (non-secret) production defaults for Release / TestFlight bake.
 * Issuer stays on auth.vemoki.com — independent of O13 web apex vs app.vemoki.com.
 */
export const VEMOKI_PROD_PUBLIC = {
  apiBaseUrl: 'https://api.vemoki.com',
  oidcIssuer: 'https://auth.vemoki.com/realms/ticket',
  oidcClientId: 'ticket-mobile',
  pushProvider: 'apns',
} as const;

export type TicketPublicExtra = {
  apiBaseUrl?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcScopes?: string;
  tenantId?: string;
  eventId?: string;
  pushProvider?: string;
  apsEnvironment?: 'development' | 'production';
};

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

/**
 * For production APS builds, fill missing EXPO_PUBLIC_* so Metro inlines them
 * and EXConstants.extra mirrors the same values for runtime fallback.
 */
function bakePublicConfig(
  apsEnvironment: 'development' | 'production',
  env: NodeJS.ProcessEnv = process.env,
): TicketPublicExtra {
  if (apsEnvironment === 'production') {
    env.EXPO_PUBLIC_API_BASE_URL ||= VEMOKI_PROD_PUBLIC.apiBaseUrl;
    env.EXPO_PUBLIC_OIDC_ISSUER ||= VEMOKI_PROD_PUBLIC.oidcIssuer;
    env.EXPO_PUBLIC_OIDC_CLIENT_ID ||= VEMOKI_PROD_PUBLIC.oidcClientId;
    env.EXPO_PUBLIC_PUSH_PROVIDER ||= VEMOKI_PROD_PUBLIC.pushProvider;
    env.EXPO_PUBLIC_APS_ENVIRONMENT ||= 'production';
  }

  const ticketPublic: TicketPublicExtra = {
    apiBaseUrl: trimEnv(env.EXPO_PUBLIC_API_BASE_URL) || undefined,
    oidcIssuer: trimEnv(env.EXPO_PUBLIC_OIDC_ISSUER) || undefined,
    oidcClientId: trimEnv(env.EXPO_PUBLIC_OIDC_CLIENT_ID) || undefined,
    oidcScopes: trimEnv(env.EXPO_PUBLIC_OIDC_SCOPES) || undefined,
    tenantId: trimEnv(env.EXPO_PUBLIC_TENANT_ID) || undefined,
    eventId: trimEnv(env.EXPO_PUBLIC_EVENT_ID) || undefined,
    pushProvider: trimEnv(env.EXPO_PUBLIC_PUSH_PROVIDER) || undefined,
    apsEnvironment,
  };
  return ticketPublic;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const apsEnvironment = resolveApsEnvironment();
  const ticketPublic = bakePublicConfig(apsEnvironment);

  return {
    ...config,
    name: 'Vemoki',
    slug: 'vemoki',
    version: '1.0.0',
    icon: './assets/icon.png',
    platforms: ['ios'],
    orientation: 'default',
    scheme: ['vemoki', 'ticketsolution'],
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hangndat.ticket',
      appleTeamId: 'BLUA62D52G',
      buildNumber: '23',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification'],
      },
      entitlements: {
        'aps-environment': apsEnvironment,
      },
    },
    extra: {
      ...(typeof config.extra === 'object' && config.extra ? config.extra : {}),
      ticketPublic,
      /** Set at Release install: EXPO_PUBLIC_BUILD_GIT_SHA=$(git rev-parse HEAD) */
      gitCommitSha: trimEnv(process.env.EXPO_PUBLIC_BUILD_GIT_SHA) || undefined,
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#F4F6F8',
          image: './assets/splash-icon.png',
          imageWidth: 160,
          dark: {
            backgroundColor: '#0B1220',
            image: './assets/splash-icon-dark.png',
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Scan ticket QR codes at the gate.',
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#E11D48',
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  };
};
