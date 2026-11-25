import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { PROVIDERS, ProviderId, periodKey, periodResetDate } from './integrations';

interface UsageEntry {
  period: string;
  count: number;
  limitReached?: boolean;
}

interface CacheEntry {
  at: number;
  data: unknown;
}

export interface Usage {
  count: number;
  limit?: number;
  limitReached: boolean;
  resetsOn: Date;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Saves the response under this key and reuses it while it's younger than ttlMs */
  cacheKey?: string;
  ttlMs?: number;
  /** Sends the request even after the provider reported its limit; a success clears the flag */
  ignoreLimit?: boolean;
}

// Kept apart from 'settings' so keys never travel with other settings
const KEYS = 'apiKeys';
const USAGE = 'apiUsage';
// shortcut: cache entries are never evicted; add eviction if localStorage nears its ~5 MB limit
const CACHE = 'apiCache';

function load<T>(name: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(name) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function save(name: string, value: object) {
  localStorage.setItem(name, JSON.stringify(value));
}

function errorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) return 'Request failed.';
  if (err.status === 0) return 'The browser could not reach this service (blocked or offline).';
  if (err.status === 401 || err.status === 403) return 'The key was rejected.';
  return `Request failed (${err.status}).`;
}

@Injectable()
export class IntegrationsService {
  constructor(private http: HttpClient) {}

  /** Overridable in tests */
  now = () => new Date();

  getKey(id: ProviderId): string | null {
    return load<string>(KEYS)[id] ?? null;
  }

  hasKey = (id: ProviderId) => this.getKey(id) != null;

  setKey(id: ProviderId, key: string) {
    const keys = load<string>(KEYS);
    key = key.trim();
    if (key) keys[id] = key;
    else delete keys[id];
    save(KEYS, keys);
  }

  usage(id: ProviderId): Usage {
    const provider = this.provider(id);
    const now = this.now();
    const entry = this.usageEntry(id, now);
    return {
      count: entry.count,
      limit: provider.limit,
      limitReached: entry.limitReached ?? false,
      resetsOn: periodResetDate(provider.period, now),
    };
  }

  /** GET through the shared cache and usage counter; falls back to a stale cached copy when the request fails */
  async request<T>(id: ProviderId, url: string, options: RequestOptions = {}): Promise<T> {
    const cached = options.cacheKey ? load<CacheEntry>(CACHE)[options.cacheKey] : undefined;
    if (cached && options.ttlMs != null && this.now().getTime() - cached.at < options.ttlMs) return cached.data as T;

    if (this.usage(id).limitReached && !options.ignoreLimit) {
      if (cached) return cached.data as T;
      throw 'Free limit reached for this period.';
    }

    this.updateUsage(id, (entry) => entry.count++);
    try {
      const data = await lastValueFrom(this.http.get<T>(url, { headers: options.headers }));
      if (this.usage(id).limitReached) this.updateUsage(id, (entry) => delete entry.limitReached);
      if (options.cacheKey) {
        const cache = load<CacheEntry>(CACHE);
        cache[options.cacheKey] = { at: this.now().getTime(), data };
        save(CACHE, cache);
      }
      return data;
    } catch (err) {
      const limited = err instanceof HttpErrorResponse && err.status === 429;
      if (limited) this.updateUsage(id, (entry) => (entry.limitReached = true));
      if (cached) return cached.data as T;
      throw limited ? 'Free limit reached for this period.' : errorMessage(err);
    }
  }

  /** Sends the provider's test request; throws a readable message on failure */
  async test(id: ProviderId): Promise<void> {
    const key = this.getKey(id);
    const provider = this.provider(id);
    if (key == null) throw 'Add a key first.';
    if (provider.test == null) throw provider.testNote ?? "This key can't be tested from the browser.";
    const { url, headers } = provider.test(key);
    await this.request(id, url, { headers, ignoreLimit: true });
  }

  private provider(id: ProviderId) {
    return PROVIDERS.find((p) => p.id === id)!;
  }

  private usageEntry(id: ProviderId, now: Date): UsageEntry {
    const current = periodKey(this.provider(id).period, now);
    const entry = load<UsageEntry>(USAGE)[id];
    return entry?.period === current ? entry : { period: current, count: 0 };
  }

  private updateUsage(id: ProviderId, change: (entry: UsageEntry) => void) {
    const all = load<UsageEntry>(USAGE);
    const entry = this.usageEntry(id, this.now());
    change(entry);
    all[id] = entry;
    save(USAGE, all);
  }
}
