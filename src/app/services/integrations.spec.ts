import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Feature, ProviderId, canToggle, featureStatus, missingKeys, periodKey, periodResetDate } from './integrations';
import { IntegrationsService } from './integrations.service';
import { UtilService } from './util.service';

const feature = (keys: ProviderId[][], extra: Partial<Feature> = {}): Feature => ({
  id: 'f',
  name: 'F',
  description: '',
  keys,
  available: true,
  ...extra,
});

describe('featureStatus', () => {
  const has = (...ids: ProviderId[]) => (id: ProviderId) => ids.includes(id);

  it('needs every group but only one key per group', () => {
    const crowd = feature([['ticketmaster'], ['tomtom']]);
    expect(featureStatus(crowd, true, has('tomtom'))).toBe('needs-key');
    expect(missingKeys(crowd, has('tomtom'))).toEqual([['ticketmaster']]);
    expect(featureStatus(crowd, true, has('tomtom', 'ticketmaster'))).toBe('ready');
    expect(featureStatus(feature([['ticketmaster', 'footballdata']]), true, has('footballdata'))).toBe('ready');
  });

  it('runs in basic form without optional keys, and reports off and coming soon first', () => {
    const flights = feature([], { optionalKeys: [['aviationstack']], basic: 'basic' });
    expect(featureStatus(flights, true, has())).toBe('basic');
    expect(featureStatus(flights, true, has('aviationstack'))).toBe('ready');
    const crowd = feature([['ticketmaster']], { optionalKeys: [['tomtom']], basic: 'basic' });
    expect(featureStatus(crowd, true, has('tomtom'))).toBe('needs-key');
    expect(featureStatus(crowd, true, has('ticketmaster'))).toBe('basic');
    expect(featureStatus(flights, false, has('aviationstack'))).toBe('off');
    expect(featureStatus({ ...flights, available: false }, true, has('aviationstack'))).toBe('soon');
    expect(featureStatus(feature([]), true, has())).toBe('ready');
  });

  it('locks features whose keys are missing, even when switched off', () => {
    const ask = feature([['gemini']]);
    expect(featureStatus(ask, false, has())).toBe('needs-key');
    expect(canToggle('needs-key')).toBeFalse();
    expect(canToggle('soon')).toBeFalse();
    expect(featureStatus(ask, false, has('gemini'))).toBe('off');
    expect(canToggle('off')).toBeTrue();
    expect(canToggle('basic')).toBeTrue();
  });
});

