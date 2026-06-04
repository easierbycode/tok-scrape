# Graylog HA cluster (3 hosts) — deploy runbook

Turns the single-node stack in [`../docker-compose.yml`](../docker-compose.yml) into a 3-host,
**bidirectional automatic-failover** Graylog cluster:

| Host | Arch | Role | Runs |
| --- | --- | --- | --- |
| MacBook | arm64 | data node + serves traffic | mongod (data), opensearch (data+cm), graylog, nginx, ngrok |
| Galaxy Book 3 | x86-64 | data node + serves traffic | mongod (data), opensearch (data+cm), graylog, nginx, ngrok |
| Surface Pro 11 | arm64 | **tiebreaker only** (no data, no traffic) | mongod (arbiter), opensearch (voting-only) |

**Why three:** MongoDB and OpenSearch each elect a leader by majority vote, so two nodes can't fail over alone — a lone survivor can't tell "peer dead" from "network split" and correctly refuses to lead. The Surface Pro is the third vote for both, so if **either** laptop dies the survivor + Surface keep quorum and the cluster stays writable with full history. Sharing MongoDB also keeps the mobile-app API token + the "Seller Comparison" dashboard ID identical on both nodes, so the app survives a failover. Full design + rationale: the approved plan at `~/.claude/plans/what-steps-would-be-enchanted-brook.md`.

Files in this directory:

- `docker-compose.datanode.yml` — the data-node stack (Mac + Galaxy Book)
- `docker-compose.voteonly.yml` — the Surface Pro tiebreaker stack
- `opensearch.datanode.yml` / `opensearch.voteonly.yml` — mounted OpenSearch configs
- `ngrok.cluster.yml` — pooled ngrok config (data nodes only)
- `rs-init.sh` — one-time MongoDB replica-set initiation
- `.env.example` — per-host variables → copy to `.env` on each machine

> **Trust boundary:** ports 9200 / 9300 / 27017 carry **no TLS and no auth**. They must be reachable only over Tailscale/LAN — never forwarded to the public internet. Only the two ngrok domains are public.

---

## 0. Prerequisites (all machines unless noted)

1. **Tailscale** installed and logged into the same tailnet on all three. Record each host's `100.x` address → these are `MAC_TS`, `GB_TS`, `SP_TS`.
2. **ngrok Pay-As-You-Go** (data nodes only): Endpoint Pooling is a paid feature. Reserve both domains (`tok-graylog-api`, `tok-graylog-gelf`) on the account; grab the authtoken.
3. **Secrets** (generate once, use the SAME values on both data nodes):
   - `GRAYLOG_PASSWORD_SECRET` = `openssl rand -hex 48`
   - `GRAYLOG_ROOT_PASSWORD_SHA2` = `echo -n 'YourAdminPassword' | shasum -a 256`
4. **Surface Pro power:** Settings → System → Power → set "never sleep" on AC, and keep it plugged in. A sleeping tiebreaker = a lost vote.
5. **`vm.max_map_count = 262144`** for OpenSearch:
   - **Mac:** Docker Desktop's VM already satisfies this — nothing to do.
   - **Galaxy Book 3 (Docker Desktop / WSL2):** `wsl -d docker-desktop sysctl -w vm.max_map_count=262144` (or set it via `%USERPROFILE%\.wslconfig` `[wsl2] kernelCommandLine = sysctl.vm.max_map_count=262144`). Give WSL2 RAM: `.wslconfig` `[wsl2] memory=8GB` (or more).
   - **Surface Pro 11 (Docker CE in WSL2, NOT Docker Desktop — it's flaky on Windows-ARM):** inside the WSL distro, `echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`.

Then on each machine: `cd cluster && cp .env.example .env` and fill it in. `OS_NODE_NAME` and `OS_PUBLISH_HOST` differ per host (`os-mac`/`os-gb`/`os-vote`); the three `*_TS` addresses and the Graylog secrets are identical everywhere.

---

## 1. Bring up the storage tier on all three (order matters)

OpenSearch won't form (and so won't report healthy) until ≥2 of the 3 cluster-manager nodes are up, so start the storage tier **everywhere before any Graylog**:

```bash
# Surface Pro (WSL2 shell):
cd cluster && docker compose -f docker-compose.voteonly.yml up -d

# MacBook AND Galaxy Book:
cd cluster && docker compose -f docker-compose.datanode.yml up -d mongodb opensearch
```

Confirm the OpenSearch cluster formed (from any data node):

```bash
curl -s localhost:9200/_cat/nodes?v          # expect 3 nodes; one with role 'v' (voting-only)
curl -s localhost:9200/_cluster/health?pretty # status yellow/green, number_of_nodes: 3
```

## 2. Initiate the MongoDB replica set (once, from the Mac)

```bash
bash cluster/rs-init.sh
# verify:
docker exec -it graylog-mongodb mongosh --quiet --eval \
  'rs.status().members.map(m => m.name + " => " + m.stateStr)'
# expect: MAC=PRIMARY, GB=SECONDARY, SP=ARBITER
```

## 3. Start Graylog + edge on both data nodes

```bash
# MacBook AND Galaxy Book:
cd cluster && docker compose -f docker-compose.datanode.yml up -d graylog graylog-fwd ngrok
```

The two Graylog nodes auto-form a cluster via the shared Mongo (Graylog 7 elects the leader itself — no `is_master` flag). Check **System → Nodes** in the UI: both should appear.

