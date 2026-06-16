---
name: graylog-query
description: >-
  Query the TokScrape Graylog (the TikTok Shop scrape log store) from the
  command line and answer questions about the data in it. Use this whenever the
  user wants to look something up in Graylog, search the logs/messages, or asks
  a data question that the scrapers feed into Graylog — e.g. "how many affiliate
  orders did @wizardofdealz get", "what's the latest LIVE scrape for that shop",
  "which creators have data", "what sources/streams exist", "show me the
  Default price for that order", "how much GMV this week", or anything phrased as
  searching/counting/listing scraped TikTok metrics, orders, videos, creators,
  or sellers. Also trigger on direct asks like "query graylog", "search graylog
  for …", or "/graylog-query". Translate the question into a Lucene query, run
  scripts/graylog_query.py, and summarize the results.
---

# graylog-query

Lets you ask Graylog questions in plain language. Graylog is where all the
TikTok Shop scrapers land their data (creator dashboards, seller LIVE sessions,
affiliate order exports, buyer orders, …). The job here is: turn the question
into a **Lucene query + time window**, run the bundled script, and read the
answer back.

The script is a thin wrapper over Graylog's Universal Search REST endpoint
(`/api/search/universal/relative`) — the same endpoint and auth scheme the
mobile app uses in `mobile-app/www/js/api.js`. It handles auth, the Lucene
quirks, aggregation, and Graylog 7's error shapes so you don't have to.

## Workflow

1. **Map the question to a `source` + Lucene query + window.** Use the source
   table below; read `references/sources.md` for the full field list of whatever
   source is involved. If you don't know what's in there, start with
   `--list-sources` to see which sources have data, then drill in.
2. **Run the script** (always with `python3`):
   ```bash
   python3 .claude/skills/graylog-query/scripts/graylog_query.py [options]
   ```
