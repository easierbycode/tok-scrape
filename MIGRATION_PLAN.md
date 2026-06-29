# Graylog → Deno Deploy Migration Plan (`graylog-shim`)

**Status:** Canonical plan. Supersedes scattered design notes.
**Date:** 2026-06-25
**Author:** Lead architect (synthesis of platform/runtime/ecosystem research, mini-Lucene spec, storage/API/cutover designs, and the adversarial verification panel — all blocker/major findings folded in).

---

## 1. Executive summary & recommendation

The TikTok-scrape log store currently lives in a **fragile single-Mac Graylog node** (degraded from a 3-host HA cluster), reachable only through **paid ngrok tunnels**. The data is tiny and append-only: **827 docs / 817 unique IDs, ~3.8 MB raw, every document < 32.5 KiB** (well under any practical value limit). The query surface clients actually emit is a **fixed, enumerable mini-Lucene subset** — not real full-text search.

**Primary recommendation — build one Deno Deploy app, `graylog-shim`, backed by Deno KV**, that exposes **exactly** the two endpoints clients already use (`GET /api/search/universal/relative` for reads, `POST /gelf` for writes). Clients change **only base-URL + token**. Seed it once from the existing `~/graylog-backups/2026-06-25/messages.ndjson`. This eliminates the self-hosted Mac, OpenSearch, MongoDB, the docker stack, the nginx frame-strip sidecar, the branding JAR patch, and the **paid ngrok account** — collapsing the whole stack to a single stateless isolate + a managed KV store on the free tier indefinitely.

**Fallback — Deno Deploy app + managed Postgres (Neon).** Adopt only if the corpus unexpectedly grows past ~100k docs or you start needing ad-hoc analytical SQL. Postgres buys real range/index power this workload will never use, and it re-introduces a second managed service, a connection pooler, and scale-to-zero pause windows — the exact fragility we're escaping. Not warranted today.

**Justification (one paragraph):** At 827 append-only docs, the storage engine is irrelevant to performance — a full in-memory scan is sub-millisecond — so the deciding factors are operational fragility, migration effort, and lock-in. Deno KV wins all three: it is part of the Deploy runtime (no second service, no pooler, no scale-to-zero pause), the backup NDJSON maps 1:1 to KV entries (a ~40-line loader), and the data is plain JSON we already hold, so effective lock-in is low. Every document fits one 64 KiB KV value with headroom, and the entire workload sits at ~0.4 % of the free tier. The one real constraint — KV is not a text-search engine — is a non-issue because the clients emit a small, fixed query grammar we evaluate ourselves in TypeScript.

---

## 2. Current state, why migrate, and the interim "fix Graylog"

### Current state (verified live 2026-06-25)
- **Graylog: UP but fragile.** A single Mac node (degraded from 3-host HA), OpenSearch green single-node, reachable **only** via paid ngrok tunnels.
- Public **READ**: `https://tok-graylog-api.ngrok-free.dev` (Graylog REST API).
- Public **WRITE**: `https://tok-graylog-gelf.ngrok-free.dev/gelf` (GELF HTTP input, port 12202).
- ngrok domains are on a **PAID** account; a free account cannot serve them.

### Data (tiny, fully characterized)
- **827 docs / 817 unique `_id`** (10 byte-identical duplicate lines collapse on import).
- Per-doc `_source`: max **32,218 B** (largest serialized `StoredDoc` ≈ **32,415 B**), avg ~2,076 B, p95 ~5,595 B — **0 docs over Deno KV's 64 KiB value limit**.
- Sources & counts: `lifepreneur-extension` 401, `thirsty-store-kiosk` 273, `tiktok-affiliate-export` 63, `tiktok-bookmarklet-livestream-analytics` 18, `tiktok-bookmarklet-product-analysis` 17, `tiktok-bookmarklet-streamer` 14, `tiktok-bookmarklet-data-overview` 12, `tiktok-bookmarklet-custom-report` 12, `tiktok-bookmarklet-live` 3, `tiktok-bookmarklet-creator-analysis` 2, plus ~15 test/probe docs.
- Local verified backup at `~/graylog-backups/2026-06-25/`: `messages.ndjson` (827 normalized `{_id, source, timestamp, fields}` lines), `indices/graylog_*.ndjson` (raw `{_index,_id,_source}`), `metadata/*.json`, tarball.

### Why migrate (fragility)
The status quo is the very thing we're trying to leave: a single degraded Mac, single-node OpenSearch, public access only through paid ngrok tunnels, a documented **502-when-Mongo-loses-PRIMARY** failure mode, and a stale-token recovery dance. A "lighter self-host" (a small VPS running just a log box) removes Graylog's weight but **keeps us in the self-hosting business** — patching, tunnels, disk, uptime. For 827 append-only structured docs, that is massive over-provisioning of operational burden. Deno Deploy is publicly addressed by design, so the paid ngrok tunnels (needed only because the Mac is behind NAT) disappear entirely.

### What "fix Graylog" means in the interim
Until the shim is cut over and soaked, **keep the old stack running untouched** — it is the rollback master and the dual-write source of truth. "Fixing Graylog" in the interim means only: keep the single Mac node and its OpenSearch up, keep the two paid ngrok tunnels alive, and if Mongo loses PRIMARY (the 502), run the standalone-surgery `rs0` recovery to restore the single-node replica set. **Do not** invest in re-standing the 3-host HA cluster — the shim replaces it. Do not touch docker/ngrok/Mac until Phase 6 (decommission), after a clean soak.

---

## 3. Target architecture

A single stateless `Deno.serve` isolate on the **new** Deno Deploy platform (`console.deno.com`, default URL `*.deno.net`). **Deploy Classic shuts down 2026-07-20 — do not build there.** One origin serves both endpoints as path routes, replacing **both** ngrok hosts. KV is auto-provisioned and auto-routed (`Deno.openKv()` needs no credentials on Deploy).

