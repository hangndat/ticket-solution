import { SessionBoundary } from './session-boundary';
import { secureCredentialStore } from './secure-credential-store';
import { prepareVerifiedGateOwnership, readLastVerifiedGateOwner } from '../gate/staff-gate-workspace-store.ts';

export const session = new SessionBoundary(secureCredentialStore, undefined, {
  beforeVerified: async (userId, generation, isCurrent) => {
    try {
      await prepareVerifiedGateOwnership(userId, generation, isCurrent);
    } catch (cause) {
      throw new Error('Không thể chuẩn bị dữ liệu cổng trên thiết bị. Vui lòng thử lại.', { cause });
    }
  },
  beforeSwitch: async ({ epoch, bearer }) => {
    try {
      const { clearApnsRegistrationState } = await import('../push/apns-device-token.ts');
      const unverifiedExpectedUserId = epoch ? undefined : await readLastVerifiedGateOwner();
      await clearApnsRegistrationState({
        session, expectedEpoch: epoch ?? undefined, bearer,
        allowUnverifiedLocal: epoch === null, unverifiedExpectedUserId,
      });
    } catch (cause) {
      throw new Error('Chưa thể gỡ đăng ký thông báo của phiên trước. Vui lòng thử lại.', { cause });
    }
  },
});
