#!/usr/bin/env node
/* Build a per-member, pre-loaded APK.
 *
 * Reads:
 *   MEMBER_ID            (required)  -- one or more comma-separated handles or
 *                                       handle ids. Examples:
 *                                         MEMBER_ID=boosteddealsdaily
 *                                         MEMBER_ID=boosteddealsdaily,wizardofdealz,prettyplug.x
 *                                       Each is normalised to lower-case with a
 *                                       leading "@" stripped. The first entry is
 *                                       the default scope on first launch.
 *   GRAYLOG_URL          (required)  -- e.g. http://10.0.2.2:9000
 *   GRAYLOG_TOKEN        (required)  -- Graylog API token
 *   GRAYLOG_GELF_URL     (optional)  -- HTTP GELF input for "Add Exported
 *                                       Data" uploads. Defaults to the same
 *                                       ngrok URL the browser extensions use.
 *   COMMON_DASHBOARD_ID  (optional)  -- if missing, the script looks up (or
 *                                       creates) a "Seller Comparison" view
 *                                       via the Graylog Views API
 *   COMMON_DASHBOARD_NAME (optional, default "Seller Comparison")
 *   RELEASE              (optional)  -- if "1", builds --release
 *
 * Writes:
 *   www/js/preload.js                    -- generated seed (overwrites stub)
 *   dist/app-<first-id>[+N].apk          -- copy of the cordova-built APK
 *
 * Always restores www/js/preload.js from preload.js.example after the build,
 * so the working tree stays clean.
 */
'use strict';

const fs        = require('node:fs');
const path      = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT       = path.resolve(__dirname, '..');
const WWW_JS     = path.join(ROOT, 'www', 'js');
const PRELOAD    = path.join(WWW_JS, 'preload.js');
const PRELOAD_EX = path.join(WWW_JS, 'preload.js.example');
const DIST       = path.join(ROOT, 'dist');

function fail(msg) { console.error('build-preloaded: ' + msg); process.exit(1); }

function envOrFail(name) {
  const v = process.env[name];
  if (!v || !v.trim()) fail(`${name} is required`);
  return v.trim();
}

// Normalise a single handle / id -> the canonical id used by users.js.
function memberIdFromHandle(handle) {
  return String(handle || '').replace(/^@+/, '').toLowerCase();
}

// Parse MEMBER_ID into a non-empty list of canonical ids. Comma-separated;
// empties are dropped. Order is preserved so the first id can be used as the
// default scope.
function parseMemberIds(raw) {
  const ids = String(raw || '')
    .split(',')
    .map(s => memberIdFromHandle(s.trim()))
    .filter(Boolean);
  if (!ids.length) fail('MEMBER_ID must contain at least one id');
  // Dedupe preserving order.
  const seen = new Set();
  return ids.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
}

// --- Roster validation: each MEMBER_ID id is checked against the live Graylog
// roster. Mismatches are warned about (not failed) so newly-onboarded handles
// without scrapes yet can still be seeded into the picker.
//
// We query per-id (one Graylog request per MEMBER_ID) instead of fetching the
// top N messages and dedup'ing locally — the latter approach silently drops
// less-active creators when busier scrapers (analytics, data-overview, the
// xlsx-export pipeline) fill the window. The per-id query covers every
// known source (creator-bookmarklet, streamer-compass, livestream-analytics,
// data-overview, affiliate-export) and ORs the analyzed `creator` field with
// `creator.keyword` so handles containing a `.` (e.g. "@prettyplug.x") match
// reliably regardless of how the field is mapped.
const ALL_SOURCES_LUCENE = [
  'source:tiktok-bookmarklet',
  'source:tiktok-bookmarklet-streamer',
  'source:tiktok-bookmarklet-livestream-analytics',
  'source:tiktok-bookmarklet-data-overview',
  'source:tiktok-affiliate-export',
].join(' OR ');

