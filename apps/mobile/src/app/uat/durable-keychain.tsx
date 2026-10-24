import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { space } from '@/theme/tokens';
import * as SecureStore from 'expo-secure-store';
import { listGateLegacyKeys } from '@/gate/gate-keychain-index';

const ID = '__f02_durable_native_probe__';
const workspace = `ticket.gate.workspace.v2.${ID}`;
const queue = `ticket.gate.offline-queue.v1.${ID}`;
const decoy = `ticket.gate.workspace.v2.${ID}_other_service`;
const queueOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.gate-offline-queue',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const decoyOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.identity',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Development-only Keychain allowlist probe; all keys and values are synthetic. */
export default function DurableKeychainProbe() {
  const [result, setResult] = useState('Đang kiểm tra Keychain…');
  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;
    void (async () => {
      let phase = 'write workspace';
      try {
        await SecureStore.setItemAsync(workspace, '{"v":2}');
        phase = 'write queue';
        await SecureStore.setItemAsync(queue, '[]', queueOptions);
        phase = 'write decoy';
        await SecureStore.setItemAsync(decoy, 'synthetic', decoyOptions);
        phase = 'native list';
        const indexed = await listGateLegacyKeys();
        phase = 'allowlist comparison';
        const allowlisted = indexed.workspaceUserIds.includes(ID) &&
          indexed.queueUserIds.includes(ID) &&
          !indexed.workspaceUserIds.includes(`${ID}_other_service`);
        if (!allowlisted) throw new Error('Native allowlist did not match synthetic keys');
        phase = 'delete synthetic keys';
        await SecureStore.deleteItemAsync(workspace);
        await SecureStore.deleteItemAsync(queue, queueOptions);
        await SecureStore.deleteItemAsync(decoy, decoyOptions);
        phase = 'native absence';
        const after = await listGateLegacyKeys();
        if (after.workspaceUserIds.includes(ID) || after.queueUserIds.includes(ID)) {
          throw new Error('Native index still contains deleted synthetic keys');
        }
        if (!cancelled) setResult('PASS: Gate allowlist, service isolation, exact deletion');
      } catch (error) {
        if (!cancelled) setResult(`FAIL (${phase}): ${error instanceof Error ? error.message : 'Native Keychain probe'}`);
      } finally {
        try { await SecureStore.deleteItemAsync(workspace); } catch { /* probe cleanup reported by rerun */ }
        try { await SecureStore.deleteItemAsync(queue, queueOptions); } catch { /* probe cleanup reported by rerun */ }
        try { await SecureStore.deleteItemAsync(decoy, decoyOptions); } catch { /* probe cleanup reported by rerun */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!__DEV__) return null;
  return <View style={{ flex: 1, padding: space.xl, justifyContent: 'center' }}>
    <Text accessibilityRole="header">F02 Keychain probe</Text>
    <Text testID="durable-keychain-probe-result">{result}</Text>
  </View>;
}
