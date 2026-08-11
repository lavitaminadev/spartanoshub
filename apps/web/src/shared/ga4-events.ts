export function trackGa4Event(
  measurementId: string | null | undefined,
  eventName: string,
  params: Record<string, unknown> = {},
) {
  if (!measurementId || !window.gtag) return;
  window.gtag('event', eventName, { send_to: measurementId, ...params });
}
