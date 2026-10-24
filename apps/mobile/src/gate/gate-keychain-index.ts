import { requireNativeModule } from 'expo';

export type GateKeychainIndex = {
  workspaceUserIds: string[];
  scopeUserIds: string[];
  queueUserIds: string[];
  legacyOpsPresent: boolean;
};

export async function listGateLegacyKeys(): Promise<GateKeychainIndex> {
  const native = requireNativeModule<{ listGateLegacyKeys(): Promise<GateKeychainIndex> }>('GateKeychainIndex');
  const result = await native.listGateLegacyKeys();
  if (!result || !Array.isArray(result.workspaceUserIds) ||
      !Array.isArray(result.scopeUserIds) || !Array.isArray(result.queueUserIds) ||
      typeof result.legacyOpsPresent !== 'boolean' ||
      [...result.workspaceUserIds, ...result.scopeUserIds, ...result.queueUserIds]
        .some((id) => typeof id !== 'string' || !id)) {
    throw new Error('Không thể kiểm tra dữ liệu cổng trên thiết bị. Vui lòng thử lại.');
  }
  return result;
}
