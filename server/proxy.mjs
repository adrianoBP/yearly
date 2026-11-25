// Yearly pass-through: forwards GET requests from the Yearly web app to free APIs that browsers can't call
// directly (no CORS). It stores and logs nothing; each user's own key travels in their request.
//
//   GET /<host>/<path>?<query>   e.g. /api.football-data.org/v4/matches?dateFrom=2026-11-28&dateTo=2026-11-28
//
// Run: PORT=8787 ALLOWED_ORIGINS=https://your-yearly-domain node server/proxy.mjs   (Node 18+)
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200').split(',').map((o) => o.trim());
/** Only these hosts, and only these request headers are passed on */
const UPSTREAMS = ['api.football-data.org', 'app.ticketmaster.com'];
const FORWARDED_HEADERS = ['x-auth-token'];
/** Per-IP requests per minute; the APIs themselves allow fewer, this only stops abuse of the server */
const RATE_LIMIT = 60;

const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

export function upstreamUrl(path) {
  const match = path.match(/^\/([^/]+)(\/.*)?$/);
  if (!match || !UPSTREAMS.includes(match[1])) return null;
  return `https://${match[1]}${match[2] ?? '/'}`;
}

export const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', FORWARDED_HEADERS.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');
    res.writeHead(204).end();
    return;
  }
  if (req.method !== 'GET') return res.writeHead(405).end();
  if (!ALLOWED_ORIGINS.includes(req.headers.origin ?? '')) return res.writeHead(403).end();

  const ip = req.socket.remoteAddress ?? '';
  hits.set(ip, (hits.get(ip) ?? 0) + 1);
  if (hits.get(ip) > RATE_LIMIT) return res.writeHead(429).end();

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
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  server.listen(PORT, () => console.log(`Yearly pass-through on :${PORT} for ${ALLOWED_ORIGINS.join(', ')}`));
}
