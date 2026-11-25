# Yearly pass-through server

A few free APIs (football-data.org, sometimes Ticketmaster) don't allow calls from a browser.
`proxy.mjs` forwards those requests unchanged. It has no dependencies, stores nothing and logs no keys.

## Run on the VPS

Needs Node 18 or newer.

```sh
PORT=8787 ALLOWED_ORIGINS=https://your-yearly-domain node server/proxy.mjs
```

Put it behind HTTPS (for example a Caddy or nginx site such as `https://yearly-api.example.com` → `localhost:8787`),
then set that URL as `proxyUrl` in `src/app/app.config.ts` and redeploy the app.

Keep it running with systemd, for example `/etc/systemd/system/yearly-proxy.service`:

```ini
[Unit]
Description=Yearly pass-through
After=network.target

[Service]
Environment=PORT=8787
Environment=ALLOWED_ORIGINS=https://your-yearly-domain
ExecStart=/usr/bin/node /opt/yearly/server/proxy.mjs
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

## Test

```sh
node --test server/proxy.test.mjs
```
