# Graylog Recovery and Deno Deploy Migration Plan

Status as of 2026-06-25:

- The public Graylog UI/API path is available through `graylog-fwd` and ngrok at
  `https://tok-graylog-api.ngrok-free.dev/`.
- OpenSearch is running as a single local node and currently holds the Graylog
  message indices.
- Graylog was still configured with a multi-host MongoDB replica-set URI, which
  made it depend on Tailnet reachability even for the local MongoDB container.
- A local backup should be created before every recovery or migration step:
  `deno run --allow-net=localhost,127.0.0.1 --allow-write=backups/graylog scripts/backup-graylog.ts`

## Immediate Recovery

1. Export Graylog messages from the local OpenSearch store with
   `scripts/backup-graylog.ts`.
2. Run the cluster stack with `cluster/docker-compose.local-recovery.yml` so
   Graylog talks to `mongodb` and `opensearch` on the Docker network instead of
   the old Tailnet peer list.
3. Verify:
   - `curl -fsS http://localhost:9001/api/system/lbstatus` returns `ALIVE`.
   - `curl -fsS 'http://localhost:9200/_cluster/health?pretty'` reports `status`
     green or yellow.
   - `curl -fsS 'http://localhost:9200/graylog_*/_count?pretty'` matches the
     latest backup manifest.

## Deno Deploy Target

Best fit: replace Graylog as the long-term scrape store with a Deno Deploy app
plus a managed PostgreSQL database. Keep Graylog only as a local
recovery/inspection tool until the new ingest path has parity.

Why this fit:

- Deno Deploy runs TypeScript/JavaScript serverless apps and has first-class
  Fresh support, which matches `member-app/apps/fresh`.
- Deno Deploy databases currently support PostgreSQL and Deno KV. PostgreSQL is
  the better canonical store for searchable TikTok scrape records,
  creator/product joins, time-series filters, and admin exports.
- Deno Deploy supports Cron via `Deno.cron()`, so scheduled exports, retention
  checks, and rollups can run without a separate worker process.
- Deno Deploy observability covers app logs, traces, and metrics. Use it for the
  new ingest service's own operations, not as the primary scrape-message
  database.
- New Deno Deploy currently does not support queues, so avoid a queue-dependent
  ingest design unless that product gap closes.

Primary architecture:

1. `apps/fresh` exposes a GELF-compatible HTTP endpoint, for example
   `/api/ingest/gelf`, accepting the current extension payload shape.
2. The endpoint validates a shared token, normalizes Graylog/GELF fields into
   typed rows, and inserts into PostgreSQL.
3. Fresh dashboard routes read from PostgreSQL instead of Graylog/OpenSearch.
4. `Deno.cron()` jobs maintain daily rollups, export snapshots, and optionally
   purge data past retention.
5. Deno Deploy observability tracks ingest errors, request volume, latency, and
   outbound database calls.

PostgreSQL schema sketch:

- `scrape_messages`: immutable raw payload, source, creator, scrape timestamp,
  received timestamp, token hash, and JSON payload.
- `creator_metrics`: extracted creator-level metrics keyed by creator and scrape
  date.
- `video_metrics`: one row per video/content item with creator, content id,
  product fields, GMV, commission, and observed date.
- `ingest_rejections`: rejected payload metadata and validation reason.

Migration sequence:

1. Use the local backup's `messages.ndjson` as the source of truth.
2. Write an importer that reads each `_source`, maps known Graylog fields, and
   stores both typed columns and raw JSON in PostgreSQL.
3. Deploy the Fresh ingest endpoint to a preview timeline and replay the backup
   into the preview database.
4. Point one extension at the Deno Deploy preview endpoint and compare counts
   against Graylog for 24 hours.
5. Promote to production, update `extension-agency/config.js`,
   `extension-seller/config.js`, and mobile settings.
6. Keep Graylog read-only for at least one retention window, then archive the
   Docker volumes once the PostgreSQL export is verified.

References:

- Deno Deploy overview: https://docs.deno.com/deploy/
- Deno Deploy databases: https://docs.deno.com/deploy/reference/databases/
- Deno Deploy cron: https://docs.deno.com/deploy/reference/cron/
- Deno Deploy observability:
  https://docs.deno.com/deploy/reference/observability/
- Deno KV backups: https://docs.deno.com/deploy/kv/backup/
