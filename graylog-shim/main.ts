// graylog-shim — a Deno Deploy app + Deno KV that reproduces the exact two
// endpoints the TokScrape clients use, so they change only base-URL + token:
//
//   GET  /api/search/universal/relative   (Graylog Universal Search, read)
//   POST /gelf                            (GELF HTTP input, write)
//
// plus benign stubs (POST /api/system/sessions, GET/POST /api/views) and
// GET /health. See MIGRATION_PLAN.md for the full design + rationale.
//
// Local run:   KV_PATH=./local.kv API_TOKENS=devtoken deno run -A --unstable-kv main.ts
// Deploy:      deployctl deploy --prod --project graylog-shim main.ts
//              (on Deploy, Deno.openKv() with no arg uses the managed KV)

import { evalNode, parse, pinnedEq, type Node } from "./lucene.ts";

// ───────────────────────────── config ─────────────────────────────

const KV_PATH = Deno.env.get("KV_PATH"); // undefined on Deploy => managed KV
const kv = await Deno.openKv(KV_PATH);

const API_TOKENS = new Set(
  (Deno.env.get("API_TOKENS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);
const ADMIN_USER = Deno.env.get("ADMIN_USER") ?? "admin";
const ADMIN_PW = Deno.env.get("ADMIN_PASSWORD") ?? "";

const FIVE_YEARS_S = 157_680_000;
const MAX_TS = Number.MAX_SAFE_INTEGER;
const SYNTH_INDEX = "graylog_kv";
const tsKey = (ms: number) => String(MAX_TS - ms).padStart(16, "0");

export interface StoredDoc {
  _id: string;
  source: string;
  timestamp: string; // canonical ISO, always UTC "…Z"
  index: string;
  fields: Record<string, unknown>; // flat field map == response `message`
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type, X-Requested-By",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS, ...(extra as Record<string, string>) },
  });

// newest stored ms — drives the empty-window gate. Loaded at boot, refreshed on write.
let newestStoredMs = 0;
async function loadNewest() {
  for await (const e of kv.list<StoredDoc>({ prefix: ["ix", "ts"] }, { limit: 1 })) {
    newestStoredMs = Date.parse(e.value.timestamp); // first key = newest (tsDesc)
  }
}
await loadNewest();

// ───────────────────────────── write path ─────────────────────────────

function gelfToDoc(g: Record<string, unknown>): StoredDoc {
  const source = String(g.host ?? "unknown");
  // GELF timestamp is unix SECONDS (may be fractional / a numeric string).
  const n = g.timestamp != null ? Number(g.timestamp) : NaN;
  const ms = Number.isNaN(n) ? Date.now() : Math.round(n * 1000);
  const ts = new Date(ms).toISOString();
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    if (k === "version" || k === "host" || k === "timestamp" || k === "level" || k === "_graylog_key") continue;
    if (k === "short_message" || k === "full_message") { fields.message = v; continue; }
    fields[k.startsWith("_") ? k.slice(1) : k] = v;
  }
  fields.source = source;
  fields.timestamp = ts;
  const _id = typeof g._id === "string" && g._id ? g._id : `${ms}-${crypto.randomUUID()}`;
  return { _id, source, timestamp: ts, index: SYNTH_INDEX, fields };
}

export async function putDoc(doc: StoredDoc) {
  const ms = Date.parse(doc.timestamp);
  const tk = tsKey(ms);
  const primary: Deno.KvKey = ["ix", "ts", tk, doc._id];
  const creator = (doc.fields.creator ?? "") as string;
  const prior = await kv.get<Deno.KvKey>(["msg_by_id", doc._id]);
  let a = kv.atomic();
  if (prior.value && !(prior.value.length === primary.length && prior.value.every((p, i) => p === primary[i]))) {
    // _id moved to a new timestamp (corrected ts on re-import): drop stale rows.
    const old = prior.value;
    a = a.delete(old);
    // old source/creator index rows share the same trailing [tk,id]; best-effort delete.
    const [, , oldTk, oldId] = old as [string, string, string, string];
    a = a.delete(["ix", "source", doc.source, oldTk, oldId]);
    if (creator) a = a.delete(["ix", "creator", creator, oldTk, oldId]);
  }
  a = a.set(["doc", doc._id], doc)
    .set(primary, doc)
    .set(["ix", "source", doc.source, tk, doc._id], doc)
    .set(["msg_by_id", doc._id], primary);
  if (creator) a = a.set(["ix", "creator", creator, tk, doc._id], doc);
  const res = await a.commit();
  if (!res.ok) throw new Error(`KV commit failed for ${doc._id}`);
  if (ms > newestStoredMs) newestStoredMs = ms;
}

async function handleGelf(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400, headers: CORS }); }
  const items = Array.isArray(body) ? body : [body];
  for (const g of items) {
    if (!g || typeof g !== "object") continue;
    const rec = g as Record<string, unknown>;
    const key = typeof rec._graylog_key === "string" ? rec._graylog_key : "";
    if (API_TOKENS.size > 0 && !API_TOKENS.has(key)) {
      return new Response("forbidden", { status: 403, headers: CORS });
    }
    await putDoc(gelfToDoc(rec));
  }
  return new Response(null, { status: 202, headers: CORS }); // 202 + empty body, like Graylog GELF HTTP
}