async function isCreatorKnown(graylogUrl, token, memberId) {
  const base = graylogUrl.replace(/\/+$/, '');
  const handle = '@' + memberId;
  const safe = handle.replace(/"/g, '\\"');
  const lucene = '(' + ALL_SOURCES_LUCENE + ') AND ' +
    '(creator:"' + safe + '" OR creator.keyword:"' + safe + '")';
  const params = new URLSearchParams({
    query: lucene,
    range: String(5 * 365 * 24 * 3600),
    limit: '1',
    sort:  'timestamp:desc',
    fields: 'creator',
  });
  const resp = await graylogJson('GET', `${base}/api/search/universal/relative?${params.toString()}`, undefined, token);
  const msgs = (resp && resp.messages) || [];
  return msgs.length > 0;
}

// --- Graylog Views API helpers ----------------------------------------
async function graylogJson(method, url, body, token) {
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(token + ':token').toString('base64'),
    'Accept': 'application/json',
    'X-Requested-By': 'tok-scrape-build-preloaded',
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Graylog ${method} ${url} -> ${resp.status}: ${text || resp.statusText}`);
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function viewsPayload(title) {
  const queryId   = 'q-' + Math.random().toString(36).slice(2, 10);
  const searchId  = 's-' + Math.random().toString(36).slice(2, 10);
  const widgetId  = 'w-' + Math.random().toString(36).slice(2, 10);
  return {
    title,
    summary: 'Cross-creator comparison shared by every member.',
    description: 'Auto-created by mobile-app/scripts/build-preloaded.js. Edit in the Graylog UI to add custom widgets.',
    type: 'DASHBOARD',
    search_id: searchId,
    properties: [],
    state: {
      [queryId]: {
        titles: { tab: { title }, widget: { [widgetId]: 'Scrapes per creator' } },
        widgets: [{
          id: widgetId, type: 'aggregation',
          filter: null, timerange: null, query: null, streams: [],
          config: {
            row_pivots:    [{ field: 'creator', config: { limit: 15 } }],
            column_pivots: [],
            series:        [{ config: { name: 'count()' }, function: 'count()' }],
            sort:          [],
            visualization: 'bar',
            rollup: true,
            event_annotation: false,
          },
        }],
        positions: { [widgetId]: { col: 1, row: 1, height: 6, width: 12 } },
        widget_mapping: { [widgetId]: [] },
        formatting: { highlighting: [] },
        display_mode_settings: { positions: {} },
      },
    },
  };
}

async function ensureDashboardId(graylogUrl, token, title) {
  const base = graylogUrl.replace(/\/+$/, '');
  const list = await graylogJson('GET', `${base}/api/views?per_page=200`, undefined, token);
  const items = (list && list.views) || [];
  const existing = items.find(v => v && v.title === title);
  if (existing) return existing.id;
  const created = await graylogJson('POST', `${base}/api/views`, viewsPayload(title), token);
  if (!created || !created.id) throw new Error('Graylog returned no id for created view: ' + JSON.stringify(created));
  return created.id;
}

// --- preload.js generation --------------------------------------------
function writePreload({ memberIds, graylogUrl, token, gelfUrl, dashboardId, dashboardName }) {
  // The first id is the default scope on first launch (single-account view).
  // The full list is seeded into the roster so every member shows up in the
  // picker even if Graylog has no data for them yet.
  const handles = memberIds.map(id => '@' + id);
  const seed = {
    enabled: true,
    auth:    { scope: [memberIds[0]] },
    settings: {
      url:         graylogUrl.replace(/\/+$/, ''),
      token,
      query:       'source:tiktok-bookmarklet',
      gelfUrl,
      autoRefresh: true,
    },
    roster: handles,
    common: {
      enabled: !!dashboardId,
      name: dashboardName,
      graylogDashboardId: dashboardId || '',
    },
  };
  const banner =
    '// AUTO-GENERATED by scripts/build-preloaded.js. Do not edit by hand.\n' +
    '// Restored to the no-op stub from preload.js.example after each build.\n';
  const body =
`(function () {
  'use strict';
  var SEED = ${JSON.stringify(seed, null, 2)};
  if (!SEED.enabled) return;
  if (Array.isArray(SEED.roster) && SEED.roster.length) {
    window.__TOK_PRELOADED_ROSTER__ = SEED.roster.slice();
  }
  var setIfMissing = function (k, v) {
    try { if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) {}
  };
  setIfMissing('tok-scrape.auth.v1',             SEED.auth);
  setIfMissing('tok-scrape.settings.v1',         SEED.settings);
  if (SEED.common && SEED.common.enabled) setIfMissing('tok-scrape.commonDashboard.v1', SEED.common);
})();
`;
  fs.writeFileSync(PRELOAD, banner + body);
  console.log('build-preloaded: wrote', path.relative(ROOT, PRELOAD));
}

function restorePreload() {
  try {
    fs.copyFileSync(PRELOAD_EX, PRELOAD);
    console.log('build-preloaded: restored preload.js from preload.js.example');
  } catch (e) {
    console.warn('build-preloaded: failed to restore preload.js:', e.message);
  }
}

// --- main --------------------------------------------------------------
(async function main() {
  const memberIds   = parseMemberIds(envOrFail('MEMBER_ID'));
  const graylogUrl  = envOrFail('GRAYLOG_URL');
  const token       = envOrFail('GRAYLOG_TOKEN');
  const gelfUrl     = (process.env.GRAYLOG_GELF_URL || 'https://tok-graylog-gelf.ngrok-free.dev/gelf').trim();
  const dashboardName = (process.env.COMMON_DASHBOARD_NAME || 'Seller Comparison').trim();
  let dashboardId   = (process.env.COMMON_DASHBOARD_ID || '').trim();
  const release     = process.env.RELEASE === '1';

  console.log('build-preloaded: members =', memberIds.join(', '));

  // Per-id roster check; failures here are advisory, never fatal.
  const missing = [];
  let validationOk = true;
  for (const id of memberIds) {
    try {
      const known = await isCreatorKnown(graylogUrl, token, id);
      if (!known) missing.push(id);
    } catch (e) {
      validationOk = false;
      console.warn(`build-preloaded: could not validate "${id}" against Graylog (${e.message}); skipping further validation`);
      break;
    }
  }
  if (validationOk && missing.length) {
    console.warn(`build-preloaded: MEMBER_ID has ${missing.length} unknown id(s) — Graylog has no scrapes yet for: ${missing.join(', ')}. Seeding into the picker anyway.`);
  }

  if (!dashboardId) {
    console.log(`build-preloaded: looking up Graylog dashboard "${dashboardName}"...`);
    try {
      dashboardId = await ensureDashboardId(graylogUrl, token, dashboardName);
      console.log('build-preloaded: dashboard id =', dashboardId);
    } catch (e) {
      console.warn('build-preloaded: could not ensure dashboard ('+e.message+'); continuing without common-dashboard menu');
      dashboardId = '';
    }
  }

  writePreload({ memberIds, graylogUrl, token, gelfUrl, dashboardId, dashboardName });

  let exitCode = 1;
  try {
    const args = ['build', 'android'];
    if (release) args.push('--release');
    console.log('build-preloaded: cordova', args.join(' '));
    const r = spawnSync('cordova', args, { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) {
      throw new Error('cordova build failed with exit code ' + r.status);
    }
    exitCode = 0;
  } catch (e) {
    console.error('build-preloaded:', e.message);
  } finally {
    restorePreload();
  }

  if (exitCode !== 0) process.exit(exitCode);

  const buildOut = path.join(ROOT, 'platforms', 'android', 'app', 'build', 'outputs', 'apk');
  const subdir   = release ? 'release' : 'debug';
  const dir      = path.join(buildOut, subdir);
  let apkSrc = '';
  if (fs.existsSync(dir)) {
    const found = fs.readdirSync(dir).find(f => f.endsWith('.apk'));
    if (found) apkSrc = path.join(dir, found);
  }
  if (!apkSrc) {
    console.error('build-preloaded: cordova build succeeded but no APK was found under', dir);
    process.exit(1);
  }
  fs.mkdirSync(DIST, { recursive: true });
  // Filename: first id, plus "+N" suffix when multiple creators are seeded.
  const tag = memberIds.length === 1 ? memberIds[0] : `${memberIds[0]}+${memberIds.length - 1}`;
  const apkDst = path.join(DIST, `app-${tag}${release ? '-release' : ''}.apk`);
  fs.copyFileSync(apkSrc, apkDst);
  console.log('build-preloaded: APK ->', apkDst);
})().catch(err => {
  console.error('build-preloaded: fatal:', err);
  restorePreload();
  process.exit(1);
});
