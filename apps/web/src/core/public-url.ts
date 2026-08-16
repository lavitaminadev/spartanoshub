const configuredPublicOrigin = String(
  import.meta.env.VITE_APP_PUBLIC_URL
    || (import.meta.env.PROD ? 'https://cuartel.espartanos.cl' : ''),
).trim().replace(/\/$/, '');

if (import.meta.env.PROD && configuredPublicOrigin && !configuredPublicOrigin.startsWith('https://')) {
  throw new Error('VITE_APP_PUBLIC_URL must use https:// in production');
}

export const APP_PUBLIC_ORIGIN = configuredPublicOrigin || window.location.origin;
export const APP_PUBLIC_URL_CONFIGURED = Boolean(configuredPublicOrigin);
export const APP_PUBLIC_URL_IS_HTTPS = APP_PUBLIC_ORIGIN.startsWith('https://');

export function publicAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${APP_PUBLIC_ORIGIN}${normalizedPath}`;
}

export function publicReservationUrl(publicSlug: string, apiPublicUrl?: string): string {
  if (apiPublicUrl?.startsWith('https://')) return apiPublicUrl;
  return publicAppUrl(`/book/${publicSlug}`);
}

export function publicSurveyUrl(id: string, apiPublicUrl?: string, source?: string): string {
  const baseUrl = apiPublicUrl?.startsWith('https://') ? apiPublicUrl : publicAppUrl(`/survey/${id}`);
  if (!source) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('source', source);
  url.searchParams.set('utm_source', source);
  return url.toString();
}
