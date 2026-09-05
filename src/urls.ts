/** Vite supplies the deployment base in browsers; Node-based source tests use /. */
export const APP_BASE = import.meta.env?.BASE_URL ?? '/';
export function appUrl(path: string, base = APP_BASE): string {
  return base + path.replace(/^\//, '');
}

/** Converted files keep portable logical paths; resolve them only for display/fetch. */
export function resolveOriginalUrls<T>(value: T, base = APP_BASE): T {
  if (typeof value === 'string') return (/^\/(?:assets|maps)\//.test(value) ? appUrl(value, base) : value) as T;
  if (Array.isArray(value)) return value.map(item => resolveOriginalUrls(item, base)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveOriginalUrls(item, base)])) as T;
  return value;
}

export function scopedCache(name: string, base = APP_BASE): string {
  return base === '/' ? name : name + ':' + base;
}
