type TrackEventOptions = {
  debounceKey?: string;
  debounceMs?: number;
};

const lastTrackedAt = new Map<string, number>();

export function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  options: TrackEventOptions = {},
): void {
  if (!eventName) return;

  const now = Date.now();
  if (options.debounceKey) {
    const previous = lastTrackedAt.get(options.debounceKey) ?? 0;
    if (now - previous < (options.debounceMs ?? 0)) return;
    lastTrackedAt.set(options.debounceKey, now);
  }

  const payload = {
    event: eventName,
    properties,
    timestamp: new Date(now).toISOString(),
  };

  window.dispatchEvent(new CustomEvent('gs:analytics', { detail: payload }));

  const dataLayer = (window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
  }).dataLayer;
  dataLayer?.push(payload);
}
