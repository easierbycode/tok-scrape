#!/usr/bin/env bash
# Bring up the Graylog stack, open an ngrok public tunnel to the REST API,
# create (or reuse) a Graylog API token for the mobile app, and print the
# URL + token for pasting into the app's Settings screen.
#
# Usage:
#   export NGROK_AUTHTOKEN=2abc...xyz   # https://dashboard.ngrok.com/get-started/your-authtoken
#   ./scripts/up.sh
#
# Env overrides:
#   GRAYLOG_ADMIN_USER      (default: admin)
#   GRAYLOG_ADMIN_PASSWORD  (default: ChangeMeAdmin!)
#   GRAYLOG_TOKEN_NAME      (default: mobile-app)

set -euo pipefail

cd "$(dirname "$0")/.."

: "${NGROK_AUTHTOKEN:?Set NGROK_AUTHTOKEN. Get one at https://dashboard.ngrok.com/get-started/your-authtoken}"

ADMIN_USER="${GRAYLOG_ADMIN_USER:-admin}"
ADMIN_PW="${GRAYLOG_ADMIN_PASSWORD:-ChangeMeAdmin!}"
TOKEN_NAME="${GRAYLOG_TOKEN_NAME:-mobile-app}"

echo "==> docker compose up -d"
docker compose up -d

wait_for() {
  local name="$1" cmd="$2" tries="${3:-120}" delay="${4:-2}"
  echo -n "==> Waiting for $name"
  for ((i = 0; i < tries; i++)); do
    if eval "$cmd" >/dev/null 2>&1; then
      echo " - ready."
      return 0
    fi
    echo -n "."
    sleep "$delay"
  done
  echo " - timed out."
  return 1
}

# 1. ngrok public URL (from its local inspector API).
wait_for "ngrok tunnel" "curl -sf http://localhost:4040/api/tunnels | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get(\"tunnels\") else 1)'" 60 2
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels \
  | python3 -c 'import json,sys
tunnels=json.load(sys.stdin).get("tunnels",[])
https=[t["public_url"] for t in tunnels if t.get("proto")=="https"]
print(https[0] if https else (tunnels[0]["public_url"] if tunnels else ""))')

if [[ -z "${PUBLIC_URL}" ]]; then
  echo "Could not determine ngrok public URL. Inspect 'docker compose logs ngrok'." >&2
  exit 1
fi

# 2. Graylog REST API up (via the local port).
wait_for "Graylog API" "curl -sf -u '${ADMIN_USER}:${ADMIN_PW}' -H 'X-Requested-By: tok-scrape-setup' http://localhost:9000/api/system/lbstatus" 180 2

# 3. Create (or reuse) a Graylog API token under the admin user.
#    Graylog responds 200 with {token: "..."} on create. If a token with the
#    same name already exists on some versions it returns 400; in that case we
#    list tokens and pick the existing one.
create_body=$(curl -s -o /tmp/gl_token.json -w '%{http_code}' \
  -u "${ADMIN_USER}:${ADMIN_PW}" \
  -H 'X-Requested-By: tok-scrape-setup' \
  -H 'Content-Type: application/json' \
  -X POST "http://localhost:9000/api/users/${ADMIN_USER}/tokens/${TOKEN_NAME}" \
  -d '{}' || true)

TOKEN=""
if [[ "$create_body" == "200" || "$create_body" == "201" ]]; then
  TOKEN=$(python3 -c 'import json,sys; print(json.load(open("/tmp/gl_token.json")).get("token",""))')
fi

if [[ -z "$TOKEN" ]]; then
  # Fall back to listing existing tokens.
  curl -s -o /tmp/gl_tokens.json \
    -u "${ADMIN_USER}:${ADMIN_PW}" \
    -H 'X-Requested-By: tok-scrape-setup' \
    "http://localhost:9000/api/users/${ADMIN_USER}/tokens" || true
  TOKEN=$(python3 -c "
import json, sys
try:
    data = json.load(open('/tmp/gl_tokens.json'))
except Exception:
    sys.exit(0)
for t in data.get('tokens', []):
    if t.get('name') == '${TOKEN_NAME}':
        print(t.get('token',''))
        break
")
fi

rm -f /tmp/gl_token.json /tmp/gl_tokens.json

cat <<EOF

=====================================================
 TokScrape / Graylog is up.
 Paste these into the mobile app Settings screen:
=====================================================
  Graylog URL:   ${PUBLIC_URL}
  API token:     ${TOKEN:-<token creation failed - see 'docker compose logs graylog'>}
  Lucene query:  host:tiktok-bookmarklet
=====================================================

Local URLs (for your laptop / LAN):
  Web UI + API:  http://localhost:9000   (login ${ADMIN_USER} / ${ADMIN_PW})
  GELF HTTP in:  http://localhost:12202/gelf

Tear down:     docker compose down
Wipe data:     docker compose down -v
EOF
