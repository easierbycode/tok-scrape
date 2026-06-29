// One-time loader: import the local Graylog backup (messages.ndjson) into Deno KV.
//
// Backup line shape (from ~/graylog-backups/<date>/messages.ndjson):
//   { "_id": "...", "source": "...", "timestamp": "2026-05-28 03:17:37.000", "fields": { ... } }
//
// Local KV (for testing the shim end-to-end):
//   KV_PATH=./local.kv deno run -A --unstable-kv import-to-kv.ts ~/graylog-backups/2026-06-25/messages.ndjson
//
// Hosted Deno Deploy KV (the real cutover), over KV Connect:
//   KV_CONNECT_URL="https://api.deno.com/v2/databases/<DB_ID>/connect" \
//   DENO_KV_ACCESS_TOKEN="ddo_..." \
//   deno run -A --unstable-kv import-to-kv.ts ~/graylog-backups/2026-06-25/messages.ndjson
//
// Idempotent: keyed on _id, so duplicate lines collapse (last-write-wins) and
// re-running is safe.

const MAX_TS = Number.MAX_SAFE_INTEGER;
const SYNTH_INDEX = "graylog_kv";
const tsKey = (ms: number) => String(MAX_TS - ms).padStart(16, "0");

// Backup timestamps are space-separated UTC with NO zone ("2026-05-28 03:17:37.000").
// NEVER `new Date("2026-05-28 03:17:37.000")` — V8 parses the space form as LOCAL
// time. Force ISO-T + Z so it's unambiguously UTC, matching the wire contract.
function parseTs(ts: string): number {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const ms = Date.parse(iso.endsWith("Z") ? iso : iso + "Z");
  if (Number.isNaN(ms)) throw new Error(`bad timestamp: ${ts}`);
  return ms;
}

const path = Deno.args[0];
if (!path) {
  console.error("usage: import-to-kv.ts <messages.ndjson>");
  Deno.exit(2);
}

const connect = Deno.env.get("KV_CONNECT_URL") || Deno.env.get("KV_PATH");
const kv = await Deno.openKv(connect);

// Must match main.ts: all keys namespaced so a shared KV instance stays isolated.
const NS = Deno.env.get("KV_NAMESPACE") ?? "graylog";
const k = (...parts: Deno.KvKeyPart[]): Deno.KvKey => [NS, ...parts];

const text = await Deno.readTextFile(path);
const lines = text.split("\n").filter((l) => l.trim());

let a = kv.atomic();
let nDocs = 0, nBytes = 0, written = 0;
const seen = new Set<string>();
const perSource: Record<string, number> = {};

async function flush() {
  if (!nDocs) return;
  const r = await a.commit();
  if (!r.ok) throw new Error("KV commit failed");
  written += nDocs;
  a = kv.atomic();
  nDocs = 0;
  nBytes = 0;
}

for (const line of lines) {
  const d = JSON.parse(line) as { _id: string; source: string; timestamp: string; fields: Record<string, unknown> };
  const ms = parseTs(d.timestamp);
  const ts = new Date(ms).toISOString();
  const fields: Record<string, unknown> = { ...d.fields, source: d.source, timestamp: ts };
  const doc = { _id: d._id, source: d.source, timestamp: ts, index: SYNTH_INDEX, fields };
  const tk = tsKey(ms);
  const primary: Deno.KvKey = k("ix", "ts", tk, d._id);
  const creator = (fields.creator ?? "") as string;

  a = a.set(k("doc", d._id), doc)
    .set(primary, doc)
    .set(k("ix", "source", d.source, tk, d._id), doc)
    .set(k("msg_by_id", d._id), primary);
  if (creator) a = a.set(k("ix", "creator", creator, tk, d._id), doc);

  seen.add(d._id);
  perSource[d.source] = (perSource[d.source] ?? 0) + 1;

  // Measure REAL bytes (the multi-key StoredDoc), flush well under KV's
  // 800 KiB / 1000-mutation atomic caps. The 250 largest docs sum to ~945 KiB,
  // so a naive whole-file commit would fail.
  const docBytes = JSON.stringify(doc).length;
  nBytes += docBytes * (creator ? 4 : 3) + 400;
  nDocs++;
  if (nDocs >= 100 || nBytes >= 400_000) await flush();
}
await flush();

console.log(`imported ${written} rows from ${lines.length} lines; ${seen.size} unique _ids`);
console.log("per-source:");
for (const [s, c] of Object.entries(perSource).sort((x, y) => y[1] - x[1])) {
  console.log(`  ${c}\t${s}`);
}
await kv.close();