// ───────────────────────────── read path ─────────────────────────────

async function candidates(ast: Node): Promise<StoredDoc[]> {
  const src = pinnedEq(ast, "source");
  const cre = pinnedEq(ast, "creator");
  const prefix: Deno.KvKey = src ? ["ix", "source", src] : cre ? ["ix", "creator", cre] : ["ix", "ts"];
  const out: StoredDoc[] = [];
  for await (const e of kv.list<StoredDoc>({ prefix }, { batchSize: 500, consistency: "eventual" })) {
    out.push(e.value); // value IS the full doc — no follow-up get
  }
  return out; // ordered newest-first within a single prefix via tsDesc
}

async function handleSearch(url: URL): Promise<Response> {
  const t0 = performance.now();
  const ast = parse(url.searchParams.get("query") || "*");
  const range = Number(url.searchParams.get("range") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "150");
  const fcsv = url.searchParams.get("fields");
  const fields = fcsv ? fcsv.split(",").map((s) => s.trim()).filter(Boolean) : null;

  const unbounded = range === 0 || range >= FIVE_YEARS_S;
  const nowMs = Date.now();
  const minMs = unbounded ? -Infinity : nowMs - range * 1000;

  const pool = await candidates(ast);
  const matched = pool.filter((d) => {
    const ms = Date.parse(d.timestamp);
    return ms >= minMs && ms <= nowMs && evalNode(ast, d.fields);
  });
  matched.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); // stable newest-first

  const total = matched.length;

  // EMPTY-WINDOW: emit the index_not_found_exception-500 sentinel ONLY when the
  // requested window is strictly newer than every stored doc (matches real
  // Graylog; api.js maps it to { messages:[], total_results:0, _emptyWindow:true }).
  if (total === 0 && !unbounded && minMs > newestStoredMs) {
    return new Response(
      JSON.stringify({ type: "ApiError", message: "index_not_found_exception no such index []" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }

  const messages = matched.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 150).map((d) => {
    let m: Record<string, unknown> = d.fields;
    if (fields) {
      const keep: Record<string, unknown> = { timestamp: d.fields.timestamp, source: d.fields.source };
      for (const f of fields) if (f in d.fields) keep[f] = d.fields[f];
      m = keep;
    }
    return { message: m, index: d.index };
  });

  return json({
    messages,
    total_results: total,
    from: unbounded ? new Date(0).toISOString() : new Date(minMs).toISOString(),
    to: new Date(nowMs).toISOString(),
    used_indices: ["graylog_kv"], // ALWAYS non-empty on a real response
    time: Math.round(performance.now() - t0),
  });
}

// ───────────────────────────── auth ─────────────────────────────

function authOk(req: Request): boolean {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  let user = "", pass = "";
  try {
    const dec = atob(h.slice(6));
    const idx = dec.indexOf(":");
    user = idx >= 0 ? dec.slice(0, idx) : dec;
    pass = idx >= 0 ? dec.slice(idx + 1) : "";
  } catch { return false; }
  // Mobile/extension scheme: username=<API_TOKEN>, password="token".
  if (pass === "token" && API_TOKENS.has(user)) return true;
  // Skill admin fallback: admin/<ADMIN_PASSWORD>.
  if (ADMIN_PW && user === ADMIN_USER && pass === ADMIN_PW) return true;
  // If no tokens configured at all (pure local dev), allow.
  if (API_TOKENS.size === 0 && !ADMIN_PW) return true;
  return false;
}

const unauthorized = () =>
  new Response(JSON.stringify({ type: "ApiError", message: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Basic", ...CORS },
  });

// ───────────────────────────── router ─────────────────────────────

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (pathname === "/health") return json({ ok: true, newestStoredMs });

  // WRITE — GELF input (token gate inside handleGelf, like Graylog's input auth)
  if (pathname === "/gelf" && req.method === "POST") return handleGelf(req);

  // READ — Graylog Universal Search (Basic auth)
  if (pathname === "/api/search/universal/relative" && req.method === "GET") {
    if (!authOk(req)) return unauthorized();
    return handleSearch(url);
  }

  // Benign stubs so optional client features don't throw.
  if (pathname === "/api/system/sessions" && req.method === "POST") {
    return json(
      { session_id: crypto.randomUUID(), valid_until: new Date(Date.now() + 36e5).toISOString() },
      200,
      { "Set-Cookie": `authentication=stub; Path=/; HttpOnly; SameSite=Lax` },
    );
  }
  if (pathname === "/api/views") return json({ views: [], total: 0 });

  return new Response("not found", { status: 404, headers: CORS });
}

if (!Deno.env.get("SHIM_NO_SERVE")) {
  Deno.serve({ port: Number(Deno.env.get("PORT") ?? "8000") }, handler);
}

export { handler, kv };
