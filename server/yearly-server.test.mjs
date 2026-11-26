import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanAlerts, createServer, encrypt, openToken, sealToken, upstreamUrl, validSubscription, vapidAuthorization } from './yearly-server.mjs';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'yearly-'));
const ORIGIN = 'http://localhost:4200';

/** A server on a free port, with a fake clock and a sender that records instead of posting */
async function start({ google = { clientId: 'id', clientSecret: 'secret' } } = {}) {
  const sent = [];
  const googleCalls = [];
  const clock = { now: Date.UTC(2026, 10, 25, 9) };
  const app = createServer({
    dataDir: tempDir(),
    origins: [ORIGIN],
    now: () => clock.now,
    send: async (subscription, payload) => {
      sent.push({ endpoint: subscription.endpoint, payload });
      return subscription.endpoint.endsWith('gone') ? 410 : 201;
    },
    google,
    // A fake Google: codes "good" and "noRefresh" succeed, refresh token "revoked" is refused
    googleRequest: async (url, params) => {
      googleCalls.push({ url, params });
      if (url.endsWith('/revoke')) return { status: 200, body: {} };
      if (params.grant_type === 'authorization_code') {
        if (params.code === 'good') return { status: 200, body: { access_token: 'a1', expires_in: 3599, refresh_token: 'r1' } };
        if (params.code === 'noRefresh') return { status: 200, body: { access_token: 'a1', expires_in: 3599 } };
        return { status: 400, body: { error: 'invalid_grant' } };
      }
      if (params.refresh_token === 'revoked') return { status: 400, body: { error: 'invalid_grant' } };
      return { status: 200, body: { access_token: 'a2', expires_in: 3599 } };
    },
  });
  await new Promise((resolve) => app.server.listen(0, resolve));
  const base = `http://localhost:${app.server.address().port}`;
  const call = (method, url, { token, body, origin = ORIGIN, headers = {} } = {}) =>
    fetch(base + url, {
      method,
      headers: { Origin: origin, ...headers, ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
  return { app, sent, googleCalls, clock, call, close: () => app.server.close() };
}

const subscription = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
});

test('only allow-listed hosts are forwarded', () => {
  assert.equal(upstreamUrl('/api.football-data.org/v4/matches?dateFrom=2026-11-28'), 'https://api.football-data.org/v4/matches?dateFrom=2026-11-28');
  assert.equal(upstreamUrl('/evil.example.com/steal'), null);
  assert.equal(upstreamUrl('/'), null);
});

test('rejects other origins and methods, answers preflight', async () => {
  const { call, close } = await start();
  try {
    assert.equal((await call('GET', '/api.football-data.org/v4/matches', { origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('POST', '/api.football-data.org/v4/matches')).status, 405);
    const preflight = await call('OPTIONS', '/push/devices/x');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
    assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);
    assert.equal((await call('GET', '/evil.example.com/x')).status, 404);
  } finally {
    close();
  }
});

test('encrypts exactly like the example in RFC 8291', () => {
  const header =
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
  const ciphertext = '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ';
  const message = encrypt('When I grow up, I want to be a watermelon', subscription().keys, {
    asPrivate: Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'),
    salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'),
  });
  assert.deepEqual(message, Buffer.concat([Buffer.from(header, 'base64url'), Buffer.from(ciphertext, 'base64url')]));
});

test('signs a VAPID token the push service can check', () => {
  const app = createServer({ dataDir: tempDir(), origins: [ORIGIN] });
  app.server.close();
  const auth = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', app.vapid, 'https://yearly.example', Date.UTC(2026, 0, 1));
  const [, token, key] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  const [header, claims, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { aud: 'https://fcm.googleapis.com', exp: 1767225600 + 12 * 3600, sub: 'https://yearly.example' });
  const raw = Buffer.from(key, 'base64url');
  const publicKey = crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') },
    format: 'jwk',
  });
  assert.ok(crypto.verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
});

test('accepts only real push services and sane alerts', () => {
  assert.ok(validSubscription(subscription()));
  assert.ok(validSubscription(subscription('https://web.push.apple.com/abc')));
  assert.ok(!validSubscription(subscription('https://evil.example/fcm')));
  assert.ok(!validSubscription(subscription('http://fcm.googleapis.com/x')));
  assert.ok(!validSubscription({ ...subscription(), keys: { p256dh: 'short', auth: 'x' } }));

  const now = Date.UTC(2026, 10, 25, 9);
  const alerts = cleanAlerts(
    [
      { id: 'b', at: now + 2 * 3600_000, title: 'Later', body: 'x', url: '//evil.example' },
      { id: 'a', at: now + 3600_000, title: 'Soon', body: 'x', url: '/home' },
      { id: 'past', at: now - 1, title: 'Past', body: 'x' },
      { id: 'far', at: now + 30 * 86_400_000, title: 'Far', body: 'x' },
    ],
    now
  );
  assert.deepEqual(alerts.map((a) => [a.id, a.url]), [['a', '/home'], ['b', '/home']]);
  assert.equal(cleanAlerts([{ id: 1 }], now), null);
  assert.equal(cleanAlerts('nope', now), null);
});

test('stores a device, sends its alerts when due, and guards it with its token', async () => {
  const { app, sent, clock, call, close } = await start();
  const id = 'device-1234567890ab';
  const token = 'secret-token-1234567890';
  try {
    assert.equal((await call('GET', '/push/key')).status, 200);
    const at = clock.now + 30 * 60_000;
    const body = { subscription: subscription(), alerts: [{ id: 'leave:1', at, title: 'Leave by 18:10', body: 'Theatre', url: '/home' }] };
    assert.equal((await call('PUT', `/push/devices/${id}`, { token, body })).status, 204);
    assert.equal((await call('PUT', `/push/devices/${id}`, { token: 'another-token-1234567890', body })).status, 403);
    assert.equal((await call('PUT', `/push/devices/${id}`, { body })).status, 401);

    await app.tick();
    assert.equal(sent.length, 0);
    clock.now = at;
    await app.tick();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].payload.notification.title, 'Leave by 18:10');
    assert.equal(app.devices()[id].alerts.length, 0);

    assert.equal((await call('POST', `/push/devices/${id}/test`, { token })).status, 204);
    assert.equal(sent[1].payload.notification.tag, 'yearly-test');
    assert.equal((await call('DELETE', `/push/devices/${id}`, { token })).status, 204);
    assert.equal(app.devices()[id], undefined);
  } finally {
    close();
  }
});

