const API_URL_STORAGE_KEY = 'capdown:api_url';

export const DEFAULT_DESKTOP_API = 'http://127.0.0.1:4540';
export const DEFAULT_ANDROID_API = 'http://192.168.100.14:4540';

export function isNativeAndroid() {
  const capacitor = window.Capacitor;
  return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === 'android');
}

export function getDefaultApiBaseUrl() {
  return isNativeAndroid() ? DEFAULT_ANDROID_API : DEFAULT_DESKTOP_API;
}

export function readApiUrlOverride() {
  try {
    return window.localStorage.getItem(API_URL_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function writeApiUrlOverride(value) {
  const normalized = value.trim();

  try {
    if (normalized) {
      window.localStorage.setItem(API_URL_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_URL_STORAGE_KEY);
    }
  } catch {
    // Storage failures should not block the current session.
  }

  return normalized;
}

export function clearApiUrlOverride() {
  try {
    window.localStorage.removeItem(API_URL_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_CAPDOWN_API_URL?.trim() || '';
  const overrideUrl = readApiUrlOverride();
  const fallbackUrl = getDefaultApiBaseUrl();
  const baseUrl = envUrl || overrideUrl || fallbackUrl;
  const source = envUrl
    ? 'env'
    : overrideUrl
      ? 'override'
      : isNativeAndroid()
        ? 'android-default'
        : 'desktop-default';

  return {
    baseUrl,
    source,
    envUrl,
    overrideUrl,
    fallbackUrl,
  };
}

export function getApiSourceLabel(source) {
  switch (source) {
    case 'env':
      return 'VITE_CAPDOWN_API_URL';
    case 'override':
      return 'Override local';
    case 'android-default':
      return 'Padrão Android';
    default:
      return 'Padrão desktop';
  }
}