## 4. One-time cluster config (do once, from either node's UI)

1. **GELF HTTP input as GLOBAL** — System → Inputs → GELF HTTP → Launch new input → **Global**, bind `0.0.0.0`, port `12202`, Enable CORS. Because it's global in shared Mongo, it runs on **both** nodes automatically.
2. **Index replicas = 1** — System → Indices → Default index set → Edit → **Index replicas = 1**, save, then Maintenance → **Rotate active write index**. To also replicate already-existing indices:
   `curl -XPUT localhost:9200/graylog_*/_settings -H 'Content-Type: application/json' -d '{"index":{"number_of_replicas":1}}'`
   This is what gives each shard a copy on the other data node → full history survives a node loss.
3. **Seed the dashboard** — once, against the cluster:
   `python3 ../scripts/seed-graylog.py --create-dashboard --api-base http://localhost:9000 --api-token <TOKEN>`
   It lands in shared Mongo, so the same dashboard **ID** is valid on both nodes (what the mobile app's `COMMON_DASHBOARD_ID` needs).

## 5. Point the clients at the pooled domains

The mobile-app `url` / `gelfUrl` / `graylogDashboardId` stay the same fixed ngrok domains and (now cluster-wide) dashboard ID. The cluster has a fresh MongoDB, so mint **one** admin API token in the UI (System → Users → admin → Edit tokens → create `mobile-app`) — it lives in shared Mongo and is valid on both nodes. Put that token into the mobile-app Settings and into both `extension-agency/config.js` / `extension-seller/config.js` (the `bookmarklet-sync` sidecar is wired to the base single-node stack's network, so set these by hand for the cluster rather than re-running it).

---

## ⚠️ First-boot verification points (version-sensitive — confirm these)

These are the spots that can vary by image/agent version and that I could not validate without running the real 3-host cluster:

1. **OpenSearch security disable.** Security is turned off in the mounted `opensearch.*.yml` (`plugins.security.disabled: true`). Do **not** also set `DISABLE_SECURITY_PLUGIN` env — OpenSearch rejects the duplicate. If a node fails to boot complaining about the admin password despite `DISABLE_INSTALL_DEMO_CONFIG=true`, that's the `OPENSEARCH_INITIAL_ADMIN_PASSWORD` env interaction — it's kept set in the compose as a precaution.
2. **`${VAR}` substitution in `opensearch.yml`.** OpenSearch substitutes `${OS_NODE_NAME}` / `${MAC_TS}` etc. from the container env. If a node logs an unresolved-placeholder error, set those values literally in the mounted yml instead (each host edits its own copy).
3. **Bootstrap checks.** A real cluster (unlike `single-node`) enforces bootstrap checks — `vm.max_map_count` (step 0.5) and the `nofile` ulimit (already set) are the ones that bite. A node that exits on boot almost always means max_map_count wasn't applied on that host.
4. **ngrok pooling syntax + start command.** `ngrok.cluster.yml` uses v3 `endpoints:` with `pooling_enabled: true`. Confirm against <https://ngrok.com/docs/agent/config/v3/> for your agent version; if pooling doesn't engage, test first with the CLI flag `--pooling-enabled=true`. Verify both agents show up in the pool from the ngrok dashboard.
5. **External URL / framing.** `GRAYLOG_HTTP_EXTERNAL_URI` is set to the https api domain. The nginx sidecar also sends `X-Graylog-Server-URL` (built from the request host). If API links or the embedded dashboard misbehave behind ngrok, align those two (adjust `X-Graylog-Server-URL` in `../graylog-branding/nginx-frame-strip.conf` to the https domain).

---

## Verify failover (the actual goal)

1. **Steady state:** `curl -XPOST https://tok-graylog-gelf.ngrok-free.dev/gelf -H 'Content-Type: application/json' -d '{"version":"1.1","host":"test","short_message":"hi"}'` → `202`; message is searchable. `rs.status()` shows PRIMARY/SECONDARY/ARBITER; `_cat/nodes` shows 3 nodes. Mobile app loads + renders the embedded dashboard.
2. **Kill the Mac** (`docker compose -f docker-compose.datanode.yml down`): GELF still returns `202` (pool → Galaxy Book), Mongo promotes the Galaxy Book to PRIMARY, OpenSearch stays writable and **historical** searches still return old data (replica shards promoted), mobile app + dashboard still work. Bring the Mac back → it rejoins `rs0` and the OpenSearch cluster.
3. **Kill the Galaxy Book** instead → same, roles reversed (proves it's symmetric).
4. **Kill the Surface** with both laptops up → nothing changes (quorum 2/3 holds) — proves the tiebreaker is non-blocking when the data nodes are healthy.

## Operational notes

- **Surface must stay awake / on AC** — losing it is safe only while **both** laptops are up. Surface asleep **and** a laptop down = quorum lost = read-only.
- **Mongo PSA write-concern:** with a Primary-Secondary-Arbiter set, `w:majority` writes can't be acked while a *data-bearing* node is down (the arbiter holds no data). Fine for Graylog's mostly-config writes; just be aware.
- **Clock sync:** keep all three on NTP — Graylog clustering and token TTLs assume synced clocks.

## Teardown

```bash
docker compose -f docker-compose.datanode.yml down      # keep data
docker compose -f docker-compose.datanode.yml down -v   # wipe this node's data
```
