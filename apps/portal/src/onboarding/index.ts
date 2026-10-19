export {
  isValidRegistrationSlug,
  normalizeRegistrationBody,
  parseRegistrationResponse,
  isPendingActivationStatus,
} from './registration';
export {
  ONBOARDING_PROGRESS_VERSION,
  defaultOnboardingProgress,
  readOnboardingProgress,
  writeOnboardingProgress,
  patchOnboardingProgress,
  firstRunCurrentStep,
  shouldShowFirstRun,
  type OnboardingProgress,
} from './progress';
export {
  isStaffPortalTenant,
  pickPrimaryTenant,
  resolveOnboardingSurface,
  onboardingPathForTenant,
  portalPathForTenant,
  type OnboardingSurface,
} from './routing';
