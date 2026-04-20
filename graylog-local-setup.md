# Graylog Local Setup (Windows — WSL2, native install)

Graylog Server does not run natively on Windows. The supported "native" path on Windows is to install it inside **WSL2** (Ubuntu), which behaves like a native Linux install but lives alongside your Windows tools. This guide uses apt packages (MongoDB 7.0, OpenSearch 2.x, Graylog Open 7.0) — no Docker.

> If you prefer Docker on Windows instead, see the note at the bottom.

## 0. One-time: enable WSL2 and install Ubuntu

Open PowerShell **as Administrator** and run:

```powershell
wsl --install -d Ubuntu-22.04
```

Reboot if prompted, then launch **Ubuntu 22.04** from the Start menu and create your Linux user. Everything below runs **inside the Ubuntu shell**.

Update the base image:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl gnupg apt-transport-https ca-certificates pwgen uuid-runtime
```

## 1. Install MongoDB 7.0

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl daemon-reload
sudo systemctl enable --now mongod
```

> WSL2 Ubuntu 22.04 has systemd enabled by default on recent builds. If `systemctl` complains, run `sudo /etc/init.d/mongod start` instead, or enable systemd by adding `[boot]\nsystemd=true` to `/etc/wsl.conf` and running `wsl --shutdown` from PowerShell.

## 2. Install OpenSearch 2.x

```bash
curl -fsSL https://artifacts.opensearch.org/publickeys/opensearch.pgp \
  | sudo gpg --dearmor -o /usr/share/keyrings/opensearch-keyring

echo "deb [signed-by=/usr/share/keyrings/opensearch-keyring] https://artifacts.opensearch.org/releases/bundle/opensearch/2.x/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/opensearch-2.x.list

sudo apt update
# Admin password is required at install time in OpenSearch 2.12+:
sudo env OPENSEARCH_INITIAL_ADMIN_PASSWORD='Gr@yl0g-Admin-ChangeMe!' apt install -y opensearch
```

Configure OpenSearch for Graylog (single-node, security plugin off — fine for local dev):

```bash
sudo tee /etc/opensearch/opensearch.yml >/dev/null <<'EOF'
cluster.name: graylog
node.name: node1
path.data: /var/lib/opensearch
path.logs: /var/log/opensearch
network.host: 127.0.0.1
discovery.type: single-node
action.auto_create_index: false
plugins.security.disabled: true
EOF

# Modest heap for local dev:
sudo sed -i 's/^-Xms.*/-Xms1g/' /etc/opensearch/jvm.options
sudo sed -i 's/^-Xmx.*/-Xmx1g/' /etc/opensearch/jvm.options

sudo systemctl enable --now opensearch
```

Verify:

```bash
curl -s http://127.0.0.1:9200 | head
```

## 3. Install Graylog Open 7.0

```bash
wget https://packages.graylog2.org/repo/packages/graylog-7.0-repository_latest.deb
sudo dpkg -i graylog-7.0-repository_latest.deb
sudo apt update
sudo apt install -y graylog-server
```

Generate the two required secrets:

```bash
# 1) password_secret (>= 16 chars of random):
PASSWORD_SECRET=$(pwgen -N 1 -s 96)
# 2) root_password_sha2 (the sha256 of the admin password you want to log in with):
ROOT_PW="ChangeMeAdmin!"
ROOT_PW_SHA2=$(echo -n "$ROOT_PW" | sha256sum | awk '{print $1}')
echo "password_secret = $PASSWORD_SECRET"
echo "root_password_sha2 = $ROOT_PW_SHA2"
```

Edit `/etc/graylog/server/server.conf`:

```bash
sudo sed -i "s|^password_secret =.*|password_secret = $PASSWORD_SECRET|" /etc/graylog/server/server.conf
sudo sed -i "s|^root_password_sha2 =.*|root_password_sha2 = $ROOT_PW_SHA2|" /etc/graylog/server/server.conf

# Bind to all WSL interfaces so the Windows browser can reach it:
sudo sed -i 's|^#http_bind_address = .*|http_bind_address = 0.0.0.0:9000|' /etc/graylog/server/server.conf

# Point at local MongoDB and OpenSearch:
sudo sed -i 's|^#elasticsearch_hosts = .*|elasticsearch_hosts = http://127.0.0.1:9200|' /etc/graylog/server/server.conf
sudo sed -i 's|^#mongodb_uri = mongodb://localhost/graylog|mongodb_uri = mongodb://127.0.0.1:27017/graylog|' /etc/graylog/server/server.conf
```

