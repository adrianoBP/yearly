import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server, upstreamUrl } from './proxy.mjs';

test('only allow-listed hosts are forwarded', () => {
  assert.equal(upstreamUrl('/api.football-data.org/v4/matches?dateFrom=2026-11-28'), 'https://api.football-data.org/v4/matches?dateFrom=2026-11-28');
  assert.equal(upstreamUrl('/evil.example.com/steal'), null);
  assert.equal(upstreamUrl('/'), null);
});

test('rejects other origins and methods, answers preflight', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  try {
    const foreign = await fetch(`${base}/api.football-data.org/v4/matches`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(foreign.status, 403);
    const post = await fetch(`${base}/api.football-data.org/v4/matches`, { method: 'POST', headers: { Origin: 'http://localhost:4200' } });
    assert.equal(post.status, 405);
    const preflight = await fetch(`${base}/api.football-data.org/v4/matches`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:4200' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    const unknown = await fetch(`${base}/evil.example.com/x`, { headers: { Origin: 'http://localhost:4200' } });
    assert.equal(unknown.status, 404);
  } finally {
    server.close();
  }
});
