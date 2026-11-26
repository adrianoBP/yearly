// Yearly server: two small jobs for the Yearly web app, no dependencies (Node 18+).
//
// 1. Pass-through: forwards GET requests to free APIs that browsers can't call directly (no CORS).
//    It stores and logs nothing; each user's own key travels in their request.
//      GET /<host>/<path>?<query>   e.g. /api.football-data.org/v4/matches?dateFrom=2026-11-28&dateTo=2026-11-28
//
// 2. Notifications: each device sends the alerts the app worked out for the next few days; each one goes out
//    as a Web Push notification when due, then is deleted. No API keys reach this server.
//      GET    /push/key                 this server's public key, which the app subscribes with
//      PUT    /push/devices/<id>        { subscription, alerts: [{ id, at, title, body, url? }] } replaces the device's alerts
//      POST   /push/devices/<id>/test   sends a test notification now
//      DELETE /push/devices/<id>        forgets the device
//    A device's first PUT sets its secret (Authorization: Bearer <token>); later calls must send the same one.
//
// 3. Staying signed in: Google's browser sign-in lasts an hour, and renewing it needs the app's client secret,
//    which can't live in a browser. The server swaps a sign-in code for Google's long-lived refresh token and gives
//    the device a session secret instead. The refresh token is kept encrypted with a key made from that secret,
//    which only the device has, so the data folder alone can't be used to reach anyone's calendar.
//      POST /auth/token     { code, redirectUri, codeVerifier } → { session, accessToken, expiresIn }
//      POST /auth/refresh   Authorization: Bearer <session> → { accessToken, expiresIn }
//      POST /auth/logout    Authorization: Bearer <session>; revokes the refresh token at Google and forgets it
//    Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; without them these answer 503 and the app signs in for an hour.
//
// Run: PORT=8787 ALLOWED_ORIGINS=https://your-yearly-domain DATA_DIR=/var/lib/yearly node yearly-server.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200').split(',').map((o) => o.trim());
// systemd's StateDirectory= sets STATE_DIRECTORY
const DATA_DIR = process.env.DATA_DIR ?? process.env.STATE_DIRECTORY ?? './data';

/** Only these hosts, and only these request headers are passed on */
const UPSTREAMS = ['api.football-data.org', 'app.ticketmaster.com'];
const FORWARDED_HEADERS = ['x-auth-token'];
/** Per-IP requests per minute; the APIs themselves allow fewer, this only stops abuse of the server */
const RATE_LIMIT = 60;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_DEVICES = 1000;
const MAX_ALERTS = 50;
/** Alerts further ahead are ignored; the app sends a fresh list each time it opens */
const MAX_AHEAD = 8 * DAY;
/** A device that hasn't sent its alerts for this long is forgotten */
const DEVICE_EXPIRY = 60 * DAY;
const MAX_BODY = 64 * 1024;
const MAX_SESSIONS = 1000;
/** A session unused this long is forgotten; Google drops refresh tokens unused for six months anyway */
const SESSION_EXPIRY = 180 * DAY;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/** Notifications only go to the browsers' own push services, so this server can't be used to post anywhere else */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

const b64url = (data) => Buffer.from(data).toString('base64url');
const unb64url = (text) => Buffer.from(text, 'base64url');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest();

// ---- Pass-through ----

export function upstreamUrl(path) {
  const match = path.match(/^\/([^/]+)(\/.*)?$/);
  if (!match || !UPSTREAMS.includes(match[1])) return null;
  return `https://${match[1]}${match[2] ?? '/'}`;
}

async function passThrough(req, res) {
  const target = upstreamUrl(req.url ?? '');
  if (target == null) return res.writeHead(404).end();
  const headers = {};
  for (const name of FORWARDED_HEADERS) if (req.headers[name]) headers[name] = req.headers[name];
  try {
    const upstream = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(502).end();
  }
}

// ---- Web Push: RFC 8291 (encryption) and RFC 8292 (VAPID) ----

