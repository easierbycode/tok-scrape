# Graylog → Deno-shim Cutover Runbook (zero data loss, clean rollback)

**Goal:** Replace the fragile single-Mac Graylog + paid-ngrok stack with one Deno Deploy app (`graylog-shim`) backed by Deno KV, so every client changes **only base-URL + token**. Move all 827 docs with zero loss, run a dual-write overlap so you can roll back instantly, then decommission Graylog/ngrok/docker.

**Authoritative inputs (already captured — do not re-derive):**
- Backup: `~/graylog-backups/2026-06-25/` — `messages.ndjson` (827 normalized `{_id, source, timestamp, fields}` lines), `indices/graylog_*.ndjson`, `metadata/*.json`.
- Local tooling present: `deno 2.7.14`, `deployctl` (both at `~/.deno/bin`).
- The shim must satisfy the READ contract, WRITE contract, mini-Lucene subset, and response envelope already specified (see "Contract reference" at the bottom).

> ⚠️ **Backup-hash caveat (verified 2026-06-25):** `manifest.json.messages_sha256` (`21dac2c8…`) does **not** match the current `messages.ndjson` (`ed5c58e4…`) — the file was re-normalized after the manifest was written. Do **not** gate on the manifest hash. Re-pin a fresh hash in Step 0.3 and gate import parity on **doc-count (827) + per-source counts**, which DO match.

---

## Phase 0 — Prerequisites & freeze the source of truth

**0.1 — Confirm the old stack is still up (you need it live for dual-write + rollback).**
```bash
curl -s -o /dev/null -w '%{http_code}\n' -u "$OLD_TOKEN:token" \
  'https://tok-graylog-api.ngrok-free.dev/api/search/universal/relative?query=*&range=157680000&limit=1&sort=timestamp:desc'
# expect 200
```
Do **not** touch docker / ngrok / the Mac until Phase 6.

**0.2 — Tools.** `deno --version` (≥2.x) and `deployctl --version` already pass on this machine. If on another box: `deno install -gArf jsr:@deno/deployctl`.

**0.3 — Re-pin the backup hash (the integrity gate the whole cutover trusts).**
```bash
cd ~/graylog-backups/2026-06-25
shasum -a 256 messages.ndjson | tee messages.sha256        # ed5c58e4… (re-pin live)
wc -l messages.ndjson                                       # must print 827
python3 - <<'PY'
import json,collections
c=collections.Counter()
for l in open('messages.ndjson'):
    if l.strip(): c[json.loads(l)['source']]+=1
print('TOTAL', sum(c.values()))
for s,n in c.most_common(): print(f'{n:>5}  {s}')
PY
```
Save this output as `expected-counts.txt`; Step 2.4 diffs against it. Copy the whole `~/graylog-backups/2026-06-25/` dir somewhere off-machine (it is the rollback master).

**0.4 — Deno Deploy project & KV (new platform — `console.deno.com`; Classic dies 2026-07-20, do NOT use it).**
1. Create org (e.g. `tokscrape`) and app `graylog-shim` in `console.deno.com`.
2. In the app's **Databases** tab, provision a Deno KV database and attach it to the **Production** context (and **Development** context for previews). In-code `await Deno.openKv()` auto-routes; no connection string in app code.
3. Grab the KV **Database ID** (Databases tab) and mint a **Deno KV access token** (`ddo_…`) under account settings → used only by the one-time CLI importer (Step 2).
4. Default URL will be `https://graylog-shim.<org>.deno.net` — **stable, non-rotating**. One origin serves **both** endpoints as paths: `/api/...` (read) and `/gelf` (write). You do **not** need two hosts like ngrok had.

**0.5 — Mint the shim's API token.** Pick ONE token string the shim will accept for READ Basic-auth (`username=<TOKEN> password=token`) AND for the GELF write path. Generate: `openssl rand -hex 26`. Call it `$SHIM_TOKEN`. (Today three different token literals exist — scrapers, demo, mobile — converge them to this one. Optionally keep `admin/ChangeMeAdmin!` accepted too, so the skill's admin-fallback path survives.)

