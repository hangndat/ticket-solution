import type { IosNotificationPermission } from './push-permission.ts';
import { isApnsProvider } from './push.ts';

export type PushIdentityKind = 'guest' | 'verified';

export type PushBackendRegistration =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'failed'
  | 'skipped-unsigned';

export type PushAccountAction =
  | { kind: 'none' }
  | { kind: 'sign-in-hint' }
  | { kind: 'enable' }
  | { kind: 'open-settings' }
  | { kind: 'retry-server' };

export type PushAccountUiModel = {
  sectionVisible: boolean;
  statusLine: string;
  detailLine?: string;
  action: PushAccountAction;
  actionLabel?: string;
  busyHint?: string;
};

export type PushAccountUiInput = {
  provider: string | null;
  identity: PushIdentityKind;
  iosPermission: IosNotificationPermission;
  backend: PushBackendRegistration;
};

/** PD §3 matrix — pure for unit tests (no RN). */
export function derivePushAccountUi(
  input: PushAccountUiInput,
): PushAccountUiModel {
  const provider = input.provider;
  if (!provider) {
    return {
      sectionVisible: true,
      statusLine: 'Chưa hỗ trợ thông báo trên phiên bản này',
      action: { kind: 'none' },
    };
  }
  if (!isApnsProvider(provider)) {
    return {
      sectionVisible: true,
      statusLine: 'Chưa hỗ trợ thông báo trên phiên bản này',
      action: { kind: 'none' },
    };
  }

  if (input.identity === 'guest') {
    return {
      sectionVisible: true,
      statusLine: 'Đăng nhập để bật nhắc vé và sự kiện',
      action: { kind: 'sign-in-hint' },
    };
  }

  const perm = input.iosPermission;
  if (perm === 'denied') {
    return {
      sectionVisible: true,
      statusLine: 'Đã tắt trên iPhone',
      action: { kind: 'open-settings' },
      actionLabel: 'Mở Cài đặt',
    };
  }

  if (perm === 'not-determined' || perm === 'unknown') {
    return {
      sectionVisible: true,
      statusLine: 'Chưa bật thông báo trên iPhone',
      action: { kind: 'enable' },
      actionLabel: 'Bật thông báo',
    };
  }

  if (perm === 'provisional') {
    return {
      sectionVisible: true,
      statusLine:
        'Thông báo im lặng trong Trung tâm thông báo — chưa có banner hoặc âm thanh',
      action: { kind: 'open-settings' },
      actionLabel: 'Mở Cài đặt',
    };
  }

  // authorized — distinguish OS vs backend POST
  if (input.backend === 'registering') {
    return {
      sectionVisible: true,
      statusLine: 'Đã bật trên iPhone',
      detailLine: 'Đang lưu thiết bị…',
      action: { kind: 'none' },
      busyHint: 'Đang lưu thiết bị…',
    };
  }
  if (input.backend === 'failed') {
    return {
      sectionVisible: true,
      statusLine: 'Đã bật trên iPhone',
      detailLine: 'Chưa lưu thiết bị — thử lại.',
      action: { kind: 'retry-server' },
      actionLabel: 'Thử lại',
    };
  }
  if (input.backend === 'registered') {
    return {
      sectionVisible: true,
      statusLine: 'Đã bật trên iPhone',
      action: { kind: 'none' },
    };
  }

  return {
    sectionVisible: true,
    statusLine: 'Đã bật trên iPhone',
    action: { kind: 'retry-server' },
    actionLabel: 'Thử lưu lại',
  };
}
