# graylog-shim

A single **Deno Deploy** app + **Deno KV** that reproduces the exact two endpoints
the TokScrape clients use, so migrating off the fragile self-hosted Graylog means
clients change **only base-URL + token** — no client logic changes.

It replaces: the single-Mac Graylog node, OpenSearch, MongoDB, the docker stack,
the nginx frame-strip sidecar, the branding JAR patch, and the **paid ngrok account**.

See [`../MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) for the full design, cutover
runbook, rollback, and open decisions.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/search/universal/relative` | Graylog Universal Search (read). Basic auth `<token>:token` or `admin/<pw>`. |
| `POST` | `/gelf` | GELF HTTP input (write). Requires `_graylog_key ∈ API_TOKENS`. Returns `202`. |
| `POST` | `/api/system/sessions` | Benign stub (200 + cookie) so the optional mobile dashboard menu doesn't throw. |
| `GET/POST` | `/api/views` | Benign stub (`{views:[],total:0}`). |
| `GET`  | `/health` | `{ok:true}` for uptime checks. |

The read path parses the mini-Lucene subset clients emit (`*`, `source:x`,
`creator(.keyword):"…"`, `AND`/`OR`/parens, `field_num:[lo TO hi]`), filters by
`range` seconds, projects `&fields=`, sorts `timestamp:desc`, and returns the exact
Graylog envelope (`{messages:[{message,index}],total_results,from,to,used_indices,time}`).
It emits the `index_not_found_exception`-500 sentinel **only** when the window is
strictly newer than all data (api.js maps that to an empty window).

## Files

- `main.ts` — `Deno.serve` router, write/read handlers, Basic auth, CORS.
- `lucene.ts` — mini-Lucene tokenizer + recursive-descent parser + evaluator + `pinnedEq` (picks a KV index prefix).
- `import-to-kv.ts` — one-time loader from the backup `messages.ndjson` into KV (local file or hosted KV Connect).

## Local run + self-test

```sh
# 1. import the backup into a local file-backed KV
KV_PATH=./local.kv deno run -A --unstable-kv import-to-kv.ts ~/graylog-backups/2026-06-25/messages.ndjson
#    -> imported 827 rows from 827 lines; 817 unique _ids

# 2. run the shim
KV_PATH=./local.kv API_TOKENS=devtoken ADMIN_PASSWORD=ChangeMeAdmin! PORT=8787 \
  deno run -A --unstable-kv main.ts

# 3. query it (Graylog-compatible)
curl -u devtoken:token \
  'http://localhost:8787/api/search/universal/relative?query=source:tiktok-affiliate-export&range=157680000&limit=5'
```

## Deploy (new platform — console.deno.com; Deploy Classic shuts down 2026-07-20)

```sh
# create project `graylog-shim` + provision KV in the Databases tab, then:
deployctl env add API_TOKENS "$SHIM_TOKEN" --secret
deployctl env add ADMIN_PASSWORD "$ADMIN_PW" --secret   # optional skill fallback
deployctl deploy --prod --project graylog-shim main.ts

# one-time data import into hosted KV over KV Connect:
KV_CONNECT_URL="https://api.deno.com/v2/databases/<DB_ID>/connect" \
DENO_KV_ACCESS_TOKEN="ddo_..." \
  deno run -A --unstable-kv import-to-kv.ts ~/graylog-backups/2026-06-25/messages.ndjson
```

On Deploy, `Deno.openKv()` (no arg) auto-binds the managed KV — `KV_PATH` is unset there.

## Verified (2026-06-25, local file KV over the real 827-doc backup)

All `total_results` match the unique-`_id` ground truth (the shim dedups the 10
duplicate `_id` lines 827→817): `*`=817, affiliate=63, livestream-analytics=17,
product-analysis=13, streamer=13, data-overview=11, custom-report=12,
thirsty-store-kiosk=273, lifepreneur-extension=401, affiliate∧creator=@wizardofdealz=63,
affiliate∧`gmv_num:[100 TO *]`=3. Edge cases pass: `&fields=` projection keeps exactly
the requested keys ∪ {timestamp,source}; `gmv_num:[* TO 50]` excludes null/missing
(no `Number(null)===0` leak); `used_indices` always non-empty; a future-only window
returns the 500 sentinel; bad token → 401. Write path: GELF `host→source`,
leading-underscore strip, numeric + `short_message→message` preservation, unix-ts
honored, array batching, `202`; missing `_graylog_key` → 403.