**0.6 — Set shim secrets/vars (write-only secrets, never shown again).**
```bash
deployctl env add SHIM_TOKEN "$SHIM_TOKEN" --secret --app graylog-shim --prod
# optional admin fallback for the skill:
deployctl env add ADMIN_USER admin               --app graylog-shim --prod
deployctl env add ADMIN_PASS 'ChangeMeAdmin!' --secret --app graylog-shim --prod
```

**Custom-domain decision (decide now, affects what you bake into clients in Phase 4):**
- **Recommended: ship the bare `*.deno.net` URL.** It's stable, TLS is automatic, it satisfies "clients change only base-URL + token," and it lets you drop the **paid ngrok account entirely**. No DNS work.
- **Take a custom domain only if** you want a branded host or you might re-platform off Deno later (a CNAME you control lets you move without re-releasing the APK/IPA, which is the slow client to change). If so: add the domain in console → Domains, point ANAME/ALIAS + `_acme-challenge` CNAME, wait for Let's Encrypt (~90s), and bake the **custom** host into clients instead of `*.deno.net`. Verify in-console whether custom domains are free on your tier before assuming (pricing page says 50 on Free; older docs implied Pro).
- **Pin one value now:** `SHIM_BASE` = `https://graylog-shim.<org>.deno.net` **or** your custom domain. Every Phase-4 edit uses `$SHIM_BASE` (read) and `$SHIM_BASE/gelf` (write).

---

## Phase 1 — Deploy the shim (empty, but live)

**1.1** Land the shim source (single `main.ts` implementing the two endpoints + the mini-Lucene evaluator + the empty-window sentinel; KV key layout `["msg", tsMillis, id] → flatDoc` plus `["by_source", source, tsMillis, id] → id` and `["by_creator", creatorKeyword, tsMillis, id] → id`). Put it in a repo dir, e.g. `graylog-shim/`.

**1.2 Deploy to production:**
```bash
cd graylog-shim
deployctl deploy --prod --project graylog-shim main.ts   # or `deno deploy --prod` on new platform
```

**1.3 Smoke the live-but-empty shim** (empty-window path + auth):
```bash
# READ on an all-time match-all → empty corpus must NOT 500 with a real error.
curl -s -u "$SHIM_TOKEN:token" \
  "$SHIM_BASE/api/search/universal/relative?query=*&range=157680000&limit=1&sort=timestamp:desc" -w '\n%{http_code}\n'
# bad creds → 401
curl -s -o /dev/null -w '%{http_code}\n' -u "wrong:token" \
  "$SHIM_BASE/api/search/universal/relative?query=*&range=157680000&limit=1"
# expect 401
```
Confirm: (a) the response envelope shape is right, (b) the all-time-empty case returns either `200 {messages:[],total_results:0,…}` or the bug-compatible `500 …index_not_found_exception…` — **whichever the shim chose, write it down**; clients depend on it. (c) CORS headers allow `Authorization, Accept, X-Requested-By`.

---

## Phase 2 — Import the 827-doc backup into KV + verify parity

**2.1** Stage the importer (see `scripts/import-to-kv.mjs` referenced below). Key points it must honor:
- Timestamp in the backup is **space-separated**, e.g. `"2026-05-28 03:17:37.000"` — parse as UTC: `Date.parse(d.timestamp.replace(' ','T')+'Z')`.
- Flatten to the on-read shape: `message = { ...d.fields, timestamp:<iso>, source:d.source }`; store original index too (echo as `entry.index`). The 827 lines have **no `_index`** field, so synthesize a single `used_indices` token (e.g. `"graylog_kv"`).
- Batch atomic commits **≤300 docs / ≤700 KB / ≤999 mutations** (each doc writes 3 keys → ~3 mutations).

