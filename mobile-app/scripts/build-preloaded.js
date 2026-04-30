#!/usr/bin/env node
/* Build a per-member, pre-loaded APK.
 *
 * Reads:
 *   MEMBER_ID            (required)  -- id from www/js/users.js
 *   GRAYLOG_URL          (required)  -- e.g. http://10.0.2.2:9000
 *   GRAYLOG_TOKEN        (required)  -- Graylog API token
 *   COMMON_DASHBOARD_ID  (optional)  -- if missing, the script looks up (or
 *                                       creates) a "Seller Comparison" view
 *                                       via the Graylog Views API
 *   COMMON_DASHBOARD_NAME (optional, default "Seller Comparison")
 *   RELEASE              (optional)  -- if "1", builds --release
 *
 * Writes:
 *   www/js/preload.js                -- generated seed (overwrites stub)
 *   dist/app-<MEMBER_ID>.apk         -- copy of the cordova-built APK
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
const USERS_JS   = path.join(WWW_JS, 'users.js');
const DIST       = path.join(ROOT, 'dist');

function fail(msg) { console.error('build-preloaded: ' + msg); process.exit(1); }

function envOrFail(name) {
  const v = process.env[name];
  if (!v || !v.trim()) fail(`${name} is required`);
  return v.trim();
}

// --- Roster validation: parse the `id` strings out of users.js without
// requiring a JS module loader. The roster is plain literals so a regex is
// sufficient and robust.
function readRosterIds() {
  const src = fs.readFileSync(USERS_JS, 'utf8');
  const ids = [];
  const rx = /\bid:\s*'([^']+)'/g;
  let m;
  while ((m = rx.exec(src)) !== null) ids.push(m[1]);
  return ids;
}

// --- Graylog Views API helpers ----------------------------------------
//
// Graylog 7 stores dashboards under the Views API. The mobile-app doesn't
// need to render the JSON shape — only to know the id to embed. So we look
// up by title; create if missing; return the id either way.
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
  // Minimal Views payload: a single search with one widget aggregating the
  // bookmarklet's `_creator` field. Graylog accepts an underspecified Views
  // doc and fills in the rest; the dashboard page renders successfully even
  // if widgets need re-saving by an admin in the UI.
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
function writePreload({ memberId, graylogUrl, token, dashboardId, dashboardName }) {
  const seed = {
    enabled: true,
    auth:    { userId: memberId },
    settings: {
      url:         graylogUrl.replace(/\/+$/, ''),
      token,
      query:       'source:tiktok-bookmarklet',
      autoRefresh: true,
    },
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
  const memberId    = envOrFail('MEMBER_ID');
  const graylogUrl  = envOrFail('GRAYLOG_URL');
  const token       = envOrFail('GRAYLOG_TOKEN');
  const dashboardName = (process.env.COMMON_DASHBOARD_NAME || 'Seller Comparison').trim();
  let dashboardId   = (process.env.COMMON_DASHBOARD_ID || '').trim();
  const release     = process.env.RELEASE === '1';

  const ids = readRosterIds();
  if (!ids.includes(memberId)) {
    fail(`unknown MEMBER_ID "${memberId}" -- valid ids: ${ids.join(', ')}`);
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

  writePreload({ memberId, graylogUrl, token, dashboardId, dashboardName });

  // Run cordova build and always restore preload.js afterwards.
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

  // Locate the built APK and copy it into dist/.
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
  const apkDst = path.join(DIST, `app-${memberId}${release ? '-release' : ''}.apk`);
  fs.copyFileSync(apkSrc, apkDst);
  console.log('build-preloaded: APK ->', apkDst);
})().catch(err => {
  console.error('build-preloaded: fatal:', err);
  restorePreload();
  process.exit(1);
});
