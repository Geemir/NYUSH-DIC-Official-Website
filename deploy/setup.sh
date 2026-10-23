#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 server for the DIC website
# and API. Run it once, as root, on the new server:
#
#   bash setup.sh <domain> <email for certificate notices> "<deploy public key>"
#   e.g. bash setup.sh nyushdic.com shanghai.dic@nyu.edu "ssh-ed25519 AAAA… dic-deploy"
#
# It installs Docker, adds a "deploy" user that GitHub Actions signs in as,
# creates /opt/nyushdic with starting settings, adds 2 GB of swap, and
# schedules the nightly database backup. Running it again is safe.
# Full guide: deploy/README.md.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run this as root." >&2; exit 1; fi
if [ $# -ne 3 ]; then
  echo "Usage: bash setup.sh <domain> <email> \"<deploy public key>\"" >&2
  exit 1
fi
DOMAIN=$1
ACME_EMAIL=$2
DEPLOY_KEY=$3
ROOT=/opt/nyushdic

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl rsync openssl

echo "==> Docker"
if ! command -v docker >/dev/null; then
  # Servers in mainland China: use  sh -s -- --mirror Aliyun  (and see the
  # guide for a Docker Hub mirror). Hong Kong servers need neither.
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> The deploy user"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_KEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> $ROOT"
for d in "$ROOT" "$ROOT/deploy" "$ROOT/server" "$ROOT/site" "$ROOT/backups"; do
  install -d -o deploy -g deploy "$d"
done

# Caddy's settings: the domain, and where Let's Encrypt sends expiry notices.
cat > "$ROOT/site.env" <<EOF
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
EOF

# The API's settings. Written once; edit it afterwards (it is never
# overwritten), then restart: cd $ROOT/deploy && docker compose up -d
if [ ! -f "$ROOT/api.env" ]; then
  cat > "$ROOT/api.env" <<EOF
# DIC API settings (explained in server/.env.example). After editing:
#   cd $ROOT/deploy && docker compose up -d
AUTH_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://www.$DOMAIN,https://$DOMAIN,https://geemir.github.io
ADMIN_EMAILS=$ACME_EMAIL

# Sign-in emails through Alibaba Cloud DirectMail (邮件推送).
EMAIL_PROVIDER=aliyun
EMAIL_FROM=NYUSH DIC <noreply@mail.$DOMAIN>
EMAIL_REPLY_TO=shanghai.dic@nyu.edu
ALIYUN_DM_REGION=cn-hangzhou
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=

# Deadlines, China time (optional):
# REGISTRATION_CLOSES=2026-11-30T23:59:00+08:00
# PROJECT_EDIT_CLOSES=2026-12-04T23:59:00+08:00
EOF
fi
chown deploy:deploy "$ROOT/site.env" "$ROOT/api.env"
chmod 600 "$ROOT/api.env"

# Something to show before the first deployment.
if [ ! -f "$ROOT/site/index.html" ]; then
  echo "<!doctype html><meta charset=utf-8><title>NYUSH DIC</title><p>NYUSH DIC: coming soon.</p>" > "$ROOT/site/index.html"
  chown deploy:deploy "$ROOT/site/index.html"
fi

echo "==> Swap"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> Nightly backup (04:00)"
cat > /etc/cron.d/nyushdic-backup <<EOF
0 4 * * * deploy [ -f $ROOT/deploy/backup.sh ] && bash $ROOT/deploy/backup.sh >> $ROOT/backups/backup.log 2>&1
EOF

echo
echo "Done. Next (deploy/README.md, step 7):"
echo "  1. Put the DirectMail AccessKey in $ROOT/api.env"
echo "  2. Run the \"Deploy to the DIC server\" workflow on GitHub"