/** Encrypts a payload for one subscription as a single aes128gcm record. Tests pass asPrivate and salt. */
export function encrypt(payload, keys, { asPrivate, salt = crypto.randomBytes(16) } = {}) {
  const uaPublic = unb64url(keys.p256dh);
  const ecdh = crypto.createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const hkdf = (salt, ikm, info, length) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(unb64url(keys.auth), ecdh.computeSecret(uaPublic), keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 marks the last (and only) record
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

/** This server's key pair, made on first start and kept in the data folder */
export function loadVapid(dir) {
  const file = path.join(dir, 'vapid.json');
  let jwk;
  try {
    jwk = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    jwk = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
    writeJson(file, jwk);
  }
  return {
    privateKey: crypto.createPrivateKey({ key: jwk, format: 'jwk' }),
    publicKey: b64url(Buffer.concat([Buffer.from([4]), unb64url(jwk.x), unb64url(jwk.y)])),
  };
}

/** Signed proof, per push service, that the notification comes from this server */
export function vapidAuthorization(endpoint, vapid, subject, now = Date.now()) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: vapid.privateKey, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${vapid.publicKey}`;
}

/** Sends one notification; resolves to the push service's status code */
export async function sendPush(subscription, payload, vapid, subject) {
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // Alerts are about the next hour; one that can't be delivered by then is no use
      TTL: '3600',
      Urgency: 'high',
    },
    body: encrypt(JSON.stringify(payload), subscription.keys),
    signal: AbortSignal.timeout(15_000),
  });
  return response.status;
}

/** The shape Angular's service worker shows as a notification; a tap opens Yearly at url */
export function notificationPayload(alert) {
  return {
    notification: {
      title: alert.title,
      body: alert.body,
      icon: '/icons/icon-192x192.png',
      tag: alert.id,
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: alert.url } } },
    },
  };
}

// ---- Validation at the boundary ----

export function validSubscription(subscription) {
  try {
    const url = new URL(subscription.endpoint);
    return (
      url.protocol === 'https:' &&
      PUSH_HOSTS.some((host) => host.test(url.hostname)) &&
      unb64url(subscription.keys.p256dh).length === 65 &&
      unb64url(subscription.keys.auth).length === 16
    );
  } catch {
    return false;
  }
}

/** The alerts to keep, trimmed; null when the list is malformed */
export function cleanAlerts(alerts, now) {
  if (!Array.isArray(alerts) || alerts.length > MAX_ALERTS) return null;
  const clean = [];
  for (const alert of alerts) {
    const { id, at, title, body, url } = alert ?? {};
    if (typeof id !== 'string' || typeof title !== 'string' || typeof body !== 'string' || !Number.isFinite(at)) return null;
    if (at <= now || at > now + MAX_AHEAD) continue;
    const path = typeof url === 'string' && /^\/(?!\/)/.test(url) ? url.slice(0, 200) : '/home';
    clean.push({ id: id.slice(0, 100), at, title: title.slice(0, 100), body: body.slice(0, 300), url: path });
  }
  return clean.sort((a, b) => a.at - b.at);
}

// ---- Sessions: refresh tokens encrypted with a key only the device's session secret gives ----

const sessionKey = (session) => Buffer.from(crypto.hkdfSync('sha256', unb64url(session), Buffer.alloc(0), 'yearly session', 32));

export function sealToken(refreshToken, session) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(session), iv);
  const sealed = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return b64url(Buffer.concat([iv, cipher.getAuthTag(), sealed]));
}

/** null when the secret doesn't match */
export function openToken(sealed, session) {
  try {
    const data = unb64url(sealed);
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(session), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Posts a form to Google's token endpoint; resolves to { status, body } */
async function googleTokenRequest(url, params) {
  const response = await fetch(url, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(15_000) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function writeJson(file, data) {
  // Write then rename, so a crash never leaves half a file
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw 413;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw 400;
  }
}

// ---- Server ----

/** The server plus its once-a-minute tick; tests pass their own folder, clock and sender */
export function createServer({
  dataDir = DATA_DIR,
  origins = ALLOWED_ORIGINS,
  subject = process.env.VAPID_SUBJECT ?? origins.find((o) => o.startsWith('https://')) ?? 'mailto:yearly@localhost',
  send = sendPush,
  now = Date.now,
  google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  googleRequest = googleTokenRequest,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const vapid = loadVapid(dataDir);
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return {}; // First start
    }
  };
  const devicesFile = path.join(dataDir, 'devices.json');
  const devices = readJson(devicesFile);
  const save = () => writeJson(devicesFile, devices);
  /** sha256(session secret) → { sealed refresh token, usedAt } */
  const sessionsFile = path.join(dataDir, 'sessions.json');
  const sessions = readJson(sessionsFile);
  const saveSessions = () => writeJson(sessionsFile, sessions);

  const hits = new Map();
  setInterval(() => hits.clear(), MINUTE).unref();

  /** Delivers one alert; a subscription the push service no longer knows is forgotten */
  async function deliver(id, alert) {
    const device = devices[id];
    let status = 0;
    try {
      status = await send(device.subscription, notificationPayload(alert), vapid, subject);
    } catch {
      // Network error: status stays 0
    }
    if ((status === 404 || status === 410) && devices[id] === device) delete devices[id];
    return status;
  }

  let ticking = false;
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const time = now();
      let changed = false;
      for (const [id, device] of Object.entries(devices)) {
        if (time - device.updatedAt > DEVICE_EXPIRY) {
          delete devices[id];
          changed = true;
          continue;
        }
        const due = device.alerts.filter((alert) => alert.at <= time);
        if (!due.length) continue;
        device.alerts = device.alerts.filter((alert) => alert.at > time);
        changed = true;
        for (const alert of due) {
          // Missed while the server was down: too late to help
          if (alert.at < time - HOUR) continue;
          // shortcut: a failed send isn't retried; add retries if push services turn out to be flaky
          await deliver(id, alert);
          if (!devices[id]) break;
        }
      }
      if (changed) save();
      const stale = Object.keys(sessions).filter((key) => time - sessions[key].usedAt > SESSION_EXPIRY);
      for (const key of stale) delete sessions[key];
      if (stale.length) saveSessions();
    } finally {
      ticking = false;
    }
  }

  const end = (res, status, data) => {
    if (data === undefined) return res.writeHead(status).end();
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
  };

  async function push(req, res, pathname) {
    if (pathname === '/push/key' && req.method === 'GET') return end(res, 200, { publicKey: vapid.publicKey });

    const match = pathname.match(/^\/push\/devices\/([A-Za-z0-9_-]{16,64})(\/test)?$/);
    if (!match) return end(res, 404);
    const [, id, test] = match;
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return end(res, 401);
    const device = devices[id];
    if (device && !crypto.timingSafeEqual(Buffer.from(device.tokenHash, 'hex'), sha256(token))) return end(res, 403);

    if (req.method === 'PUT' && !test) {
      let body;
      try {
        body = await readBody(req);
      } catch (status) {
        return end(res, status);
      }
      const alerts = cleanAlerts(body?.alerts, now());
      if (!validSubscription(body?.subscription) || alerts == null) return end(res, 400);
      if (!device && Object.keys(devices).length >= MAX_DEVICES) return end(res, 507);
      const { endpoint, keys } = body.subscription;
      devices[id] = {
        tokenHash: device?.tokenHash ?? sha256(token).toString('hex'),
        subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        alerts,
        updatedAt: now(),
      };
      save();
      return end(res, 204);
    }

    if (!device) return end(res, 404);

    if (req.method === 'POST' && test) {
      const status = await deliver(id, {
        id: 'yearly-test',
        title: 'Notifications are on',
        body: 'Yearly will warn you here when an event needs you to leave early or the weather turns.',
        url: '/settings',
      });
      if (!devices[id]) save();
      return end(res, status >= 200 && status < 300 ? 204 : 502, status >= 200 && status < 300 ? undefined : { status });
    }

    if (req.method === 'DELETE' && !test) {
      delete devices[id];
      save();
      return end(res, 204);
    }

    return end(res, 405);
  }

  async function auth(req, res, pathname, origin) {
    if (req.method !== 'POST') return end(res, 405);
    if (!google.clientId || !google.clientSecret) return end(res, 503, { error: 'not_configured' });
    const client = { client_id: google.clientId, client_secret: google.clientSecret };

    if (pathname === '/auth/token') {
      let body;
      try {
        body = await readBody(req);
      } catch (status) {
        return end(res, status);
      }
      const { code, redirectUri, codeVerifier } = body ?? {};
      // Only the app's own pages may finish a sign-in, and Google checks the same address against its list
      if (typeof code !== 'string' || code.length > 1000 || redirectUri !== `${origin}/`) return end(res, 400);
      if (typeof codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return end(res, 400);
      if (Object.keys(sessions).length >= MAX_SESSIONS) return end(res, 507);
      let answer;
      try {
        answer = await googleRequest(GOOGLE_TOKEN_URL, {
          ...client,
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });
      } catch {
        return end(res, 502);
      }
      if (answer.status !== 200) return end(res, 400, { error: answer.body.error ?? 'google_refused' });
      // Google only sends one with consent asked (prompt=consent), which the app always does
      if (!answer.body.refresh_token) return end(res, 400, { error: 'no_refresh_token' });
      const session = b64url(crypto.randomBytes(32));
      sessions[sha256(session).toString('hex')] = { sealed: sealToken(answer.body.refresh_token, session), usedAt: now() };
      saveSessions();
      return end(res, 200, { session, accessToken: answer.body.access_token, expiresIn: answer.body.expires_in });
    }

    const session = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(session)) return end(res, 401);
    const key = sha256(session).toString('hex');
    const refreshToken = sessions[key] && openToken(sessions[key].sealed, session);

    if (pathname === '/auth/refresh') {
      if (!refreshToken) return end(res, 401);
      let answer;
      try {
        answer = await googleRequest(GOOGLE_TOKEN_URL, { ...client, refresh_token: refreshToken, grant_type: 'refresh_token' });
      } catch {
        return end(res, 502);
      }
      // Revoked at Google or expired: the device has to sign in again
      if (answer.body.error === 'invalid_grant') {
        delete sessions[key];
        saveSessions();
        return end(res, 401);
      }
      if (answer.status !== 200) return end(res, 502);
      sessions[key].usedAt = now();
      saveSessions();
      return end(res, 200, { accessToken: answer.body.access_token, expiresIn: answer.body.expires_in });
    }

    if (pathname === '/auth/logout') {
      if (refreshToken) {
        await googleRequest(GOOGLE_REVOKE_URL, { token: refreshToken }).catch(() => {});
        delete sessions[key];
        saveSessions();
      }
      return end(res, 204);
    }

    return end(res, 404);
  }

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin ?? '';
    if (origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
      res.setHeader('Access-Control-Allow-Headers', [...FORWARDED_HEADERS, 'authorization', 'content-type'].join(', '));
      res.setHeader('Access-Control-Max-Age', '86400');
      return end(res, 204);
    }
    const pathname = (req.url ?? '').split('?')[0];
    const isPush = pathname.startsWith('/push/');
    const isAuth = pathname.startsWith('/auth/');
    if (!isPush && !isAuth && req.method !== 'GET') return end(res, 405);
    if (!origins.includes(origin)) return end(res, 403);

    // Behind Apache every request comes from this machine; Apache adds the visitor's address last in X-Forwarded-For
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    const ip = (local && req.headers['x-forwarded-for']?.split(',').pop()?.trim()) || req.socket.remoteAddress || '';
    hits.set(ip, (hits.get(ip) ?? 0) + 1);
    if (hits.get(ip) > RATE_LIMIT) return end(res, 429);

    if (isAuth) return auth(req, res, pathname, origin);
    return isPush ? push(req, res, pathname) : passThrough(req, res);
  });

  return { server, tick, vapid, devices: () => devices, sessions: () => sessions };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { server, tick } = createServer();
  setInterval(tick, 30_000);
  server.listen(PORT, () => console.log(`Yearly server on :${PORT} for ${ALLOWED_ORIGINS.join(', ')}, data in ${path.resolve(DATA_DIR)}`));
}
