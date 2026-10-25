import { LogBox } from 'react-native';

const flag = process.env.EXPO_PUBLIC_UAT_SCREENSHOT?.trim().toLowerCase();

/** Local simulator evidence only — suppress LogBox toasts on capture runs. */
if (flag === '1' || flag === 'true') {
  LogBox.ignoreAllLogs(true);
}
