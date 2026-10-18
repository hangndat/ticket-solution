#!/usr/bin/env bash
# Poll prod device_tokens until a row appears (after human Allow+login on device).
set -euo pipefail
HOST="${D5_SSH_HOST:-dexter@113.161.116.5}"
for i in $(seq 1 "${1:-60}"); do
  n=$(ssh -o BatchMode=yes "$HOST" \
    "docker exec vemoki-postgres-1 bash -lc 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"SET ROLE ticket_owner; SELECT count(*)::text FROM device_tokens WHERE revoked_at IS NULL;\"'" \
    | tail -1 | tr -d '[:space:]')
  echo "$(date -u +%H:%M:%S)Z device_tokens=$n"
  if [[ "${n:-0}" =~ ^[1-9] ]]; then
    ssh -o BatchMode=yes "$HOST" \
      "docker exec vemoki-postgres-1 bash -lc 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"SET ROLE ticket_owner; SELECT id, user_id, left(token,16), environment, created_at FROM device_tokens WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 5;\"'"
    exit 0
  fi
  sleep 5
done
echo "timeout: no device_tokens" >&2
exit 1