```
                          ┌─────────────────────────────────────────────────────────┐
   WRITERS (GELF)         │            graylog-shim  (Deno Deploy isolate)          │
   ─────────────          │            https://graylog-shim.<org>.deno.net          │
   extension-seller/*  ──┐│                                                          │
   extension-agency/*  ──┤│   POST /gelf  ─────────►  handleGelf()                   │
   extension-creator-  ──┤│     (GELF v1.1 JSON,      • host → source                │
     demo/background    ││      _graylog_key gate)    • strip leading "_"            │
   mobile app app.js   ──┤│                            • short_message → message     │     ┌──────────────┐
     (affiliate export) ││                            • unix-secs ts → ISO          │────►│   Deno KV    │
   seed/run-bookmarklet ─┘│                            • atomic upsert by _id  ──────┼────►│  (us-east4,  │
                          │                            • 202 empty body              │     │  replicated  │
   READERS (REST)         │                                                          │     │  ≥3 DCs,     │
   ─────────────          │   GET /api/search/universal/relative ► handleSearch()    │◄────│  free tier)  │
   mobile app api.js   ──►│     (Basic auth: <token>:token OR admin/<pw>)            │     └──────────────┘
   graylog-query skill ──►│     • parse mini-Lucene → AST                            │       ["doc",id]→StoredDoc
   build-preloaded.js  ──►│     • pin KV prefix on source/creator, else scan         │       ["ix","ts",tsDesc,id]
     (isCreatorKnown)     │     • range/field/limit/sort • honest total_results      │       ["ix","source",…]
                          │     • empty-window 500 ONLY if window newer than all data│       ["ix","creator",…]
   STUBBED (droppable)    │   POST /api/system/sessions ► 200 + Set-Cookie (no dash) │       ["msg_by_id",id]→primary
   ─────────────          │   GET/POST /api/views      ► benign 200 stub            │
                          │   GET /health              ► {ok:true}                   │
                          │   Deno.cron (top-level): daily exportEntries → backup    │
                          └─────────────────────────────────────────────────────────┘
                                          │ (daily NDJSON export)
                                          ▼
                              R2 / S3 bucket  OR  GitHub contents API commit
                              (+ off-machine ~/graylog-backups master, frozen seed)
```

**Platform facts (2026):** new Deno Deploy is GA; `Deno.cron` and Deno KV both supported; **Deno Queues are NOT** (dropped from design — ingest is synchronous, write volume is trivial); no managed KV backup (we DIY via cron). KV default consistency is strong; **reads use `consistency: "eventual"`** for low global latency (staleness irrelevant for an append-only log). Free tier: 1 GiB KV, 450k read units/mo, 300k write units/mo, 1M requests/mo, 15 h CPU/mo — this workload is < 1 % of every line.

---

## 4. Storage / KV schema (final, corrected)