Start it:

```bash
sudo systemctl enable --now graylog-server
sudo journalctl -u graylog-server -f      # watch until you see "Graylog server up and running"
```

Open the UI from Windows: http://localhost:9000 — log in as `admin` / `ChangeMeAdmin!` (or whatever you set in `ROOT_PW`).

## 4. Create a GELF HTTP input

In the Graylog web UI:

1. **System → Inputs → Select input → `GELF HTTP` → Launch new input**
2. Node: the local node. Title: `bookmarklet-gelf-http`.
3. Bind address: `0.0.0.0`. Port: `12202` (avoids the default `12201` that's often used for GELF UDP).
4. Leave TLS off for local use. Leave `Enable CORS` checked (it sends `Access-Control-Allow-Origin: *`).
5. Save.

Sanity check from the WSL shell:

```bash
curl -v -XPOST http://127.0.0.1:12202/gelf \
  -H 'Content-Type: application/json' \
  -d '{"version":"1.1","host":"test","short_message":"hello graylog"}'
```

You should get `202 Accepted` and see the message under **Search** within a few seconds.

## 5. Reach it from the Windows browser

Because the bookmarklet runs in your Windows browser and Graylog runs in WSL2:

- Recent WSL2 builds auto-forward `localhost` — `http://localhost:12202/gelf` from Chrome/Edge on Windows already hits the WSL2 service. Try this first.
- If it doesn't resolve, get the WSL IP (`ip addr show eth0 | grep inet`) and use that in the bookmarklet's `GRAYLOG_ENDPOINT` instead. It will be something like `http://172.x.x.x:12202/gelf`.
- Allow Windows Defender Firewall to let the Windows host talk to WSL — usually automatic; if not, add an inbound rule for ports `9000` and `12202` on the WSL vEthernet adapter.

## 6. Plug the endpoint into the bookmarklet

Open `index.html` and set:

```js
var GRAYLOG_ENDPOINT = 'http://localhost:12202/gelf';   // or http://<WSL-IP>:12202/gelf
```

The Google Sheets POST still fires; Graylog receives a parallel GELF message with `_creator`, `_scrapedAt`, `_date_start`, `_date_end`, `_videos_count`, and the full metrics + videos arrays serialized into `_metrics_json` / `_videos_json`. Search `host:tiktok-bookmarklet` in Graylog to see them.

## Troubleshooting

- **`curl: (7) Failed to connect`** — service isn't up. `sudo systemctl status opensearch graylog-server mongod`.
- **OpenSearch won't start, OOM** — lower heap in `/etc/opensearch/jvm.options` to `-Xms512m` / `-Xmx512m`.
- **Graylog logs say "Couldn't connect to Elasticsearch"** — usually `plugins.security.disabled: true` is missing or OpenSearch is still booting. Wait ~30s and retry.
- **Bookmarklet shows CORS error in DevTools** — GELF HTTP input sends `Access-Control-Allow-Origin: *` when "Enable CORS" is on; but the bookmarklet uses `text/plain` + fire-and-forget which avoids preflight entirely, so you should not need CORS in the first place.
- **Stopping everything**: `sudo systemctl stop graylog-server opensearch mongod`.

## Alternative: Docker Desktop on Windows

If the WSL native stack is too heavy (or you'd rather not run three systemd services), the same stack is available as a single `docker-compose.yml` sitting next to this guide: [`docker-compose.yml`](docker-compose.yml).

Prereq: **Docker Desktop** (with WSL2 backend enabled) installed on Windows.

### One-command bring-up with public URLs

`docker compose up` brings up MongoDB + OpenSearch + Graylog, opens two **ngrok** tunnels (`graylog-api` → `:9000` and `graylog-gelf` → `:12202`), and then a one-shot `bookmarklet-sync` sidecar mints a Graylog admin API token, rewrites `bookmarklet-src.js` + `index.html` with the current GELF ngrok URL + token, and prints the mobile-app settings summary.

```bash
# Free ngrok account + authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
export NGROK_AUTHTOKEN=2abc...xyz

docker compose up -d
docker compose logs -f bookmarklet-sync    # Ctrl+C once you see the summary below
```

You'll see something like:

```
=====================================================
 TokScrape / Graylog is up.
 Paste these into the mobile app Settings screen:
=====================================================
  Graylog URL:    https://<random>.ngrok-free.app
  API token:      1abcd...xyz
  Lucene query:   host:tiktok-bookmarklet
=====================================================

Bookmarklet (GELF HTTP via ngrok):
  GELF endpoint:  https://<other-random>.ngrok-free.app/gelf
  Bookmarklet:    updated (index.html + bookmarklet-src.js)
```

Paste the three mobile-app values into the app's Settings screen and hit Save. The bookmarklet is updated in place — open `index.html` and re-drag the **Log Key Metrics** link. Both ngrok URLs rotate on every restart unless you have paid reserved domains, so re-run `docker compose up -d` after a reboot.

### GELF HTTP input (one-time)

The `bookmarklet-sync` sidecar does not create the GELF HTTP input for you — do it once via the UI:

1. Open **http://localhost:9000** — log in as `admin` / `ChangeMeAdmin!` (the default SHA256 baked into the compose file).
2. **System → Inputs → Select input → `GELF HTTP` → Launch new input**, bind `0.0.0.0`, port `12202`, check **Enable CORS**, Save.
3. Sanity check from PowerShell:

   ```powershell
   curl.exe -v -XPOST http://localhost:12202/gelf `
     -H "Content-Type: application/json" `
     -d '{\"version\":\"1.1\",\"host\":\"test\",\"short_message\":\"hello graylog\"}'
   ```

Port map exposed by the compose file:

| Port        | Purpose                                       |
| ----------- | --------------------------------------------- |
| `9000/tcp`  | Graylog web UI + API                          |
| `12202/tcp` | GELF HTTP input (what the bookmarklet POSTs)  |
| `12201/udp` | GELF UDP input (optional, handy for testing)  |
| `1514`      | Syslog TCP/UDP (optional)                     |

Teardown:

```bash
docker compose down        # stop, keep volumes (logs + indices persist)
docker compose down -v     # stop and wipe all data
```

**Before using this anywhere but locally:** regenerate `GRAYLOG_PASSWORD_SECRET` in the compose file (`openssl rand -hex 48`) and change `GRAYLOG_ROOT_PASSWORD_SHA2` to the SHA256 of your own admin password (`echo -n 'YourNewPassword' | sha256sum`).

## LP branding (Docker only)

The Docker Compose stack builds a custom Graylog image that replaces the stock Graylog logos and favicon with the LP monogram. The branding layer lives in `graylog-branding/` and works like this:

1. **Favicon** — multi-size PNGs + `.ico` are copied over the bundled favicon paths, and `<link rel="icon">` tags are injected into `index.html`.
2. **Login + nav logos** — `branding-patch.js` is a small MutationObserver shim injected via a `<script defer>` tag. It fetches `/assets/lp-logo.svg` once, then replaces any Graylog SVG logo (login page, top-nav, etc.) with the LP logo as soon as React mounts it.

### Rebuild after changing assets

If you edit any file in `graylog-branding/`:

```bash
docker compose build graylog          # rebuild just the branding layer
docker compose up -d graylog           # restart with the new image
```

### Verify

```bash
# These should return 200:
curl -sI http://localhost:9000/assets/lp-logo.svg | head -1
curl -sI http://localhost:9000/assets/branding-patch.js | head -1

# Open the UI — favicon, login page logo, and top-nav logo should all show LP:
#   http://localhost:9000
```

### How it works under the hood

The Dockerfile (`graylog-branding/Dockerfile`) extends `graylog/graylog:7.0.6`:

- Copies `lp-logo.svg`, `branding-patch.js`, and all favicon variants into the web interface's `assets/` directory.
- Replaces the bundled `favicon.png` and `favicon.ico` in the web root.
- Uses `sed` to patch `index.html`: strips existing `<link rel="icon">` tags and injects LP favicon links + the branding script before `</head>`.

The `branding-patch.js` shim targets these selectors:

- `svg#logoTitleId` — the main login-page logo
- `svg[id*="logo" i]` — any other SVG with "logo" in its id
- `a[href="/"] svg` — the top-left brand link
- `[class*="navbar" i] svg[role="img"]` — nav-bar image SVGs
- `[class*="LoginBox" i] svg`, `[class*="LoginPage" i] svg` — login page containers

Each matched SVG is replaced with the LP logo (preserving the original's width/height/class) and marked with `data-lp-branded="1"` so it isn't re-replaced on subsequent observer callbacks.

### Removing the branding

To revert to stock Graylog logos, change the `graylog` service back to the upstream image:

```yaml
graylog:
  image: graylog/graylog:7.0.6
  # (remove the build: block)
```

Then `docker compose up -d graylog` — the stock image has no branding overlay.