test('forgets a device its push service no longer knows', async () => {
  const { app, clock, call, close } = await start();
  const id = 'device-gone-12345678';
  try {
    const body = { subscription: subscription('https://fcm.googleapis.com/fcm/send/gone'), alerts: [{ id: 'x', at: clock.now + 60_000, title: 't', body: 'b' }] };
    await call('PUT', `/push/devices/${id}`, { token: 'secret-token-1234567890', body });
    clock.now += 60_000;
    await app.tick();
    assert.equal(app.devices()[id], undefined);
  } finally {
    close();
  }
});

test('behind Apache, each visitor gets their own rate limit', async () => {
  const { call, close } = await start();
  const key = (visitor) => call('GET', '/push/key', { headers: { 'X-Forwarded-For': visitor } });
  try {
    for (let i = 0; i < 60; i++) await key('203.0.113.1');
    assert.equal((await key('203.0.113.1')).status, 429);
    assert.equal((await key('203.0.113.2')).status, 200);
  } finally {
    close();
  }
});

const VERIFIER = 'v'.repeat(43);

test('refresh tokens are sealed with the session secret', () => {
  const session = crypto.randomBytes(32).toString('base64url');
  const sealed = sealToken('r1', session);
  assert.equal(openToken(sealed, session), 'r1');
  assert.equal(openToken(sealed, crypto.randomBytes(32).toString('base64url')), null);
  assert.ok(!sealed.includes('r1'));
});

test('signs in once, then hands out fresh access tokens until logged out', async () => {
  const { app, googleCalls, call, close } = await start();
  try {
    const signIn = await call('POST', '/auth/token', { body: { code: 'good', redirectUri: `${ORIGIN}/`, codeVerifier: VERIFIER } });
    assert.equal(signIn.status, 200);
    const { session, accessToken, expiresIn } = await signIn.json();
    assert.deepEqual([accessToken, expiresIn], ['a1', 3599]);
    assert.equal(googleCalls[0].params.client_secret, 'secret');
    assert.equal(googleCalls[0].params.code_verifier, VERIFIER);
    // Only the hash of the secret and the sealed token are kept
    const [[key, stored]] = Object.entries(app.sessions());
    assert.notEqual(key, session);
    assert.ok(!JSON.stringify(stored).includes('r1'));

    const refresh = await call('POST', '/auth/refresh', { token: session });
    assert.equal(refresh.status, 200);
    assert.equal((await refresh.json()).accessToken, 'a2');
    assert.equal(googleCalls[1].params.refresh_token, 'r1');

    assert.equal((await call('POST', '/auth/refresh', { token: 'x'.repeat(43) })).status, 401);
    assert.equal((await call('POST', '/auth/logout', { token: session })).status, 204);
    assert.equal(googleCalls[2].params.token, 'r1');
    assert.equal((await call('POST', '/auth/refresh', { token: session })).status, 401);
  } finally {
    close();
  }
});

test('refuses bad sign-ins and forgets sessions Google revoked', async () => {
  const { app, call, close } = await start();
  try {
    const signIn = (body) => call('POST', '/auth/token', { body: { code: 'good', redirectUri: `${ORIGIN}/`, codeVerifier: VERIFIER, ...body } });
    assert.equal((await signIn({ redirectUri: 'https://evil.example/' })).status, 400);
    assert.equal((await signIn({ codeVerifier: 'short' })).status, 400);
    assert.equal((await signIn({ code: 'wrong' })).status, 400);
    const noRefresh = await signIn({ code: 'noRefresh' });
    assert.deepEqual([noRefresh.status, await noRefresh.json()], [400, { error: 'no_refresh_token' }]);
    assert.equal((await call('POST', '/auth/token', { origin: 'https://evil.example', body: {} })).status, 403);

    const session = crypto.randomBytes(32).toString('base64url');
    const key = crypto.createHash('sha256').update(session).digest('hex');
    app.sessions()[key] = { sealed: sealToken('revoked', session), usedAt: Date.now() };
    assert.equal((await call('POST', '/auth/refresh', { token: session })).status, 401);
    assert.equal(app.sessions()[key], undefined);
  } finally {
    close();
  }
});

test('sign-in answers 503 without the client secret', async () => {
  const { call, close } = await start({ google: {} });
  try {
    const response = await call('POST', '/auth/token', { body: {} });
    assert.deepEqual([response.status, await response.json()], [503, { error: 'not_configured' }]);
  } finally {
    close();
  }
});

test('unused sessions expire', async () => {
  const { app, clock, close } = await start();
  try {
    app.sessions().old = { sealed: '', usedAt: clock.now - 181 * 24 * 3600 * 1000 };
    app.sessions().recent = { sealed: '', usedAt: clock.now - 24 * 3600 * 1000 };
    await app.tick();
    assert.deepEqual(Object.keys(app.sessions()), ['recent']);
  } finally {
    close();
  }
});