```js
// scripts/import-to-kv.mjs  (run with deno)
const DB = `https://api.deno.com/v2/databases/${Deno.env.get("KV_DATABASE_ID")}/connect`;
const kv = await Deno.openKv(DB);                       // reads DENO_KV_ACCESS_TOKEN
const lines = (await Deno.readTextFile(Deno.args[0])).split("\n").filter(Boolean);
let a = kv.atomic(), n = 0, bytes = 0, total = 0;
for (const line of lines) {
  const d = JSON.parse(line);
  const tsMs = Date.parse(d.timestamp.replace(" ", "T") + "Z");
  const msg = { ...d.fields, timestamp: new Date(tsMs).toISOString(), source: d.source };
  a.set(["msg", tsMs, d._id], { message: msg, index: "graylog_kv" });
  a.set(["by_source", d.source, tsMs, d._id], d._id);
  if (msg.creator) a.set(["by_creator", String(msg.creator), tsMs, d._id], d._id);
  n++; total++; bytes += line.length + 256;
  if (n >= 250 || bytes >= 650_000) { await a.commit(); a = kv.atomic(); n = 0; bytes = 0; }
}
if (n) await a.commit();
console.log("imported", total);
```

**2.2 Run the import (idempotent — keys are by `_id`, re-running overwrites, never duplicates):**
```bash
export DENO_KV_ACCESS_TOKEN=ddo_...        # the token from Step 0.4
export KV_DATABASE_ID=<DATABASE_ID>
deno run --unstable-kv --allow-env --allow-net --allow-read \
  scripts/import-to-kv.mjs ~/graylog-backups/2026-06-25/messages.ndjson
# expect: imported 827
```

**2.3 Verify total count via the live shim:**
```bash
curl -s -u "$SHIM_TOKEN:token" \
  "$SHIM_BASE/api/search/universal/relative?query=*&range=157680000&limit=1&sort=timestamp:desc" \
  | python3 -c 'import sys,json;print("total_results",json.load(sys.stdin)["total_results"])'
# expect: total_results 827
```

**2.4 Verify per-source parity against `expected-counts.txt`:**
```bash
while read -r want src; do
  got=$(curl -s -u "$SHIM_TOKEN:token" \
    "$SHIM_BASE/api/search/universal/relative?query=source:$src&range=157680000&limit=1" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["total_results"])')
  printf '%-45s want=%s got=%s %s\n' "$src" "$want" "$got" "$([ "$want" = "$got" ] && echo OK || echo MISMATCH)"
done < <(awk 'NF==2{print $1, $2}' ~/graylog-backups/2026-06-25/expected-counts.txt)
```
**Gate:** every line must read `OK` (827 total; the 11 real `tiktok-*` sources plus `lifepreneur-extension` 401, `thirsty-store-kiosk` 273, and the ~15 probe/test docs). Do not proceed past Phase 3 until this is clean.

**2.5 Spot-check a real query the mobile app makes** (affiliate orders for a known creator, newest-first):
```bash
curl -s -u "$SHIM_TOKEN:token" \
 "$SHIM_BASE/api/search/universal/relative?query=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("source:tiktok-affiliate-export AND (creator:\"@wizardofdealz\" OR creator.keyword:\"@wizardofdealz\")"))')&range=157680000&limit=5&sort=timestamp:desc&fields=creator,order_id,gmv_num,order_date_iso" \
 | python3 -m json.tool | head -40
