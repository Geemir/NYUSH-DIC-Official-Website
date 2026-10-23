#!/usr/bin/env bash
# Copies the API's database to /opt/nyushdic/backups and keeps the last 14
# days. setup.sh runs it every night at 04:00 (cron); run it by hand any time:
#   bash /opt/nyushdic/deploy/backup.sh
#
# Restore a copy (this replaces everything since that copy was made):
#   cd /opt/nyushdic/deploy
#   docker compose stop api
#   docker compose cp ../backups/<file>.sqlite api:/app/data/dic.sqlite
#   docker compose start api
set -euo pipefail

cd /opt/nyushdic/deploy
name="dic-$(date +%Y%m%d-%H%M).sqlite"

# VACUUM INTO writes a clean, consistent copy while the API keeps running.
docker compose exec -T api node -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/app/data/dic.sqlite').exec(\"VACUUM INTO '/app/data/${name}'\");"
docker compose cp "api:/app/data/${name}" "/opt/nyushdic/backups/${name}"
docker compose exec -T api rm -f "/app/data/${name}"

find /opt/nyushdic/backups -name 'dic-*.sqlite' -mtime +14 -delete
echo "Saved /opt/nyushdic/backups/${name}"
