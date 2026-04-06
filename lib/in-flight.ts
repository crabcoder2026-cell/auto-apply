import { useSyncExternalStore } from 'react';

/** Tracks client-side async work so UI stays "busy" after navigation away and back. */
const inflight = new Map<string, Promise<unknown>>();
const metaByKey = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type RunInFlightOptions = {
  /** Optional label (e.g. job URL for per-row apply feedback) */
  meta?: string;
};

/**
 * Runs `fn` under `key`. If the same key is already running, returns the existing promise
 * (no duplicate network work). Survives React unmount/remount (e.g. route changes).
 */
export function runInFlight<T>(
  key: string,
  fn: () => Promise<T>,
  options?: RunInFlightOptions
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  if (options?.meta !== undefined) {
    metaByKey.set(key, options.meta);
  }

  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
      metaByKey.delete(key);
      emit();
    }
  })();

  inflight.set(key, p);
  emit();
  return p as Promise<T>;
}

export function isInFlight(key: string): boolean {
  return inflight.has(key);
}

export function getInFlightMeta(key: string): string | undefined {
  return metaByKey.get(key);
}

export function useInFlight(key: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (key ? inflight.has(key) : false),
    () => false
  );
}

export function useInFlightMeta(key: string): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => metaByKey.get(key),
    () => undefined
  );
}

export function useInFlightPrefix(prefix: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => [...inflight.keys()].some((k) => k.startsWith(prefix)),
    () => false
  );
}

/** Keys that should show the global sticky banner (long / important operations). */
export const IN_FLIGHT_BANNER_KEYS = [
  'apply:single',
  'apply:batch',
  'apply:auto',
  'watch:run',
  'watch:save',
  'template:save',
  'template:upload',
  'template:imap-test',
] as const;

export function useInFlightBannerVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => IN_FLIGHT_BANNER_KEYS.some((k) => inflight.has(k)),
    () => false
  );
}

export function useInFlightBannerMessage(): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (inflight.has('apply:single')) return 'Single job apply is still running…';
      if (inflight.has('apply:batch')) return 'Batch apply is still running…';
      if (inflight.has('apply:auto')) {
        const u = metaByKey.get('apply:auto');
        return u
          ? `Applying to a job is still in progress… (${u.length > 64 ? `${u.slice(0, 64)}…` : u})`
          : 'Applying to a job is still in progress…';
      }
      if (inflight.has('watch:run')) return 'Auto pilot run is still in progress…';
      if (inflight.has('watch:save')) return 'Saving Auto pilot settings…';
      if (inflight.has('template:save')) return 'Saving your template…';
      if (inflight.has('template:upload')) return 'Uploading your resume…';
      if (inflight.has('template:imap-test')) return 'Testing email connection…';
      return '';
    },
    () => ''
  );
}
