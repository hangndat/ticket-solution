/** Starts one focus-scoped refresh; blurred work must not update the wallet. */
export function startWalletFocusRefresh(input: {
  hydrate: (isActive: () => boolean) => Promise<void>;
  refresh: (isActive: () => boolean) => Promise<void>;
  setBusy: (busy: boolean) => void;
}): () => void {
  let active = true;
  const isActive = () => active;
  input.setBusy(true);
  void (async () => {
    try {
      await input.hydrate(isActive);
      if (isActive()) await input.refresh(isActive);
    } finally {
      if (isActive()) input.setBusy(false);
    }
  })();
  return () => { active = false; };
}