3. **Read the result and answer.** Summarize in plain language — don't just dump
   the table. If the result is empty, say so and check the "empty vs. stale"
   note the script prints (it distinguishes "no data" from "indexes not
   registered").

The script auto-resolves the endpoint and credential, so most of the time you
just supply `--query`, a window, and maybe `--fields`.

## The script

```
graylog_query.py
  -q, --query LUCENE     Lucene query (default '*'). Quote it in the shell.
  --last 7d|24h|90m      Relative window (also: 3600 = seconds).
  --range SECONDS        Relative window in seconds.
  --all                  ~5 years (effectively all time).
  --fields a,b,c         Field whitelist for the result rows.
  --limit N              Max messages to fetch (default 200).
  --sort FIELD:dir       Default timestamp:desc.
  --terms FIELD          Count messages per distinct value of FIELD (aggregate).
  --list-sources         Shortcut for --terms source — what's in Graylog.
  --json                 Raw Graylog JSON (for piping / deep inspection).
  --show-url             Print the request URL (no creds) and exit.
  --url / --token / --user / --password   Overrides (see Auth).
```

Default window is **30 days**. Reach for `--all` when the user says "ever",
"all time", "historically", or when a narrow window comes back empty (this data
is bursty — a creator may have nothing in the last 30d but plenty overall).

`--terms` / `--list-sources` aggregate **client-side** over the fetched
messages (Graylog 7 removed the legacy `universal/.../terms` endpoint — it
404s). The script auto-raises the fetch limit for aggregation so counts are
exact for these data volumes; if you're aggregating a genuinely huge source,
bump `--limit` higher.

## Auth & endpoint

**Endpoint** defaults to the public ngrok domain
`https://tok-graylog-api.ngrok-free.dev` (override with `--url` or
`GRAYLOG_API_URL`; use `http://localhost:9000` against a local stack).

**Credential** resolution, highest priority first:
1. `--user` + `--password` (or `GRAYLOG_USER` / `GRAYLOG_PASSWORD`) — Basic auth,
   e.g. the `admin` login.
2. `--token` (or `GRAYLOG_TOKEN`) — a Graylog API token.
3. The committed token in `extension-seller/config.js` (default).

Graylog API tokens go in the Basic-auth **username** slot with the literal
password `token` — the script does this for you.

⚠️ **The committed `config.js` token goes stale.** It's whatever the last
`docker compose up` / cluster cutover wrote, and a failover or a Mongo rebuild
mints a fresh token DB that no longer recognizes it — every call then 401s. The
script detects a 401 and prints exactly how to recover. When that happens, the
cleanest fix is to mint a new token (Graylog UI → System → Users → admin → Edit
tokens) and pass it via `--token` / `GRAYLOG_TOKEN`; for a quick one-off, use
the admin login via `GRAYLOG_USER` / `GRAYLOG_PASSWORD`. **Don't hardcode admin
credentials into this skill or echo a freshly-minted token into chat** — pass
secrets through env vars or flags at call time.

## Sources at a glance

| `source:` value | What it is | Scope by |
| --- | --- | --- |
| `tiktok-bookmarklet` | Partner Center creator video-analysis | `creator` |
| `tiktok-bookmarklet-streamer` | Seller Streamer Compass video-analysis | `creator` |
| `tiktok-bookmarklet-live` | Seller LIVE Dashboard (real-time) | `shop`, `room_id` |
| `tiktok-bookmarklet-livestream-analytics` | Seller LIVE analytics dump | `creator` |
| `tiktok-bookmarklet-data-overview` | Compass "Data Overview" KPIs | `creator` |
| `tiktok-bookmarklet-creator-analysis` | Partner Center creator-analysis | (in `creators_json`) |
| `tiktok-bookmarklet-product-analysis` | Compass "Product Analytics" (multi-page) | `creator` |
| `tiktok-affiliate-export` | Affiliate xlsx upload — order rows (richest) | `creator`, `product_name`, `content_id` |
| `tiktok-bookmarklet-orders` | Buyer-side order detail ("Default" price) | `store`, `order_id` |
| `tiktok-bookmarklet-orders-list` | Buyer-side orders inventory feed | — |
| `tiktok-bookmarklet-sellers` | Partner-collabs agency detail | `campaign_id`, `status` |

Full field lists per source → `references/sources.md`. Remember: GELF custom
fields lose their leading underscore, so `_gmv_num` is queryable as `gmv_num`.

## Query recipes

Map the question → command. Quote Lucene in single quotes; escape inner double
quotes only if needed.

**"What's even in Graylog / which sources have data?"**
```bash
python3 .../graylog_query.py --list-sources --all
```

**"Which creators do we have data for?"**
```bash
python3 .../graylog_query.py --all --terms creator \
  -q 'source:tiktok-bookmarklet OR source:tiktok-bookmarklet-streamer OR source:tiktok-bookmarklet-livestream-analytics OR source:tiktok-bookmarklet-data-overview OR source:tiktok-bookmarklet-product-analysis OR source:tiktok-affiliate-export'
```
(All six creator-scoped sources — mirrors `fetchCreators` in `api.js`. Drop one
and you silently miss creators who only appear in that source.)

**"How many affiliate orders did @wizardofdealz get (ever)?"**
```bash
python3 .../graylog_query.py --all \
  -q 'source:tiktok-affiliate-export AND (creator:"@wizardofdealz" OR creator.keyword:"@wizardofdealz")'
```
The `total_results` line is the count. Add `--terms product_name` to see the
breakdown by product.

**"Show the latest LIVE scrape for that shop."**
```bash
python3 .../graylog_query.py --all --limit 1 \
  -q 'source:tiktok-bookmarklet-live' \
  --fields shop,room_id,gmv,products_count,scrapedAt
```

**"Find the Default price for an order containing 'VEVOR Softbox'."**
```bash
python3 .../graylog_query.py --all \
  -q 'source:tiktok-bookmarklet-orders AND default_product:VEVOR' \
  --fields default_product,default_variant,default_price,store,order_date
```

**"High-GMV affiliate orders this quarter."**
```bash
python3 .../graylog_query.py --last 90d \
  -q 'source:tiktok-affiliate-export AND gmv_num:[100 TO *]' \
  --fields creator,product_name,gmv_num,order_date --sort gmv_num:desc
```

For deeper structure (per-video metrics, per-product rows), the detail lives
inside `*_json` fields — pull the row with `--json` and parse the relevant
`metrics_json` / `videos_json` / `rows_json` blob.

## Interpreting results

- **`total_results`** is the true match count for the window; the table shows up
  to `--limit` rows. If `total_results` > rows shown, raise `--limit` or
  aggregate with `--terms`.
- **Empty but not an error.** `0 results` with the "empty window" note means no
  index covers that time range — widen with `--all`. `0 results` with the
  "stale ranges" note means data may exist but index ranges weren't rebuilt
  after a restore; an admin can fix it (`POST /api/system/indices/ranges/rebuild`).
  This data is genuinely bursty, so an empty narrow window is common — try
  `--all` before concluding "no data".
- This Graylog is a **3-host HA cluster behind ngrok** that sometimes runs
  degraded (single node, recovering). When it's mid-recovery only a subset of
  history is queryable — report what you actually got rather than asserting a
  number is complete.

## Guardrails

- **Read-only.** This skill only *searches*. It never ingests, never creates
  inputs/dashboards/streams, never deletes. Ingest is the bookmarklet/extension
  path; dashboard seeding is `scripts/seed-graylog.py`.
- **Don't leak secrets.** Never paste a freshly-minted API token or the admin
  password into chat or commit them here; pass them via env/flags.
- **Don't guess data.** If a query errors or the cluster is unreachable, surface
  the script's message verbatim — don't fabricate counts.
- **Prefer the script over raw curl.** It encodes the auth, the empty-window
  handling, and the aggregation fallback. If you must debug the exact request,
  `--show-url` prints it (without credentials).

## Troubleshooting

| Symptom | Meaning / fix |
| --- | --- |
| `HTTP 401` | Credential rejected — committed token is stale. Mint a fresh token or use admin via `GRAYLOG_USER`/`GRAYLOG_PASSWORD` (the script prints the steps). |
| `Could not reach Graylog … 502` | Graylog container is down (often MongoDB has no PRIMARY in a degraded cluster). The endpoint resolves but the app isn't serving. |
| `Could not reach Graylog … name resolution / timeout` | ngrok tunnel is down, or you're off the network. |
| `0 results` + "empty window" | Time range newer than all data — use `--all`. |
| `0 results` + "stale ranges" | Index ranges need rebuilding (admin), or genuinely no data. |
| Creator query misses `@x.y` handles | Use the `(creator:"@x.y" OR creator.keyword:"@x.y")` form. |
