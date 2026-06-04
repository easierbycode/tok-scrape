#!/usr/bin/env bash
# Initiate the MongoDB replica set ONCE, after all three mongods are running.
# Run this from the MacBook (where the `graylog-mongodb` container is up).
#
#   bash cluster/rs-init.sh
#
# It reads the three Tailnet addresses from cluster/.env and execs mongosh
# inside the local mongo container. Idempotent-ish: rs.initiate() errors if the
# set already exists — that's expected on a re-run; use rs.status() to inspect.
set -euo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
set -a; . ./.env; set +a
: "${MAC_TS:?set MAC_TS in cluster/.env}"
: "${GB_TS:?set GB_TS in cluster/.env}"
: "${SP_TS:?set SP_TS in cluster/.env}"

MONGO_CONTAINER="${MONGO_CONTAINER:-graylog-mongodb}"

echo "Initiating replica set rs0:"
echo "  primary (priority 2): ${MAC_TS}:27017   (MacBook)"
echo "  secondary           : ${GB_TS}:27017    (Galaxy Book 3)"
echo "  arbiter             : ${SP_TS}:27017    (Surface Pro 11)"

docker exec -i "${MONGO_CONTAINER}" mongosh --quiet --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: '${MAC_TS}:27017', priority: 2 },
    { _id: 1, host: '${GB_TS}:27017',  priority: 1 },
    { _id: 2, host: '${SP_TS}:27017',  arbiterOnly: true }
  ]
});
"

echo
echo "Done. Check status with:"
echo "  docker exec -it ${MONGO_CONTAINER} mongosh --quiet --eval 'rs.status().members.map(m => m.name + \" => \" + m.stateStr)'"