# expect newest-first messages, each restricted to {creator,order_id,gmv_num,order_date_iso,timestamp,source}
```

---

## Phase 3 — DUAL-WRITE overlap (de-risk before flipping any client)

Goal: prove the shim ingests a live GELF write and serves it back through search, **while Graylog still runs**, so rollback is a no-op until Phase 4.

**3.1 Round-trip a synthetic probe through the shim's write path:**
```bash
PROBE=$(date +%s)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$SHIM_BASE/gelf" \
  -H 'Content-Type: application/json' \
  -d "{\"version\":\"1.1\",\"host\":\"cutover-probe\",\"short_message\":\"dual-write $PROBE\",\"_probe_id\":\"$PROBE\",\"timestamp\":$PROBE}"
# expect 202
sleep 1
curl -s -u "$SHIM_TOKEN:token" \
  "$SHIM_BASE/api/search/universal/relative?query=source:cutover-probe&range=3600&limit=5&sort=timestamp:desc" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("found",d["total_results"]);print("probe_id stripped of _:",d["messages"][0]["message"].get("probe_id"))'
# expect: found ≥1 ; probe_id == the $PROBE value (leading underscore stripped, host→source)
```
This validates: `202` empty body, `host→source`, leading-`_` stripping (`_probe_id`→`probe_id`), GELF unix `timestamp` honored, range filtering, newest-first. Delete the probe afterward if you keep a `/admin/delete` path, or just let it age out — it's a `cutover-probe` source, invisible to real queries.

**3.2 (Optional, higher confidence) Real dual-write from ONE sender.** Temporarily point a single low-traffic scraper (e.g. a local copy of `extension-creator-demo`) at `$SHIM_BASE/gelf` *in addition to* Graylog, fire one real scrape, confirm it lands in the shim search. Revert that copy. This is overlap, not cutover — production senders still hit ngrok until Phase 4.

**Decision gate:** Phases 1–3 all green ⇒ proceed to client cutover. Any red ⇒ fix the shim; nothing in production has moved, so there is nothing to roll back.

---

## Phase 4 — Repoint every client (base-URL + token only)

Order: low-blast-radius first (extensions, skill, tooling), highest-latency last (mobile APK/IPA rebuild). Do these on a branch; commit per bucket so each is independently revertable.

### 4a. Browser-extension WRITE config (3 files)

**`extension-seller/config.js`** L4–5 and **`extension-agency/config.js`** L4–5:
```diff
- var GRAYLOG_ENDPOINT = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
- var GRAYLOG_TOKEN    = '1dfl48d81q96uu1djdahq1ic87cvnlmu4jqsvco2l0bh8u3adns8';
+ var GRAYLOG_ENDPOINT = '$SHIM_BASE/gelf';
+ var GRAYLOG_TOKEN    = '$SHIM_TOKEN';
```
(All seller/agency scrapers inherit via `TOK_CONFIG` — no scraper edits.) The skill ALSO reads `extension-seller/config.js`'s `GRAYLOG_TOKEN` as its default READ credential, so `$SHIM_TOKEN` must be accepted by the shim's READ endpoint (it is — single converged token).

**`extension-creator-demo/background.js`** L21–22 (inline, no config.js):
```diff
- var GRAYLOG_ENDPOINT = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
- var GRAYLOG_TOKEN    = '1d1l5fhd0bugo25s5ulib29vtjshp93q8sg4ll76nck84rj6krlr';
+ var GRAYLOG_ENDPOINT = '$SHIM_BASE/gelf';
+ var GRAYLOG_TOKEN    = '$SHIM_TOKEN';
```

### 4b. MV3 host_permissions (the relay/direct fetch will silently 0-fire without these)

- **`extension-creator-demo/manifest.json`** L15 — HARD host match, MUST change:
  ```diff
  - "https://tok-graylog-gelf.ngrok-free.dev/*"
  + "$SHIM_BASE/*"
  ```
- **`extension-seller/manifest.json`** and **`extension-agency/manifest.json`** — currently rely on `https://*.ngrok-free.dev/*`. **Add** the shim host (and optionally drop the `*.ngrok*` wildcards after cutover is fully verified):
  ```diff
    "host_permissions": [
  +   "$SHIM_BASE/*",
      ...
  ```
- Reload all three unpacked extensions in `chrome://extensions` after editing.

### 4c. `graylog-query` skill (READ default + docs)

- **`.claude/skills/graylog-query/scripts/graylog_query.py`** L70: `DEFAULT_URL = "$SHIM_BASE"`. Update the L195/L253 ngrok/cluster error text. The `--opensearch` mode (`DEFAULT_OPENSEARCH_URL=localhost:9200`, `search_opensearch`) is **dead** once OpenSearch is gone — either delete it or leave it (it only fires on the host; harmless if unused). Keep the admin-fallback only if the shim accepts `admin/ChangeMeAdmin!`.
- **`.claude/skills/graylog-query/SKILL.md`**: rewrite endpoint default (L85–87) to `$SHIM_BASE`; remove/replace the `--opensearch` section (L108–138) and the "3-host HA cluster behind ngrok" / ngrok-failover narrative; update the 401 / token-rotation guidance to the shim's auth model.
- **`.claude/skills/graylog-query/references/sources.md`**: no URL/token edit — it is the source/field schema the shim must reproduce; leave as-is.

### 4d. Build & CI for the mobile app

- **`mobile-app/scripts/build-preloaded.js`** L267: change the `GRAYLOG_GELF_URL` default to `$SHIM_BASE/gelf`. (`GRAYLOG_URL`/`GRAYLOG_TOKEN` still come from CI secrets.) `isCreatorKnown` hits `/api/search/universal/relative` (shim implements it ✓) and `ensureDashboardId` hits the Views API — the shim has **no Views API**, but build-preloaded already **warns-and-continues** on that failure, so the build survives a 404. If the warning is noisy, gate `ensureDashboardId` behind a flag.
- **GitHub repo secrets** (used by both workflows, no YAML edit needed):
  - `GRAYLOG_URL_PROD` → `$SHIM_BASE`
  - `GRAYLOG_TOKEN_PROD` → `$SHIM_TOKEN`
  ```bash
  gh secret set GRAYLOG_URL_PROD   -b "$SHIM_BASE"
  gh secret set GRAYLOG_TOKEN_PROD -b "$SHIM_TOKEN"
  ```
- **`mobile-app/www/js/preload.js`** and **`preload.js.example`** L26: update the inert `gelfUrl` literal to `$SHIM_BASE/gelf` (cosmetic; SEED.enabled=false, real seed written at build time).

### 4e. Mobile app OTA defaults + forced re-seed (reaches already-installed APKs)

**`mobile-app/www/js/app.js`:**
```diff
- var DEFAULT_GRAYLOG_URL   = 'https://tok-graylog-api.ngrok-free.dev';
- var DEFAULT_GRAYLOG_TOKEN = '1hjk2lkmmgqh8gqbint3fneasc2hn208jrf28hd7gsfv9j6s9amr';
- var DEFAULT_GELF_URL      = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
+ var DEFAULT_GRAYLOG_URL   = '$SHIM_BASE';
+ var DEFAULT_GRAYLOG_TOKEN = '$SHIM_TOKEN';
+ var DEFAULT_GELF_URL      = '$SHIM_BASE/gelf';
...
- var GRAYLOG_TOKEN_MIGRATION_KEY = 'tok-scrape.graylogToken.v4';
+ var GRAYLOG_TOKEN_MIGRATION_KEY = 'tok-scrape.graylogToken.v5';   // MANDATORY bump
```
The **`v5` bump is the only lever** that re-pushes the new URL+token to already-migrated installs (`loadSettings` re-seeds once per key value). The L63 GELF-host repair check and L78/L929 gelfUrl defaults now reference the new `DEFAULT_GELF_URL` automatically. Ship via the normal OTA bundle (JS/CSS only — never `index.html`, per memory).

> Note OTA vs baked precedence: `preload.js` seeds (baked into the APK) win via `setIfMissing`, so the OTA defaults only apply where preload didn't seed. A **rebuild (4f)** is required for the baked value; OTA covers installed apps whose stored token differs (the v5 migration forces it).

### 4f. Rebuild & publish APK/IPA

Trigger both workflows (they now read the new secrets):
```bash
gh workflow run build-apk-preloaded.yml -f member_id=<id> -f common_dashboard_id=<optional>
gh workflow run build-ios-preloaded.yml -f member_id=<id> -f common_dashboard_id=<optional>
```
`COMMON_DASHBOARD_ID` flow degrades gracefully without a Views API. Distribute the new builds.

### 4g. Tooling staleness heuristics (keyed on the literal word "ngrok")

- **`scripts/run-bookmarklet.ts`** L433–439: replace the `!includes('ngrok')` warning with a check for your shim host (e.g. `!includes('deno.net')` or the custom domain). Relay/auth unchanged — it reads endpoint+token fresh from config.js.
- **`.claude/skills/run-partner-center-bookmarklet/SKILL.md`** L43/L117/L190/L207: replace the "must contain ngrok" staleness check with the shim host; drop the "run docker compose up to re-run sync-bookmarklet.py" remediation.
- **`scripts/seed-graylog.py`** L316: change default `--endpoint` to `$SHIM_BASE/gelf` (or always pass `--endpoint`). The `--create-dashboard` / `--api-base` Views path (L302–311, L333) is dead against the shim — drop or no-op it.

### 4h. `sync-bookmarklet.py` — retire or repurpose

`scripts/sync-bookmarklet.py` is coupled to docker+ngrok+admin-token-minting. With the shim there is no token to mint and no tunnel to discover. **Either delete it**, or rewrite it to a 10-line script that stamps the fixed `$SHIM_BASE`/`$SHIM_TOKEN` into its 3 SOURCES files (`extension-seller/config.js`, `extension-agency/config.js`, `extension-creator-demo/background.js`) on demand — drop all ngrok/Graylog-wait logic.

### 4i. Docs

- **`README.md`** L3, L18–49, L141–153: rewrite the GELF-through-ngrok architecture to the Deno-shim write path; drop the docker/ngrok/sync-bookmarklet flow.
- **`mobile-app/README.md`** L201 + the GELF/CORS/12202/adb-reverse sections: point to the shim URLs; drop Graylog-stack guidance.
- **`mobile-app/config.xml`**: no functional change (already `allow-navigation '*'`); optionally tidy the ngrok comments at L45/L68.

---

## Phase 5 — Verification matrix (post-repoint, Graylog still up)

Run all of these against the **shim**. Do not decommission anything until every row passes.

| # | Check | How | Pass criteria |
|---|---|---|---|
| 5.1 | Skill default URL | `python3 .claude/skills/graylog-query/scripts/graylog_query.py --query '*' --all --limit 1` | returns rows from `$SHIM_BASE`; `total_results` 827 |
| 5.2 | Skill `--list-sources` | `… graylog_query.py --list-sources` | source list + counts match `expected-counts.txt` |
| 5.3 | Skill `--terms` (client-side agg) | `… graylog_query.py --query 'source:tiktok-affiliate-export' --terms creator` | non-empty, sane counts (limit auto-bumped to 10000) |
| 5.4 | Mobile `fetchScrapes` | app → Videos for a known creator (or replay Q3 shape with `source:tiktok-bookmarklet`) | data renders, newest-first |
| 5.5 | `fetchLiveAnalytics` | app LIVE tab / `source:tiktok-bookmarklet-livestream-analytics` | 18-doc corpus returns |
| 5.6 | `fetchDataOverview` | `source:tiktok-bookmarklet-data-overview` | latest = `scrapes[0]` correct |
| 5.7 | `fetchCreatorAnalytics` | `source:tiktok-bookmarklet-creator-analysis` | returns |
| 5.8 | `fetchProductAnalytics` | `source:tiktok-bookmarklet-product-analysis` | multi-message regroup intact (needs newest-first) |
| 5.9 | `fetchAffiliateOrders` | Q3 affiliate shape (Step 2.5) | full field set, `*_num` numeric |
| 5.10 | `fetchCreators` (Q5) | the 6-source OR query | creator roster non-empty |
| 5.11 | `isCreatorKnown` (Q6, build) | rebuild log / replay Q6 with limit=1 | known creator → `messages.length>0` |
| 5.12 | Empty-window sentinel | query a future-only window: `range=1` after a scrape gap, or a `source:` with no recent docs | client maps to `_emptyWindow`/`_empty_window`; mobile auto-widen ladder advances |
| 5.13 | Numeric range (Q8) | `source:tiktok-affiliate-export AND gmv_num:[100 TO *]` via skill | only docs with gmv≥100 |
| 5.14 | **Live ingest** | run one real scrape via a repointed extension (or `/run-partner-center-bookmarklet`) | `202`, then visible in shim search within seconds |
| 5.15 | Token/auth | bad token → 401 surfaced as "Graylog rejected the API token (401)" | client shows the 401 message, not a crash |

**Gate to Phase 6:** every row green. Leave the new builds in users' hands for a short soak (a day or two) so real scrapers exercise the write path before you tear down the fallback.

---

## Phase 6 — Decommission the old stack (only after soak)

Order matters — kill writers' fallback last.

1. **Stop the senders' ngrok dependency:** confirm no client config still points at `*.ngrok-free.dev` (`grep -rn 'ngrok-free' extension-* mobile-app scripts .claude` → only comments/docs left).
2. **Tear down docker:** `docker compose down -v` (removes MongoDB + OpenSearch + Graylog + ngrok + sync sidecar). Archive `docker-compose.yml`, `ngrok.yml`.
3. **Retire the cluster dir:** archive `cluster/` (`ngrok.cluster.yml`, `docker-compose.datanode.yml`, `docker-compose.voteonly.yml`, `README.md`, `.env.example`).
4. **Release the ngrok domains** `tok-graylog-api` / `tok-graylog-gelf` and **cancel/downgrade the paid ngrok account** (the whole reason it was paid was NAT'd self-hosting — gone now).
5. **Archive Graylog-only assets:** `graylog-branding/` (`nginx-frame-strip.conf`, `inject-branding.sh`), `graylog-local-setup.md`. Mark `cluster/README.md`, `graylog-local-setup.md` deprecated, point to the shim.
6. **Remove `scripts/sync-bookmarklet.py`** (or keep the slimmed stamp-only version from 4h).
7. **Keep the raw OpenSearch backups** (`~/graylog-backups/2026-06-25/` incl. `indices/` + `metadata/`) off-machine **indefinitely** — they are the only copy of the original `_index`/mappings/views once docker volumes are wiped.

---

## Phase 7 — Rollback plan (if the shim misbehaves)

The system was designed so rollback is **flip-back, not restore** — provided you have NOT done Phase 6.

**Before Phase 6 (Phases 4–5 only) — instant rollback:**
1. `git revert` the per-bucket commits from Phase 4 (or `git checkout main -- extension-*/config.js extension-creator-demo/background.js mobile-app/www/js/app.js …`). Reload extensions.
2. Re-set the two GH secrets back to the old ngrok URL + old token; re-run the workflows to rebuild old-pointing APK/IPA.
3. For installed apps already on `v5`: **bump `GRAYLOG_TOKEN_MIGRATION_KEY` to `v6`** with the OLD url+token in the DEFAULT_* constants and OTA-ship — that re-pushes the rollback to migrated installs (you can't "un-migrate" v5; you migrate forward to a v6 that points back at Graylog).
4. Old Graylog/ngrok/docker are still running (Phase 6 not done) → traffic flows again immediately. **No data restore needed** — the shim was additive; the canonical data never left Graylog during dual-write.

**Partial / data-only rollback (shim corrupts or loses data):** the KV import is idempotent and the NDJSON master is untouched — re-run Step 2.2 to rebuild KV from `messages.ndjson`. Any writes that landed only on the shim during the window are in KV; export them first (`exportEntries` → NDJSON) before any destructive re-import so you don't lose post-cutover writes.

**After Phase 6 (docker torn down):** rollback means **re-standing-up Graylog from the backup** — restore `indices/graylog_*.ndjson` into a fresh OpenSearch and re-point clients. This is slow and is exactly why Phase 6 waits for a clean soak. Don't do Phase 6 until you're confident.

**Rollback trigger conditions:** mobile `fetch*` returning empty/errors for data that exists; skill `--list-sources` count drift; live scrapes not appearing in search within minutes; 401s on a known-good token; envelope-shape breakage (clients throwing on `entry.message`).

---

## Phase 8 — Ongoing ops

**8.1 KV backup (replaces Graylog's managed backup — new platform has none).** A daily `Deno.cron` job in the shim using `@deno/kv-utils`:
```ts
import { exportEntries } from "jsr:@deno/kv-utils/import-export";
Deno.cron("kv-backup-daily", "0 9 * * *", async () => {   // 09:00 UTC
  const kv = await Deno.openKv();
  const ndjson = await exportEntries(kv, { prefix: ["msg"] }, { type: "string" });
  // PUT to R2/S3 (aws4fetch) OR commit to GitHub contents API (repo already commits artifacts)
});
```
- Free tier: ≤10 cron jobs, registered at module top level, no overlapping runs, all UTC.
- Also keep the **off-machine `messages.ndjson` master** as the cold-start seed.

**8.2 Monitoring.** Watch the app in console (requests, errors, KV read/write units — all far under free-tier caps: ~3.8 MB of 1 GiB, <1% of unit quotas). Add a cheap external uptime ping on `$SHIM_BASE/api/search/universal/relative?query=*&range=3600&limit=0` (or a `/health` route). Alert on non-200 / 401 spikes.

**8.3 Token rotation.** To rotate `$SHIM_TOKEN`: (a) make the shim accept BOTH old+new for an overlap window (comma-list env), (b) update `extension-*/config.js` + `extension-creator-demo/background.js` + GH secret `GRAYLOG_TOKEN_PROD`, (c) **bump `GRAYLOG_TOKEN_MIGRATION_KEY`** (the only lever for installed apps) and OTA-ship + rebuild, (d) after all clients are on the new token, drop the old one from the shim env. Same migration-key discipline as the cutover itself.

**8.4 Retention/compaction (optional).** Append-only log; you likely never prune. If you ever do, a `Deno.cron` `kv.list({prefix:["msg"], end:["msg", cutoffMs]})` → `kv.delete` job (and mirror-delete the `by_source`/`by_creator` index keys). Not needed at current volume.

---

## Contract reference (the shim MUST preserve — clients change only URL+token)

- **READ:** `GET /api/search/universal/relative?query=<lucene>&range=<sec>&fields=<csv>&limit=<int>&sort=timestamp:desc`; HTTP Basic `username=<TOKEN> password=token` (also `admin/ChangeMeAdmin!` if kept). Mini-Lucene subset: `*`, `source:x`, `creator:"@h"`, `creator.keyword:"@h"` (≡ equality on `creator`), AND/OR (case-insensitive, AND>OR precedence) parenthesized or bare, numeric `field_num:[lo TO hi]` (`*`=unbounded). `range`: `0` or `≥157,680,000` (~5yr) = all-time. Response envelope: `{messages:[{message:{…flat, timestamp, source}, index}], total_results, from, to, used_indices, time}`; restrict `message` to `fields ∪ {timestamp,source}` when `fields` present; `total_results` = true match count (honest, may exceed `limit`). Empty-window: return EITHER `200 {messages:[],total_results:0,…}` OR `500` whose body contains `index_not_found_exception` (clients map to `_emptyWindow`/`_empty_window`). `401` on bad creds. Permissive CORS allowing `Authorization, Accept, X-Requested-By`.
- **WRITE:** `POST /gelf`, `Content-Type: application/json`, GELF v1.1 `{version:"1.1", host, short_message, _field…}`; `host→source`, strip leading `_` from custom fields, `timestamp` (unix sec) or receive-time; returns `202` empty body.
- **Droppable:** `POST /api/system/sessions` (embedded dashboard cookie) and `/api/views` (dashboard creation) — both already optional/degrade-gracefully; stub `404` is fine.
