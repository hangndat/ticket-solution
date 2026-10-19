export {
  DEFAULT_PORTAL_LOCALE,
  PORTAL_LOCALES,
  isPortalLocale,
  parsePortalLocale,
  type PortalLocale,
} from './locale';
export {
  PORTAL_LOCALE_STORAGE_KEY,
  readStoredPortalLocale,
  writeStoredPortalLocale,
} from './storage';
export { DICTS, EN, VI, VI_TO_KEY, type MessageKey } from './messages';
export { t, isMessageKey, type TranslateVars } from './t';
export {
  PortalLocaleProvider,
  usePortalLocale,
  usePortalLocaleOptional,
} from './locale-context';