describe('usage periods', () => {
  const date = new Date(Date.UTC(2026, 11, 31, 23, 30));

  it('keys and resets by UTC day and month', () => {
    expect(periodKey('day', date)).toBe('2026-12-31');
    expect(periodKey('month', date)).toBe('2026-12');
    expect(periodResetDate('day', date).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(periodResetDate('month', date).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let http: HttpTestingController;
  let now: Date;

  let serverUrl = '';

  beforeEach(() => {
    localStorage.clear();
    serverUrl = '';
    TestBed.configureTestingModule({
      providers: [
        IntegrationsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UtilService, useValue: { get serverUrl() { return serverUrl; } } },
      ],
    });
    service = TestBed.inject(IntegrationsService);
    http = TestBed.inject(HttpTestingController);
    now = new Date(Date.UTC(2026, 10, 25, 12));
    service.now = () => now;
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('stores trimmed keys and removes empty ones', () => {
    service.setKey('tomtom', '  abc ');
    expect(service.getKey('tomtom')).toBe('abc');
    service.setKey('tomtom', ' ');
    expect(service.hasKey('tomtom')).toBeFalse();
  });

  it('counts only network requests and reuses fresh cache', async () => {
    const first = service.request('aviationstack', '/flight', { cacheKey: 'FR1:2026-11-25', ttlMs: 3_600_000 });
    http.expectOne('/flight').flush({ status: 'scheduled' });
    expect(await first).toEqual({ status: 'scheduled' });

    now = new Date(now.getTime() + 30 * 60_000);
    expect(await service.request('aviationstack', '/flight', { cacheKey: 'FR1:2026-11-25', ttlMs: 3_600_000 })).toEqual({
      status: 'scheduled',
    });
    expect(service.usage('aviationstack').count).toBe(1);
  });

  it('resets the count in a new period', async () => {
    const req = service.request('tomtom', '/route');
    http.expectOne('/route').flush({});
    await req;
    now = new Date(Date.UTC(2026, 10, 26, 0, 1));
    expect(service.usage('tomtom').count).toBe(0);
  });

  it('marks the limit on 429, serves stale cache, and stops sending', async () => {
    const seed = service.request('aviationstack', '/flight', { cacheKey: 'k', ttlMs: 0 });
    http.expectOne('/flight').flush({ status: 'old' });
    await seed;

    const limited = service.request('aviationstack', '/flight', { cacheKey: 'k', ttlMs: 0 });
    http.expectOne('/flight').flush({}, { status: 429, statusText: 'Too Many Requests' });
    expect(await limited).toEqual({ status: 'old' });
    expect(service.usage('aviationstack').limitReached).toBeTrue();

    expect(await service.request('aviationstack', '/flight', { cacheKey: 'k', ttlMs: 0 })).toEqual({ status: 'old' });
    await expectAsync(service.request('aviationstack', '/other')).toBeRejectedWith('Free limit reached for this period.');
    expect(service.usage('aviationstack').count).toBe(2);
  });

  it('treats a per-minute 429 as a wait, not a used-up day', async () => {
    const request = service.request('gemini', '/ask');
    const body = { error: { details: [{ violations: [{ quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' }] }, { retryDelay: '37s' }] } };
    http.expectOne('/ask').flush(body, { status: 429, statusText: 'Too Many Requests' });
    await expectAsync(request).toBeRejectedWith('Too many requests this minute. Try again in 37 seconds.');
    expect(service.usage('gemini').limitReached).toBeFalse();
  });

  it('lets a test through after the limit and clears it on success', async () => {
    service.setKey('tomtom', 'k1');
    const limited = service.request('tomtom', '/route');
    http.expectOne('/route').flush({}, { status: 429, statusText: 'Too Many Requests' });
    await expectAsync(limited).toBeRejected();

    const test = service.test('tomtom');
    http.expectOne((r) => r.url.startsWith('https://api.tomtom.com/') && r.url.includes('key=k1')).flush({});
    await test;
    expect(service.usage('tomtom').limitReached).toBeFalse();
  });

  it('explains rejected keys and providers that cannot be tested', async () => {
    service.setKey('ticketmaster', 'bad');
    const test = service.test('ticketmaster');
    http.expectOne((r) => r.url.includes('apikey=bad')).flush({}, { status: 401, statusText: 'Unauthorized' });
    await expectAsync(test).toBeRejectedWith('The key was rejected.');
    await expectAsync(service.test('gemini')).toBeRejectedWith('Add a key first.');

    const gemini = service.request('gemini', '/models');
    http.expectOne('/models').flush({ error: { message: 'API key not valid.' } }, { status: 400, statusText: 'Bad Request' });
    await expectAsync(gemini).toBeRejectedWith('API key not valid. (400)');
  });

  it('sends server-only services through the pass-through, and only when it is set up', async () => {
    service.setKey('footballdata', 't');
    expect(service.canUse('footballdata')).toBeFalse();
    await expectAsync(service.request('footballdata', 'https://api.football-data.org/v4/matches')).toBeRejectedWith(
      jasmine.stringContaining('Yearly server')
    );

    serverUrl = 'https://proxy.example';
    expect(service.canUse('footballdata')).toBeTrue();
    const viaServer = service.request('footballdata', 'https://api.football-data.org/v4/matches', { headers: { 'X-Auth-Token': 't' } });
    const req = http.expectOne('https://proxy.example/api.football-data.org/v4/matches');
    expect(req.request.headers.get('X-Auth-Token')).toBe('t');
    req.flush({ matches: [] });
    expect(await viaServer).toEqual({ matches: [] });
  });

  it('retries blocked fallback services through the pass-through, and POSTs bodies', async () => {
    serverUrl = 'https://proxy.example';
    const tm = service.request('ticketmaster', 'https://app.ticketmaster.com/discovery/v2/events.json?apikey=k');
    http.expectOne('https://app.ticketmaster.com/discovery/v2/events.json?apikey=k').error(new ProgressEvent('error'), { status: 0 });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('https://proxy.example/app.ticketmaster.com/discovery/v2/events.json?apikey=k').flush({ ok: true });
    expect(await tm).toEqual({ ok: true });

    const post = service.request('gemini', '/generate', { body: { q: 1 } });
    const req = http.expectOne('/generate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ q: 1 });
    req.flush({});
    await post;
  });
});
