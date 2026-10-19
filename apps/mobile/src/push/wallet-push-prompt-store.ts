import * as SecureStore from 'expo-secure-store';

const DISMISS_KEY = 'wallet_push_prompt_dismissed_v1';

export async function readWalletPushPromptDismissed(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISS_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function dismissWalletPushPrompt(): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISS_KEY, '1');
  } catch {
    /* best-effort — may re-show after reinstall */
  }
}

/** Test helper */
export async function __resetWalletPushPromptDismissedForTests(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}
