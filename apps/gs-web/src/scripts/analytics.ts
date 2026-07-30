export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

export type TrackOptions = {
  debounceKey?: string;
  debounceMs?: number;
};

type AnalyticsState = {
  debounceMap: Map<string, number>;
  firedOnce: Set<string>;
};

declare global {
  interface Window {
    __gsAnalyticsState?: AnalyticsState;
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

const getState = (): AnalyticsState => {
  if (!window.__gsAnalyticsState) {
    window.__gsAnalyticsState = {
      debounceMap: new Map(),
      firedOnce: new Set(),
    };
  }

  return window.__gsAnalyticsState;
};

export const trackEvent = (
  eventName: string,
  payload: AnalyticsPayload = {},
  options: TrackOptions = {},
): boolean => {
  const state = getState();
  const debounceWindowMs = options.debounceMs ?? 1000;
  const debounceKey = options.debounceKey ?? `${eventName}:${JSON.stringify(payload)}`;
  const now = Date.now();
  const lastFiredAt = state.debounceMap.get(debounceKey);

  if (typeof lastFiredAt === 'number' && now - lastFiredAt < debounceWindowMs) {
    return false;
  }

  state.debounceMap.set(debounceKey, now);

  const eventPayload = {
    event: eventName,
    ...payload,
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload);
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload);
  }

  window.dispatchEvent(new CustomEvent('gs:analytics', { detail: eventPayload }));
  return true;
};

export const trackEventOnce = (
  onceKey: string,
  eventName: string,
  payload: AnalyticsPayload = {},
): boolean => {
  const state = getState();

  if (state.firedOnce.has(onceKey)) {
    return false;
  }

  state.firedOnce.add(onceKey);
  return trackEvent(eventName, payload, { debounceKey: onceKey, debounceMs: Number.MAX_SAFE_INTEGER });
};
