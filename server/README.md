# Yearly server

One small Node file with no dependencies, for two jobs the browser can't do alone:

- **Pass-through:** a few free APIs (football-data.org, sometimes Ticketmaster) don't allow calls from a browser.
  The server forwards those requests unchanged. It stores nothing and logs no keys.
- **Notifications:** when Yearly opens on a device with notifications on, it works out the alerts for the next
  few days (leave early, weather, not enough time between events) and sends them here. The server sends each
  one as a push notification when it's due, then deletes it. It never sees Google sign-ins or API keys.

It always runs at `api.` followed by the app's own domain: for an app at `https://yearly.your-domain.com`, the server is
`https://api.yearly.your-domain.com`. The app stays on Firebase; only the `api` name points at your VPS. (Firebase
Hosting can't forward requests to another server: it only forwards to Google's paid Cloud Functions or Cloud Run.)

> **`yearly.your-domain.com` stands for your app's real domain.** Replace it everywhere below. The install script
> refuses the example address, and the app ignores a server address that still contains it.

## Install

**The easy way: let GitHub do it.** Once the server [secrets](../README.md#secrets) are set, every deploy installs or
updates the server over SSH, from the first install (Apache, Node.js, HTTPS certificate included) onwards. See
[Deploying](../README.md#deploying) for the setup and what the first deploy does.

**By hand**, on a Debian 12 or Ubuntu 24.04 VPS:

1. **DNS:** where your domain's DNS is managed (the same place as the Firebase records), add an `A` record named
   `api.yearly` with the VPS's IPv4 address, and an `AAAA` record with its IPv6 address if it has one. Leave the
   Firebase records as they are. On Cloudflare, set the new record to DNS only (grey cloud).
   Wait until `dig +short api.yearly.your-domain.com` shows the VPS address.

2. **On the VPS:**

   ```sh
   git clone https://github.com/adrianoBP/yearly && cd yearly
   sudo bash server/install.sh https://yearly.your-domain.com
   ```

   Give the app's address exactly as people open it (https, no path). The script puts the server at `api.` plus that
   domain. If the app is also opened from other addresses, such as Firebase's own, add them after a comma, your own
   domain first: `https://yearly.your-domain.com,https://your-project.web.app,https://your-project.firebaseapp.com`.

   The script:
   - installs what's missing: Apache, Node.js and certbot;
   - copies the server to `/opt/yearly` and runs it as the `yearly` service on port 8787 (local only);
   - adds the Apache site `api.yearly.your-domain.com`, which passes every request to that service, and checks Apache
     accepts it before reloading;
   - gets a free Let's Encrypt certificate, which also makes HTTP redirect to HTTPS and renews by itself. Certbot asks
     for an email address and for you to accept the Let's Encrypt terms, unless `LETSENCRYPT_EMAIL` is set
     (`sudo LETSENCRYPT_EMAIL=you@… bash server/install.sh …`). Until a certificate exists, every run tries again;
   - checks that `https://api.yearly.your-domain.com` answers.

3. **App:** add `https://api.yearly.your-domain.com` as the `SERVER_URL` secret in GitHub and deploy again
   (see [Deploying](../README.md#deploying)). The address never goes in the repository.

Nothing else to configure: the notification keys are made on first start.

To update by hand: `git pull && sudo bash server/install.sh https://yearly.your-domain.com`. Later runs leave the
Apache site and certificate alone and update the server and its allowed addresses.

## Check it

- `curl -H "Origin: https://yearly.your-domain.com" https://api.yearly.your-domain.com/push/key` shows the public key.
- Logs: `journalctl -u yearly`, and `/var/log/apache2/error.log` for Apache.

## What it keeps

`/var/lib/yearly` holds:

- `vapid.json`: the server's notification keys. Deleting it stops notifications on every device until each opens Yearly again.
- `devices.json`: each device's push address, a hash of its secret, and its upcoming alerts (title, time, short text).
  Alerts are deleted once sent, and a device that hasn't opened Yearly for 60 days is forgotten.

## Uninstall

```sh
sudo a2dissite yearly-api yearly-api-le-ssl && sudo systemctl reload apache2
sudo certbot delete --cert-name api.yearly.your-domain.com
sudo systemctl disable --now yearly
sudo rm -r /etc/systemd/system/yearly.service /etc/apache2/sites-available/yearly-api*.conf /opt/yearly /var/lib/private/yearly
```

## Run it on your computer

```powershell
$env:ALLOWED_ORIGINS = 'http://localhost:4200'; node server/yearly-server.mjs
```

It listens on `http://localhost:8787`, where the app looks for it when opened on `localhost`, and keeps its data in
`./data` (ignored by git). Notifications also need the app's service worker, so run the app with
`npx ng serve --configuration production`.

Tests: `node --test server/yearly-server.test.mjs`.
