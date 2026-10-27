export type PostLogoutNavigationPlan =
  | { kind: 'none' }
  | { kind: 'guest-replace' };

export function planPostLogoutNavigation(_input: {
  segments: readonly string[];
  staffWorkspace: boolean;
}): PostLogoutNavigationPlan {
  return { kind: 'guest-replace' };
}
