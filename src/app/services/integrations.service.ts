import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject, lastValueFrom } from 'rxjs';
import { PROVIDERS, ProviderId, periodKey, periodResetDate } from './integrations';
import { KeyMap, SyncFile, UsageEntry, UsageMap } from './sync';
import { UtilService } from './util.service';

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
  /** Sends a JSON POST with this body instead of a GET */
  body?: unknown;
}

// Kept apart from 'settings' so keys never travel with other settings
const KEYS = 'apiKeys';
const USAGE = 'apiUsage';
/** Other devices' usage, as of the last sync */
const OTHER_USAGE = 'apiUsageOtherDevices';
const DEVICE_ID = 'deviceId';
const CACHE = 'apiCache';
const CACHE_MAX_AGE = 31 * 24 * 60 * 60 * 1000;

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
  if (typeof err === 'string') return err;
  if (!(err instanceof HttpErrorResponse)) return 'Request failed.';
  if (err.status === 0) return 'The browser could not reach this service (blocked or offline).';
  // The services word their own errors: Google and Aviationstack under error.message, football-data under message
  const detail = err.error?.error?.message ?? err.error?.message ?? err.error?.fault?.faultstring;
  if (err.status === 401 || err.status === 403) return detail ? `The key was rejected: ${detail}` : 'The key was rejected.';
  return detail ? `${detail} (${err.status})` : `Request failed (${err.status}).`;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private http: HttpClient,
    private utilService: UtilService
  ) {}

  /** Overridable in tests */
  now = () => new Date();

  /** Fires when keys or usage change, so they can be synced */
  readonly changed = new Subject<void>();

  readonly deviceId: string = (() => {
    let id = localStorage.getItem(DEVICE_ID);
    if (id == null) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID, id);
    }
    return id;
  })();

  getKey(id: ProviderId): string | null {
    return load<KeyMap[ProviderId]>(KEYS)[id]?.value || null;
  }

  hasKey = (id: ProviderId) => this.getKey(id) != null;

  /** Key set, and the service is reachable: some need the Yearly pass-through server */
  canUse = (id: ProviderId) => this.hasKey(id) && (this.provider(id).server !== 'always' || !!this.utilService.serverUrl);

  /** Why a provider with a key still can't be used, if so */
  serverMissing(id: ProviderId) {
    return this.provider(id).server === 'always' && !this.utilService.serverUrl;
  }

  setKey(id: ProviderId, key: string) {
    const keys = load<KeyMap[ProviderId]>(KEYS);
    keys[id] = { value: key.trim(), at: this.now().getTime() };
    save(KEYS, keys);
    this.changed.next();
  }

  /** Usage across every synced device */
  usage(id: ProviderId): Usage {
    const provider = this.provider(id);
    const now = this.now();
    const current = periodKey(provider.period, now);
    const entries = [this.usageEntry(id, now), ...Object.values(load<UsageMap>(OTHER_USAGE)).map((usage) => usage[id])]
      .filter((entry): entry is UsageEntry => entry?.period === current);
    return {
      count: entries.reduce((sum, entry) => sum + entry.count, 0),
      limit: provider.limit,
      limitReached: entries.some((entry) => entry.limitReached),
      resetsOn: periodResetDate(provider.period, now),
    };
  }

  /** GET (or POST with body) through the shared cache and usage counter; falls back to a stale cached copy when it fails */
  async request<T>(id: ProviderId, url: string, options: RequestOptions = {}): Promise<T> {
    const cached = this.cached(options.cacheKey);
    if (cached && options.ttlMs != null && this.now().getTime() - cached.at < options.ttlMs) return cached.data as T;

    if (this.usage(id).limitReached && !options.ignoreLimit) {
      if (cached) return cached.data as T;
      throw 'Free limit reached for this period.';
    }

    this.updateUsage(id, (entry) => entry.count++);
    try {
      const data = await this.send<T>(id, url, options);
      if (this.usageEntry(id, this.now()).limitReached) this.updateUsage(id, (entry) => delete entry.limitReached);
      this.store(options.cacheKey, data);
      return data;
    } catch (err) {
      const limited = err instanceof HttpErrorResponse && err.status === 429;
      // Google names the quota it hit; a per-minute one clears by itself, so it mustn't pause the service all day
      const body = limited ? JSON.stringify(err.error ?? '') : '';
      const perMinute = /PerMinute/.test(body) && !/PerDay/.test(body);
      if (limited && !perMinute) this.updateUsage(id, (entry) => (entry.limitReached = true));
      if (cached) return cached.data as T;
      if (perMinute) throw `Too many requests this minute. Try again in ${body.match(/"retryDelay":"(\d+)/)?.[1] ?? 60} seconds.`;
      throw limited ? 'Free limit reached for this period.' : errorMessage(err);
    }
  }

  /** Goes straight to the service, or through the Yearly pass-through when the browser can't reach it */
  private async send<T>(id: ProviderId, url: string, options: RequestOptions): Promise<T> {
    const request = (target: string) =>
      lastValueFrom(
        options.body === undefined
          ? this.http.get<T>(target, { headers: options.headers })
          : this.http.post<T>(target, options.body, { headers: options.headers })
      );
    const viaServer = () => request(`${this.utilService.serverUrl}/${url.replace(/^https:\/\//, '')}`);
    const server = this.provider(id).server;
    if (server === 'always') {
      if (!this.utilService.serverUrl) throw "Needs the Yearly server, which isn't set up.";
      return viaServer();
    }
    try {
      return await request(url);
    } catch (err) {
      // status 0: the browser refused (CORS) or the network failed
      if (server === 'fallback' && this.utilService.serverUrl && err instanceof HttpErrorResponse && err.status === 0) return viaServer();
      throw err;
    }
  }

  /** GET for services that need no key: cached, not counted; falls back to a stale copy on failure */
  async fetchCached<T>(url: string, cacheKey: string, ttlMs: number): Promise<T> {
    const cached = this.cached(cacheKey);
    if (cached && this.now().getTime() - cached.at < ttlMs) return cached.data as T;
    try {
      const data = await lastValueFrom(this.http.get<T>(url));
      this.store(cacheKey, data);
      return data;
    } catch (err) {
      if (cached) return cached.data as T;
      throw errorMessage(err);
    }
  }

  /** When the cached copy was saved (ms), to show "updated 5 min ago" */
  cachedAt(cacheKey: string): number | undefined {
    return this.cached(cacheKey)?.at;
  }

  /** Sends the provider's test request; throws a readable message on failure */
  async test(id: ProviderId): Promise<void> {
    const key = this.getKey(id);
    const provider = this.provider(id);
    if (key == null) throw 'Add a key first.';
    if (provider.test == null) throw "This key can't be tested from the browser.";
    const { url, headers } = provider.test(key);
    await this.request(id, url, { headers, ignoreLimit: true });
  }

  /** This device's keys and usage, in the synced file's shape */
  syncData(): SyncFile {
    return { keys: load(KEYS), usage: { [this.deviceId]: load<UsageEntry>(USAGE) } };
  }

  /** Applies a merged sync file: keys from every device, and other devices' usage */
  applySync(file: SyncFile) {
    save(KEYS, file.keys);
    const others = { ...file.usage };
    delete others[this.deviceId];
    save(OTHER_USAGE, others);
  }

  private cached(cacheKey?: string): CacheEntry | undefined {
    return cacheKey ? load<CacheEntry>(CACHE)[cacheKey] : undefined;
  }

  private store(cacheKey: string | undefined, data: unknown) {
    if (!cacheKey) return;
    const cache = load<CacheEntry>(CACHE);
    const now = this.now().getTime();
    // Nothing is cached for longer than a month, so older entries are dead weight
    for (const [key, entry] of Object.entries(cache)) if (now - entry.at > CACHE_MAX_AGE) delete cache[key];
    cache[cacheKey] = { at: now, data };
    save(CACHE, cache);
  }

  private provider(id: ProviderId) {
    return PROVIDERS.find((p) => p.id === id)!;
  }

  /** This device's entry for the current period */
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
    this.changed.next();
  }
}
