import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. `aps-environment` must be `production` for Release /
 * TestFlight / Archive; Debug / simulator keep `development` (APNs sandbox).
 *
 * Set one of: APS_ENVIRONMENT=production | APP_VARIANT=production |
 * EXPO_PUBLIC_APS_ENVIRONMENT=production before `expo prebuild` / Archive.
 * Never use EAS Cloud Build for this project.
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

export default ({ config }: ConfigContext): ExpoConfig => {
  const apsEnvironment = resolveApsEnvironment();
  return {
    ...config,
    name: 'Vemoki',
    slug: 'vemoki',
    version: '0.1.0',
    icon: './assets/icon.png',
    platforms: ['ios'],
    orientation: 'default',
    scheme: ['vemoki', 'ticketsolution'],
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hangndat.ticket',
      appleTeamId: 'BLUA62D52G',
      buildNumber: '6',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification'],
      },
      entitlements: {
        'aps-environment': apsEnvironment,
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#f7f6f1',
          image: './assets/splash-icon.png',
          imageWidth: 160,
          dark: {
            backgroundColor: '#22241f',
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
          color: '#245B47',
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
