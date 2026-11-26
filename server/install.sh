#!/usr/bin/env bash
# Installs or updates the Yearly server on a Debian or Ubuntu VPS, behind Apache with HTTPS:
#   sudo bash server/install.sh https://<your app's domain>[,https://other-address-the-app-is-opened-from]
# The server goes at api.<your app's domain>, whose DNS A record must already point at this VPS.
# It installs what's missing (Apache, Node.js, certbot), and can run again any time to update; nothing is lost.
# With LETSENCRYPT_EMAIL set, certbot asks nothing and accepts the Let's Encrypt terms (the GitHub deploy sets it).
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Run it as root: sudo bash server/install.sh https://yearly.your-domain.com" >&2; exit 1; }

ORIGINS="${1:?Usage: sudo bash server/install.sh https://yearly.your-domain.com}"
FIRST="${ORIGINS%%,*}"
APP_HOST="${FIRST#https://}"
if [ "$FIRST" != "https://$APP_HOST" ] || [ -z "$APP_HOST" ] || [ "${APP_HOST%%/*}" != "$APP_HOST" ]; then
  echo "Start with your app's address exactly as people open it, like https://yearly.your-domain.com (https, no path)." >&2
  exit 1
fi
case "$APP_HOST" in
  *example.com | *your-domain.com | *.web.app | *.firebaseapp.com)
    echo "Use your app's own domain, not an example or Firebase's default address: the server goes at api.<that domain>." >&2
    exit 1 ;;
esac
DOMAIN="api.$APP_HOST"
EMAIL="${LETSENCRYPT_EMAIL:-}"
PORT=8787
echo "Setting up the Yearly server at https://$DOMAIN"

# 0. What it needs
missing=()
command -v a2ensite >/dev/null || missing+=(apache2)
command -v node >/dev/null || missing+=(nodejs)
command -v certbot >/dev/null || missing+=(certbot python3-certbot-apache)
if [ ${#missing[@]} -gt 0 ]; then
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q "${missing[@]}"
fi
NODE="$(command -v node)"
if [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "Needs Node.js 18 or newer; this system's is $("$NODE" -v). Debian 12 and Ubuntu 24.04 have it." >&2
  exit 1
fi

# 1. The server, as a service; its keys, devices and sign-in sessions live in /var/lib/yearly
install -D -m 644 "$(dirname "$0")/yearly-server.mjs" /opt/yearly/yearly-server.mjs
# Google's client ID and secret, for keeping users signed in: a google.env next to this script (GOOGLE_CLIENT_ID=...
# and GOOGLE_CLIENT_SECRET=... lines) replaces the saved one, readable by root only; without either, sign-ins last an hour
if [ -f "$(dirname "$0")/google.env" ]; then
  install -D -m 600 "$(dirname "$0")/google.env" /etc/yearly/google.env
  rm -f "$(dirname "$0")/google.env"
fi
systemctl disable --now yearly-proxy.service 2>/dev/null || true # the older pass-through-only service, if set up
cat > /etc/systemd/system/yearly.service <<EOF
[Unit]
Description=Yearly server
After=network-online.target

[Service]
Environment=PORT=$PORT
Environment=ALLOWED_ORIGINS=$ORIGINS
EnvironmentFile=-/etc/yearly/google.env
ExecStart=$NODE /opt/yearly/yearly-server.mjs
StateDirectory=yearly
DynamicUser=yes
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --quiet yearly.service
systemctl restart yearly.service

# 2. The Apache site for the subdomain; made once, as certbot edits it afterwards
SITE=/etc/apache2/sites-available/yearly-api.conf
if [ ! -f "$SITE" ]; then
  cat > "$SITE" <<EOF
<VirtualHost *:80>
  ServerName $DOMAIN
  ProxyPass        / http://127.0.0.1:$PORT/
  ProxyPassReverse / http://127.0.0.1:$PORT/
</VirtualHost>
EOF
  a2enmod -q proxy proxy_http
  a2ensite -q yearly-api
  if ! apache2ctl configtest 2>/dev/null; then
    a2dissite -q yearly-api
    rm "$SITE"
    echo "Apache didn't accept the new site, so it was taken out again. Check: apache2ctl configtest" >&2
    exit 1
  fi
  systemctl reload apache2
fi

# 3. HTTPS: a free Let's Encrypt certificate, tried on every run until there is one; certbot renews it by itself
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  if [ -n "$EMAIL" ]; then
    certbot --apache -d "$DOMAIN" --redirect --non-interactive --agree-tos -m "$EMAIL" || CERT_FAILED=1
  elif [ -t 0 ]; then
    certbot --apache -d "$DOMAIN" --redirect || CERT_FAILED=1 # asks for an email address and the terms
  else
    echo "Set LETSENCRYPT_EMAIL to get the HTTPS certificate without questions." >&2
    exit 1
  fi
  if [ -n "${CERT_FAILED:-}" ]; then
    echo "No certificate yet: check that $DOMAIN points at this VPS (dig +short $DOMAIN) and port 80 is open, then run this again." >&2
    exit 1
  fi
fi

sleep 1
if "$NODE" -e "fetch('https://$DOMAIN/push/key', { headers: { Origin: '$FIRST' } }).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"; then
  echo "Done: https://$DOMAIN answers."
else
  echo "https://$DOMAIN doesn't answer yet. See: journalctl -u yearly -n 50 and /var/log/apache2/error.log" >&2
  exit 1
fi