**Correction folded in (Verify-panel Findings B & ops-#5):** the two earlier design drafts disagreed on the index value. The **id-pointer-only** layout forced an N+1 `kv.get` per candidate (817 follow-up reads on every full scan — `fetchCreators`, the all-accounts dashboard), inflating read units ~6–7× and cold-start latency. **Final decision: store the full `StoredDoc` inline in the time-ordered primary key**, so a scan is one `kv.list` with zero deref. Secondary keys store only a pointer.

### Keyspaces

```
["doc", id]                            -> StoredDoc           // canonical copy (point-get / dedup)
["ix","ts",     tsDesc, id]            -> StoredDoc           // global, newest-first (full scan)
["ix","source", source, tsDesc, id]   -> StoredDoc           // source:x prefix scan
["ix","creator",creator,tsDesc, id]   -> StoredDoc           // creator-pinned prefix (sparse; optional)
["msg_by_id",   id]                    -> ["ix","ts",tsDesc,id]  // idempotency pointer to primary
```

- `StoredDoc` is duplicated into each index value (max ~32.5 KiB × up to 4 keys ≈ 130 KiB total per doc; storage is ~5 MB total — 0.5 % of free tier). This trades a little storage for **zero-deref reads**, the right call at this scale.
- `["msg_by_id", id]` holds the **primary key tuple** (tiny), not a doc copy — it answers "does this `_id` exist, and under which `tsDesc`?" in one get, so an upsert that changes a timestamp can delete the stale primary/index rows instead of orphaning them.

### `tsDesc` — fixed-width descending timestamp

KV sorts keys lexicographically, so encode the timestamp **descending** to make `kv.list` yield `timestamp:desc` natively (no in-isolate sort):

```ts
const MAX_TS = Number.MAX_SAFE_INTEGER;          // 9007199254740991 (16 digits)
const tsKey = (epochMillis: number): string =>
  String(MAX_TS - epochMillis).padStart(16, "0"); // larger ms → smaller key → sorts first
```

### `StoredDoc` shape

```ts
interface StoredDoc {
  _id: string;                       // preserved Graylog/import id (idempotency key)
  source: string;                    // == fields.source == GELF host
  timestamp: string;                 // canonical ISO "2026-05-28T03:17:37.000Z" (always UTC Z)
  index: string;                     // synthetic echo: "graylog_kv" (or original _index if known)
  fields: Record<string, unknown>;   // FLAT field map = the response `message` object verbatim
}
```

The flat `fields` map already embeds `source`, `timestamp`, and `message`, so the response `message` is literally `{ ...doc.fields, timestamp: doc.timestamp, source: doc.source }` (re-stamping the two canonical keys guarantees they exist and are normalized). `_id`/`index` live **outside** `fields` so they don't leak into the `&fields=` whitelist projection.

### Decisions of consequence
- **Creator index kept but treated as optional.** Only ~116/827 docs carry a `creator`, and creator clauses are always AND'd under a `source:` that already narrows the candidate set to ≤401 docs. The index lets `creator`-pinned queries skip the global scan; the residual creator match is a sub-ms in-isolate filter either way. Writing it costs one extra atomic mutation — acceptable.
- **Synthetic `index`.** The backup `messages.ndjson` lines carry no `_index` (it lives only in the raw `indices/*.ndjson`). New writes and imports use `index: "graylog_kv"`, so `used_indices` and `entry.index` stay populated. (See §5 for why `used_indices` must never be empty on a real query.)

---

## 5. The `graylog-shim` API (final)

Single `Deno.serve` app. Endpoints below are **exactly** what clients hit; everything else is a benign stub or 404.

### 5.1 Endpoint & decision table

| Endpoint | Behavior | Notes (corrections folded in) |
|---|---|---|
| `POST /gelf` | Accept single GELF object **or** array. **Mandatory `_graylog_key ∈ API_TOKENS` gate** (ops-#3 BLOCKER fix). Strip the key, map `host→source`, strip leading `_`, derive ts, atomic upsert, return `202` empty body. | Every extension scraper already sends `_graylog_key`; the mobile affiliate sender (`app.js`) does **not** — Phase 4 adds it (one line). Closes the permanent public-write hole that a stable `*.deno.net/gelf` would otherwise have. |
| `GET /api/search/universal/relative` | Parse mini-Lucene + `range` + `fields` + `limit` + `sort`; pin KV prefix on source/creator else full scan; filter/sort/project; return the exact Graylog envelope. | The one read path all clients share. |
| **Empty window** | Return `index_not_found_exception`-500 **only when the requested window is strictly newer than every stored doc** (`minMs > newestStoredMs`). Otherwise return a normal `200` with `total_results:0`. | **Finding A BLOCKER fix:** the earlier `main.ts` returned 500 for *any* empty bounded window, which diverges from real Graylog (e.g. a valid `--last 7d` query for a creator whose orders are all older). Real Graylog answers 200; the shim now matches. |
| `used_indices` | **Always `["graylog_kv"]` on any non-empty-window response**, including a legitimately-empty all-time query. | **Finding C fix:** empty `used_indices` trips the skill's alarming "index ranges are stale after a restore" hint (`graylog_query.py:425`). Reserve empty `used_indices` solely for the strictly-newer-than-all-data 500 path. |
| `POST /api/system/sessions` | Stub: `200 {session_id, valid_until}` + `Set-Cookie`. No embedded dashboard. | `establishSession()` only needs a 200 so the WebView's optional dashboard menu doesn't throw; the dashboard page itself is droppable. |
| `GET/POST /api/views` | Benign `200` stub (`{views:[],total:0}`). | `build-preloaded.js` + `seed-graylog.py` already warn-and-continue on failure. |
| `GET /health` | `200 {ok:true}` | For uptime monitoring. |
| Auth (REST) | HTTP Basic: accept `<API_TOKEN>:token` **and** `admin/<ADMIN_PASSWORD>`. Tokens from env. | Preserves both schemes (mobile/extension token, skill admin fallback). |
| CORS | `Access-Control-Allow-Origin: *`, allow `Authorization, Accept, Content-Type, X-Requested-By`; handle `OPTIONS` preflight. | api.js fetches `credentials:'omit'`. |

### 5.2 Mini-Lucene subset the evaluator must handle

Clients emit only these shapes (full catalog in the spec; this is the exhaustive set):

- `*` — match all.
- `source:<value>` — bare token, equality on stored `source`.
- `creator:"<phrase>"` and `creator.keyword:"<phrase>"` — quoted; **both treated as equality on stored `creator`** (no analyzer in a KV store; they're always OR'd so either matching suffices). Phrases may contain `@` and `.`; unescape `\"`.
- `<field>_num:[lo TO hi]` — inclusive numeric range; `lo`/`hi` are integers/decimals or `*` (unbounded). Also `[* TO N]`, `[A TO B]`.
- `AND` / `OR` (case-insensitive), parenthesized **and** unparenthesized, arbitrary nesting, standard **AND-binds-tighter-than-OR** precedence.
- `&fields=<csv>` whitelist — restrict each `message` to the listed fields **∪ {timestamp, source}** (always included). Absent ⇒ return all stored fields.
- `sort=timestamp:desc` — constant on every call; results newest-first.
- `range=<seconds>` — `now-range ≤ ts ≤ now`; **`0` or any value `≥ 157,680,000` (~5 yr) means all-time/unbounded**.

### 5.3 Key TypeScript — write path (`main.ts`)

```ts
const kv = await Deno.openKv();

const API_TOKENS  = new Set((Deno.env.get("API_TOKENS") ?? "").split(",").map(s=>s.trim()).filter(Boolean));
const ADMIN_USER  = Deno.env.get("ADMIN_USER") ?? "admin";
const ADMIN_PW    = Deno.env.get("ADMIN_PASSWORD") ?? "";
const FIVE_YEARS_S = 157_680_000;
const MAX_TS = Number.MAX_SAFE_INTEGER;
const tsKey = (ms: number) => String(MAX_TS - ms).padStart(16, "0");
const SYNTH_INDEX = "graylog_kv";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type, X-Requested-By",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type":"application/json", ...CORS, ...extra } });

function gelfToDoc(g: Record<string, unknown>): StoredDoc {
  const source = String(g.host ?? "unknown");
  // GELF timestamp is unix SECONDS (may be fractional, may be a numeric string).
  // Coerce with NaN-guard; fall back to receive time. (Verify Finding D.)
  const n = g.timestamp != null ? Number(g.timestamp) : NaN;
  const ms = Number.isNaN(n) ? Date.now() : Math.round(n * 1000);
  const ts = new Date(ms).toISOString();
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    if (k === "version" || k === "host" || k === "timestamp" || k === "level" || k === "_graylog_key") continue;
    if (k === "short_message" || k === "full_message") { fields.message = v; continue; }
    fields[k.startsWith("_") ? k.slice(1) : k] = v; // _order_id -> order_id; numbers stay numeric
  }
  fields.source = source; fields.timestamp = ts;
  const _id = typeof g._id === "string" && g._id ? g._id : `${ms}-${crypto.randomUUID()}`;
  return { _id, source, timestamp: ts, index: SYNTH_INDEX, fields };
}

async function putDoc(doc: StoredDoc) {
  const tk = tsKey(Date.parse(doc.timestamp));
  const primary: Deno.KvKey = ["ix", "ts", tk, doc._id];
  const creator = (doc.fields.creator ?? "") as string;
  const prior = await kv.get<Deno.KvKey>(["msg_by_id", doc._id]);
  let a = kv.atomic();
  if (prior.value && !(prior.value.length === primary.length && prior.value.every((p,i)=>p===primary[i]))) {
    // _id moved (corrected ts on re-import): drop stale rows to avoid orphans
    a = a.delete(prior.value);
  }
  a = a.set(["doc", doc._id], doc)
       .set(primary, doc)
       .set(["ix", "source", doc.source, tk, doc._id], doc)
       .set(["msg_by_id", doc._id], primary);
  if (creator) a = a.set(["ix", "creator", creator, tk, doc._id], doc);
  const res = await a.commit();
  if (!res.ok) throw new Error(`KV commit failed for ${doc._id}`);
}

async function handleGelf(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400, headers: CORS }); }
  const items = Array.isArray(body) ? body : [body];
  for (const g of items) {
    if (!g || typeof g !== "object") continue;
    const rec = g as Record<string, unknown>;
    // MANDATORY write gate (ops-#3). Every sender includes _graylog_key.
    const key = typeof rec._graylog_key === "string" ? rec._graylog_key : "";
    if (API_TOKENS.size > 0 && !API_TOKENS.has(key)) {
      return new Response("forbidden", { status: 403, headers: CORS });
    }
    await putDoc(gelfToDoc(rec));
  }
  return new Response(null, { status: 202, headers: CORS }); // 202 + empty body
}
```

### 5.4 Key TypeScript — read path (`main.ts`)

```ts
// newestStoredMs cached at module load + refreshed on each write; used for the empty-window gate.
let newestStoredMs = 0;
async function loadNewest() {
  for await (const e of kv.list<StoredDoc>({ prefix: ["ix","ts"] }, { limit: 1 })) {
    newestStoredMs = Date.parse(e.value.timestamp); // first key = newest (tsDesc)
  }
}
await loadNewest();

async function candidates(ast: Node): Promise<StoredDoc[]> {
  const src = pinnedEq(ast, "source"), cre = pinnedEq(ast, "creator");
  const prefix: Deno.KvKey = src ? ["ix","source",src] : cre ? ["ix","creator",cre] : ["ix","ts"];
  const out: StoredDoc[] = [];
  for await (const e of kv.list<StoredDoc>({ prefix }, { batchSize: 500, consistency: "eventual" })) {
    out.push(e.value);            // value IS the full doc — no follow-up get (Finding B)
  }
  return out;                     // already timestamp:desc via tsDesc ordering
}

async function handleSearch(url: URL): Promise<Response> {
  const t0 = performance.now();
  const ast    = parse(url.searchParams.get("query") || "*");
  const range  = Number(url.searchParams.get("range") ?? "0");
  const limit  = Number(url.searchParams.get("limit") ?? "150");
  const fcsv   = url.searchParams.get("fields");
  const fields = fcsv ? fcsv.split(",").map(s=>s.trim()).filter(Boolean) : null;

  const unbounded = range === 0 || range >= FIVE_YEARS_S;
  const nowMs = Date.now();
  const minMs = unbounded ? -Infinity : nowMs - range * 1000;

  const pool = await candidates(ast);
  const matched = pool.filter(d => {
    const ms = Date.parse(d.timestamp);
    return ms >= minMs && ms <= nowMs && evalNode(ast, d.fields);
  });
  matched.sort((a,b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); // stable; no-op if single prefix

  const total = matched.length;

  // EMPTY-WINDOW: 500 sentinel ONLY when the window is strictly newer than ALL data (Finding A).
  if (total === 0 && !unbounded && minMs > newestStoredMs) {
    return new Response(
      JSON.stringify({ type: "ApiError", message: "index_not_found_exception no such index []" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }

  const messages = matched.slice(0, limit).map(d => {
    let m: Record<string, unknown> = d.fields;
    if (fields) { // whitelist ∪ {timestamp, source}
      const keep: Record<string, unknown> = { timestamp: d.fields.timestamp, source: d.fields.source };
      for (const f of fields) if (f in d.fields) keep[f] = d.fields[f];
      m = keep;
    }
    return { message: m, index: d.index };
  });

  return json({
    messages,
    total_results: total,                                   // honest count, may exceed limit
    from: unbounded ? new Date(0).toISOString() : new Date(minMs).toISOString(),
    to:   new Date(nowMs).toISOString(),
    used_indices: ["graylog_kv"],                           // ALWAYS non-empty (Finding C)
    time: Math.round(performance.now() - t0),
  });
}
```

### 5.5 Key TypeScript — parser + evaluator (`lucene.ts`)

Hand-written recursive-descent for the §5.2 grammar. The numeric-range evaluator carries the **`Number(null)===0` guard** (Verify Finding 1):

```ts
export type Node =
  | { t: "all" }
  | { t: "term"; field: string; value: string }
  | { t: "range"; field: string; lo: number | null; hi: number | null }
  | { t: "and"; kids: Node[] }
  | { t: "or";  kids: Node[] };

export function evalNode(n: Node, f: Record<string, unknown>): boolean {
  switch (n.t) {
    case "all":  return true;
    case "and":  return n.kids.every(k => evalNode(k, f));
    case "or":   return n.kids.some(k => evalNode(k, f));
    case "term": return String(f[n.field] ?? "") === n.value;        // string equality
    case "range": {
      const raw = f[n.field];
      // CRITICAL: null/undefined/"" are NON-numeric. Number(null)===0 would
      // make a missing gmv_num match [* TO 100] / [0 TO *] as if GMV were 0.
      if (raw == null || raw === "") return false;
      const v = Number(raw);
      if (Number.isNaN(v)) return false;
      if (n.lo != null && v < n.lo) return false;                    // inclusive bounds
      if (n.hi != null && v > n.hi) return false;
      return true;
    }
  }
}

// pinnedEq picks a KV index prefix when the query pins source/creator at top level
// (handles `source:x` and `(source:x) AND ...`). creator.keyword collapses to creator.
export function pinnedEq(n: Node, field: string): string | null {
  if (n.t === "term" && n.field === field) return n.value;
  if (n.t === "and") for (const k of n.kids) { const v = pinnedEq(k, field); if (v) return v; }
  return null;
}
```

The tokenizer/parser (omitted here for brevity, ~80 lines) handles quoted phrases with `\"` unescaping, `[lo TO hi]` ranges, parentheses, and `AND`/`OR` as standalone operators (distinguished from a field named `and`/`or` by the absence of a following `:`). `atomToNode` rewrites `creator.keyword` → `creator`.

---

## 6. Data import of the 827-doc backup

One-time local loader over **KV Connect** (`Deno.openKv("https://api.deno.com/v2/databases/<ID>/connect")` with `DENO_KV_ACCESS_TOKEN`). The backup line shape is `{_id, source, timestamp, fields}` — **not** `@deno/kv-utils` format — so use a direct loader, not `importEntries`.

**Two load-bearing import details (Verify panel):**

1. **Timestamp normalization (one char from corruption).** Backup timestamps are **space-separated UTC** (`"2026-05-28 03:17:37.000"`, no zone). Parse as `Date.parse(ts.replace(' ','T') + 'Z')`. **Never** `new Date("2026-05-28 03:17:37.000")` — V8 parses the space form as **local** time (a 7 h skew on this box), shifting every timestamp. The wire contract is ISO-`T`-`Z`, which `replace(' ','T')+'Z'` reproduces faithfully.

2. **Batch byte-guard must measure real bytes (Finding 2).** The 250 largest docs sum to **945 KiB** — over Deno KV's **800 KiB/atomic-op** cap. Don't estimate `line.length + 200` (it undercounts the multi-key `StoredDoc`). Measure `JSON.stringify(doc).length` per key, flush at **≤ ~400 KiB or ≤ 100 docs**, whichever first. Extra commits are free at 817 docs.

```ts
// scripts/import-to-kv.mjs  (deno run --unstable-kv --allow-env --allow-net --allow-read)
const MAX_TS = Number.MAX_SAFE_INTEGER;
const tsKey = (ms) => String(MAX_TS - ms).padStart(16, "0");
const SYNTH_INDEX = "graylog_kv";

function parseTs(ts) {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const ms = Date.parse(iso.endsWith("Z") ? iso : iso + "Z");   // ALWAYS UTC Z
  if (Number.isNaN(ms)) throw new Error(`bad timestamp: ${ts}`);
  return ms;
}

const kv = await Deno.openKv(Deno.env.get("KV_CONNECT_URL"));   // reads DENO_KV_ACCESS_TOKEN
const lines = (await Deno.readTextFile(Deno.args[0])).split("\n").filter(l => l.trim());

let a = kv.atomic(), nDocs = 0, nBytes = 0, written = 0; const seen = new Set();
const flush = async () => { if (nDocs) { const r = await a.commit(); if (!r.ok) throw new Error("commit failed");
                                        written += nDocs; a = kv.atomic(); nDocs = 0; nBytes = 0; } };

for (const line of lines) {
  const d = JSON.parse(line);
  const ms = parseTs(d.timestamp);
  const ts = new Date(ms).toISOString();
  const fields = { ...d.fields, source: d.source, timestamp: ts };
  const doc = { _id: d._id, source: d.source, timestamp: ts, index: SYNTH_INDEX, fields };
  const tk = tsKey(ms), primary = ["ix","ts",tk,d._id];
  const docBytes = JSON.stringify(doc).length;
  const creator = fields.creator ?? "";
  a = a.set(["doc",d._id],doc).set(primary,doc)
       .set(["ix","source",d.source,tk,d._id],doc).set(["msg_by_id",d._id],primary);
  if (creator) a = a.set(["ix","creator",creator,tk,d._id],doc);
  seen.add(d._id);
  nDocs++; nBytes += docBytes * (creator ? 4 : 3) + 400;        // real bytes, not line.length
  if (nDocs >= 100 || nBytes >= 400_000) await flush();         // under 800 KiB / 1000 mutations
}
await flush();
console.log(`imported ${written} rows from ${lines.length} lines; ${seen.size} unique _ids`);
// expect: 827 lines, 817 unique _ids (10 byte-identical dups collapse via last-write-wins)
```

**Idempotency & verification:** keyed on `_id`, so the 10 duplicate lines collapse to 817 rows and re-running the loader is safe. After load: `query=*&range=157680000` → `total_results: 817`; per-source counts must match `metadata`/`expected-counts.txt` (gate on **counts**, not the stale `messages_sha256` — see Phase 0). Spot-check a real affiliate Q3 with a `&fields=` whitelist and newest-first ordering. Max value ≈ 32.5 KiB < 64 KiB confirmed; 2 docs contain emoji (astral chars) which round-trip losslessly through JSON parse + V8 structured-clone.

---

## 7. Cutover runbook + rollback

**Strategy:** deploy empty → import → verify parity → dual-write overlap (Graylog still up) → repoint clients low-blast-radius first → verify matrix → soak → decommission. Instant rollback at every step before decommission.

### Phase 0 — Prereqs & freeze the source of truth
- **0.1** Confirm old stack up (rollback + dual-write base): `curl -u "$OLD_TOKEN:token" '.../tok-graylog-api.ngrok-free.dev/api/search/universal/relative?query=*&range=157680000&limit=1'` → 200. Don't touch docker/ngrok/Mac until Phase 6.
- **0.2** `deno --version` (≥2), `deployctl --version` (`deno 2.7.14` + deployctl already present; else `deno install -gArf jsr:@deno/deployctl`).
- **0.3** **Re-pin integrity (the manifest hash is stale).** `manifest.json.messages_sha256` (`21dac2c8…`) does NOT match current `messages.ndjson` (`ed5c58e4…`) — re-normalized after the manifest was written. Re-pin: `shasum -a 256 messages.ndjson > messages.sha256`; `wc -l` → 827; dump per-source counts to `expected-counts.txt`. **Gate import parity on doc-count (827) + per-source counts** (which DO match metadata), never the stale hash. Copy the whole backup dir off-machine.
- **0.4** New Deno Deploy (console.deno.com): create org + app `graylog-shim`; provision KV in the **Databases** tab (attach to Production + Development); grab **Database ID** + a `ddo_…` KV access token (CLI import only). Default URL `https://graylog-shim.<org>.deno.net` is stable; one origin, two paths.
- **0.5** **Mint ONE `$SHIM_TOKEN`** (`openssl rand -hex 26`) accepted for both READ Basic-auth and the GELF `_graylog_key` gate. Converge the three divergent token literals to it (scrapers `…adns8`, demo `…krlr`, mobile `…amr`). Optionally keep `admin/ChangeMeAdmin!` accepted for the skill fallback.
- **0.6** Set secrets (write-only): `deployctl env add API_TOKENS "$SHIM_TOKEN" --secret`; optional `ADMIN_USER`/`ADMIN_PASSWORD`.
- **0.7 Custom-domain decision:** ship the bare `*.deno.net` URL (stable, auto-TLS, lets you drop the paid ngrok account, no DNS work). Take a custom domain only for branding or to keep a CNAME you control (so a future re-platform doesn't require an APK/IPA re-release — the slow client). Verify in-console whether custom domains are free on your tier first. **Pin `$SHIM_BASE` now**; every Phase-4 edit uses `$SHIM_BASE` (read) and `$SHIM_BASE/gelf` (write).

### Phase 1 — Deploy the shim (empty but live)
- **1.1** Land `graylog-shim/main.ts` + `lucene.ts` (§5) with the corrected KV layout, empty-window gate, and `used_indices` rule.
- **1.2 Stand up the backup cron NOW (ops-#4 fix — not Phase 8).** Add the top-level `Deno.cron` daily `exportEntries → R2/GitHub` job in the first deploy, so no production write ever lands without a backup path.
- **1.3** `deployctl deploy --prod --project graylog-shim main.ts`.
- **1.4** Smoke: all-time match-all on empty corpus → correct envelope; bad creds → 401; empty-window (window strictly in the future) → 500 with `index_not_found_exception`; CORS allows `Authorization, Accept, X-Requested-By`.

### Phase 2 — Import + verify parity
- **2.1–2.2** Run `scripts/import-to-kv.mjs` (§6) over KV Connect → `imported 827 … 817 unique`.
- **2.3** Via shim: `query=*&range=157680000` → `total_results: 817`.
- **2.4** Per-source parity loop against `expected-counts.txt` — **every line OK before proceeding.**
- **2.5** Spot-check `source:tiktok-affiliate-export AND (creator:"@wizardofdealz" OR creator.keyword:"@wizardofdealz")` with `&fields=` whitelist, newest-first.

### Phase 3 — Dual-write overlap (Graylog still running)
- **3.1** GELF round-trip probe with the new gate: `POST $SHIM_BASE/gelf {version:"1.1",host:"cutover-probe",_graylog_key:"$SHIM_TOKEN",_probe_id:"$P",timestamp:<unix>}` → 202; then `query=source:cutover-probe&range=3600` confirms `host→source`, `_probe_id→probe_id`, unix-ts honored, newest-first. Confirm a request **without** `_graylog_key` → 403.
- **3.2** (Optional) point ONE low-traffic sender at the shim *in addition to* ngrok, fire one real scrape, confirm it lands, revert. Verify the Phase-1 backup cron produced its first export. **Gate:** Phases 1–3 green ⇒ proceed; any red ⇒ fix shim (nothing in prod moved yet).

### Phase 4 — Repoint every client (URL + token only)

| Bucket | File(s) / target | Change |
|---|---|---|
| **4a WRITE config** | `extension-seller/config.js` L4–5; `extension-agency/config.js` L4–5; `extension-creator-demo/background.js` L21–22 (inline) | `GRAYLOG_ENDPOINT → $SHIM_BASE/gelf`, `GRAYLOG_TOKEN → $SHIM_TOKEN`. Scrapers inherit via `TOK_CONFIG`. (Skill reads seller `GRAYLOG_TOKEN` for READ ⇒ must be the converged token.) |
| **4b host_permissions** | `extension-creator-demo/manifest.json` **L15 (HARD match — MUST change)** → `$SHIM_BASE/*`; `extension-seller/manifest.json` + `extension-agency/manifest.json` → **ADD** `$SHIM_BASE/*` (they ride the `*.ngrok-free.dev` wildcard). Reload all three extensions. | Optionally drop ngrok wildcards post-cutover. |
| **4c GELF token on mobile sender** | `mobile-app/www/js/app.js` `gelfFromOrder` (L1265) | **ADD `_graylog_key: settings.token`** to the GELF body so the mandatory write gate accepts mobile affiliate uploads. (Extension scrapers already send it.) |
| **4d skill** | `.claude/skills/graylog-query/scripts/graylog_query.py` L70 `DEFAULT_URL → $SHIM_BASE`; update ngrok/cluster error text; `--opensearch` mode is dead (delete or leave, host-only). `SKILL.md`: rewrite endpoint default, remove `--opensearch`/HA-cluster narrative. `references/sources.md`: **no edit** (it's the schema the shim reproduces). | |
| **4e build/CI** | `build-preloaded.js` L267 GELF default → `$SHIM_BASE/gelf`; `gh secret set GRAYLOG_URL_PROD -b "$SHIM_BASE"`, `gh secret set GRAYLOG_TOKEN_PROD -b "$SHIM_TOKEN"` (no YAML edit — both workflows already read these). `preload.js`(.example) L26 cosmetic. | `ensureDashboardId`/Views-API 404 already warns-and-continues. |
| **4f OTA defaults + the URL-migration BLOCKER fix** | `mobile-app/www/js/app.js` L39–41 → shim URLs/token. **See critical note below.** | |
| **4g rebuild** | `gh workflow run build-apk-preloaded.yml` / `build-ios-preloaded.yml`; distribute. | Only helps *net-new* installs (ops-#2). |
| **4h tooling heuristics (keyed on "ngrok")** | `run-bookmarklet.ts` L433–439; `run-partner-center-bookmarklet/SKILL.md` L43/117/190/207; `seed-graylog.py` L316 default `--endpoint` → shim host. | Drop docker/Views remediation text. |
| **4i** | `scripts/sync-bookmarklet.py` | Delete, or slim to a fixed-URL stamper (no ngrok/admin-token logic). |
| **4j docs** | `README.md`, `mobile-app/README.md` architecture/secrets; `config.xml` already `*` (cosmetic comments). | |

> **🔴 BLOCKER fix — Phase 4f, the mobile URL migration (ops-#1).** The existing `loadSettings()` (app.js L66–73) re-seeds the token **only if `url === DEFAULT_GRAYLOG_URL`** *already*. After cutover, `DEFAULT_GRAYLOG_URL` is the shim host, but every already-migrated install has the **old ngrok host** persisted in `localStorage` — so the guard fails and the install stays stranded on the dead host. **Bumping `GRAYLOG_TOKEN_MIGRATION_KEY` v4→v5 is necessary but NOT sufficient** (the key check is `&&`-ed *after* the URL check, so it never runs). Likewise a plain APK reinstall is a no-op because `preload.js` seeds via `setIfMissing` and the key already exists.
>
> **Required change:** add an explicit **base-URL migration** that runs *before* the token guard and force-rewrites `url` from any known-dead host to `DEFAULT_GRAYLOG_URL` once, then triggers the token re-seed on that same migration. Sketch:
> ```js
> var GRAYLOG_URL_MIGRATION_KEY = 'tok-scrape.graylogUrl.v1';
> var DEAD_HOSTS = ['https://tok-graylog-api.ngrok-free.dev'];
> if (DEAD_HOSTS.indexOf(url) !== -1 &&
>     localStorage.getItem(GRAYLOG_URL_MIGRATION_KEY) !== '1') {
>   url = DEFAULT_GRAYLOG_URL;
>   migratedToken = DEFAULT_GRAYLOG_TOKEN;              // re-seed token alongside the URL
>   localStorage.setItem(GRAYLOG_URL_MIGRATION_KEY, '1');
>   localStorage.setItem(GRAYLOG_TOKEN_MIGRATION_KEY, '1');
> }
> ```
> Ship via OTA (JS/CSS only, never index.html). This — not the rebuilt APK — is the lever that actually re-points existing devices. Also bump `GRAYLOG_TOKEN_MIGRATION_KEY` to `v5` for net-new token refreshes.

### Phase 5 — Verification matrix (shim; Graylog still up)
Key rows (all must pass): skill `--list-sources` counts match `expected-counts.txt`; each mobile `fetch*` (Scrapes / LiveAnalytics / DataOverview / CreatorAnalytics / ProductAnalytics / AffiliateOrders / Creators / isCreatorKnown) returns its corpus newest-first; **empty bounded window with older data returns 200 total_results:0** (Finding A — not a 500); window strictly in the future maps to `_emptyWindow` and the auto-widen ladder advances; numeric range `gmv_num:[100 TO *]` filters and a `gmv_num:null` doc does **not** match `[* TO 100]` (Finding 1); a legitimately-empty all-time query does **not** print the "stale index ranges" hint (Finding C); **one live scrape ingests (202 with `_graylog_key`) and appears in search**; a GELF POST **without** `_graylog_key` → 403; bad token → 401 surfaced cleanly. **Gate:** all green, then soak 1–2 days so real scrapers exercise the write path.

### Phase 6 — Decommission (only after soak)
1. `grep -rn 'ngrok-free'` shows only comments. 2. `docker compose down -v`; archive `docker-compose.yml`/`ngrok.yml`. 3. Archive `cluster/`. 4. Release `tok-graylog-api`/`tok-graylog-gelf` domains, **cancel/downgrade the paid ngrok account**. 5. Archive `graylog-branding/`, `graylog-local-setup.md` (mark deprecated). 6. Remove/slim `sync-bookmarklet.py`. 7. **Keep `~/graylog-backups/2026-06-25/` off-machine indefinitely** — only copy of the original `_index`/mappings/views.

### Phase 7 — Rollback
- **Before Phase 6 = instant flip-back** (Graylog still running, data never left it): `git revert` the per-bucket commits + reload extensions; reset GH secrets to old ngrok URL+token and rebuild. For migrated mobile installs, ship a **`v2` URL-migration** that points `DEAD_HOSTS` at the shim and rewrites back to the Graylog host (migrate forward to roll back) — and bump **both** the URL and token keys (the rollback lever has the same URL-blindness as the forward cutover, ops-#7).
- **Data-only:** re-run idempotent import (§6) from the untouched NDJSON; first `exportEntries` any shim-only writes so they aren't lost.
- **After Phase 6:** re-stand Graylog from `indices/graylog_*.ndjson` — slow, which is why Phase 6 waits for a clean soak.
- **Triggers:** empty/error fetches for known data, source-count drift, scrapes not appearing, spurious 401/403s, envelope breakage.

---

## 8. Ongoing ops

- **8.1 KV backup (DIY — no managed backup on new platform).** Daily top-level `Deno.cron` (`exportEntries(kv, {prefix:["doc"]}, {type:"string"})` → R2/S3 via `aws4fetch`, or a GitHub contents-API commit). **Stand up in Phase 1**, not later (ops-#4). Keep the off-machine NDJSON master as cold-start seed. Constraints: ≤10 crons, top-level registration, UTC schedules, no overlapping runs.
- **8.2 Monitoring.** Console request/error + KV unit metrics (all <1 % of free tier). External uptime ping on `/health` or `query=*&range=3600&limit=0`.
- **8.3 Token rotation.** Shim accepts old+new during overlap → update 3 config files + the mobile `_graylog_key` + GH secret → bump the URL/token migration keys + OTA/rebuild → drop old token. Same key discipline as cutover (URL migration is the carrier for installed apps).
- **8.4 Custom domain (optional).** Add in console → Domains, point ANAME/ALIAS + `_acme-challenge` CNAME; TLS auto-provisions (Let's Encrypt, ~90 s). Owning a CNAME means a future re-platform needs no APK/IPA re-release.
- **8.5 Retention (optional).** Append-only; if ever pruning, a `Deno.cron` `kv.list({prefix:["ix","ts"], start:[…cutoff…]})` → delete (mirror-delete the `["doc"]`, `["ix","source"]`, `["ix","creator"]`, `["msg_by_id"]` keys). Not needed at 827 docs.

---

## 9. Open questions / decisions for the user

1. **Custom domain or bare `*.deno.net`?** Recommendation: ship bare `*.deno.net` (simplest, drops paid ngrok). Take a custom domain only if you want a branded host or a CNAME you control for future re-platforming. **First verify in-console whether custom domains are free on your tier** (the pricing page lists 50 on Free; older docs implied Pro+).
2. **One token or split read/write?** Recommendation: **one converged `$SHIM_TOKEN`** (simplest; the skill reads the write-config token for READ). If you split later, you must update `extension-seller/config.js` for the skill and keep both accepted on the shim.
3. **Keep the `admin/ChangeMeAdmin!` fallback?** The skill uses it when the token is stale. Recommendation: set `ADMIN_PASSWORD` and keep it — zero cost, preserves the skill's recovery path. Decide whether to use a stronger password than the legacy default.
4. **Backup target — R2/S3 or GitHub commit?** You already commit artifacts to this repo (chrome.zip, demo.apk), so a GitHub contents-API commit is the lowest-setup option; R2/S3 is cleaner if you don't want NDJSON churn in git history.
5. **Drop the embedded Graylog dashboard entirely?** The sessions/views stubs make `establishSession()` resolve without a real dashboard. Confirm no member workflow depends on the embedded "Seller Comparison" page (it's admin-only/optional and already degrades).
6. **Keep `--opensearch` mode in the skill?** It hits `localhost:9200`, which dies with the Mac. Recommendation: delete it and its SKILL.md section.

---

## 10. Effort estimate

| Work item | Estimate |
|---|---|
| `graylog-shim` app (`main.ts` + `lucene.ts`, all corrections) | ~1 day |
| Backup `Deno.cron` + export target wiring | ~0.5 day |
| Import loader + parity verification (§6) | ~0.5 day |
| Deno Deploy setup (org/app/KV/secrets/domain) | ~0.5 day |
| Client repoint (Phase 4a–4j, incl. **mobile URL-migration** + **mobile `_graylog_key`**) | ~1 day |
| Dual-write + verification matrix (Phases 3, 5) + 1–2 day soak | ~1 day active + soak |
| Decommission + docs cleanup (Phase 6, 4j) | ~0.5 day |
| **Total** | **~4–5 engineer-days** + a 1–2 day soak window |

Risk is low and concentrated in two places, both now corrected in this plan: the **mobile URL-migration** (without it, installed apps strand on the dead host — §7 Phase 4f) and the **mandatory GELF `_graylog_key` gate** (without it, a stable public write endpoint is open to abuse — §5.1/§5.3). Everything else is a mechanical URL+token repoint against a contract the shim reproduces verbatim.

---

### Appendix — contract the shim MUST preserve (so clients change only URL + token)
- **READ** `GET /api/search/universal/relative`: Basic `<token>:token` (and `admin/<pw>`); mini-Lucene `*` / `source:` / `creator(.keyword):"…"` / `AND`·`OR` (nested, AND>OR) / `*_num:[lo TO hi]`; `range` all-time sentinels `0` and `≥157,680,000`; the `{messages:[{message:{…flat}, index}], total_results, from, to, used_indices, time}` envelope; `&fields=` whitelist ∪ {timestamp, source}; honest `total_results`; **empty-window `index_not_found_exception`-500 only when the window is strictly newer than all data**; **`used_indices` always non-empty on real responses**; `401` on bad creds; permissive CORS.
- **WRITE** `POST /gelf`: GELF v1.1 JSON, `host→source`, strip one leading `_`, `short_message→message`, unix-seconds timestamp, **mandatory `_graylog_key` token gate**, `202` empty body.
- **DROPPABLE** `POST /api/system/sessions` (200 + cookie stub) and `GET/POST /api/views` (benign 200 stub).
