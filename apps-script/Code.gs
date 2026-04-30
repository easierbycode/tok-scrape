/**
 * Google Apps Script Web App backend for the tok-scrape extensions.
 *
 * Receives the JSON payload emitted by the Chrome extensions and writes it
 * into the container spreadsheet. The handler routes by payload shape:
 *
 * Creator + Streamer (extension-agency/scrape-creator.js,
 *                     extension-seller/scrape-streamer.js)
 *   → "Metrics" — one row per metric per scrape (append-only)
 *   → "Videos"  — one row per video, upserted by Video ID
 *
 * LIVE Dashboard (extension-seller/scrape-live.js)
 *   → "Live Sessions" — one row per scrape with sideKpis + performance
 *                       metrics flattened into named columns
 *   → "Live Products" — one row per (room_id, Product ID), upserted
 *
 * Setup
 * -----
 * 1. Create a Google Sheet. Tabs are auto-created on first write.
 * 2. Extensions -> Apps Script. Replace Code.gs with this file. Save.
 * 3. Project Settings -> Script properties -> Add property:
 *       TOKEN = <a random shared secret>
 *    Paste the same value into SHEET_TOKEN in extension-{agency,seller}/config.js.
 * 4. Deploy -> New deployment -> Select type: Web app.
 *       Execute as: Me
 *       Who has access: Anyone
 *    Copy the /exec URL and paste it into SHEET_ENDPOINT in each config.js.
 *
 * Payload shape — creator / streamer:
 *   {
 *     token, creator | page, scrapedAt, dateRange: { start, end },
 *     metrics: [ { name, value, trend }, ... ],
 *     videos:  [ { "Video ID", "Name", "Link", "Posted", "Duration", ... }, ... ]
 *   }
 *
 * Payload shape — LIVE Dashboard (the differentiating signal is `roomId`
 * plus a `products` array; routed to handleLivePayload):
 *   {
 *     token, page, shop, roomId, duration, sessionRange, scrapedAt, gmv,
 *     sideKpis:       { "Items sold", "Viewers" },
 *     performance:    [ { name, value }, ... ],
 *     trafficSources: [ { Channel, GMV, Impressions, Views }, ... ],
 *     products:       [ { "Product ID", "Product name", "Product link",
 *                         "Metrics": [m1..m7] }, ... ]
 *   }
 */

var METRICS_SHEET = 'Metrics';
var VIDEOS_SHEET  = 'Videos';

var METRICS_HEADERS = [
  'scraped_at', 'creator', 'date_start', 'date_end',
  'metric', 'value', 'vs_previous_month'
];

// Video ID is column 1 so upsert lookups are a single getRange on column A.
var VIDEO_HEADERS = [
  'Video ID', 'creator', 'Name', 'Link', 'Posted', 'Duration',
  'Affiliate GMV', 'Items sold', 'Est. commissions', 'Direct GMV',
  'RPM', 'Views', 'Completion rate', 'Details',
  'last_scraped_at', 'date_start', 'date_end'
];

// LIVE Dashboard tabs (extension-seller/scrape-live.js payload). One row per
// scrape in "Live Sessions" with the headline KPIs flattened out of sideKpis
// and performance. "Live Products" upserts by Product ID with the metrics
// array preserved as JSON because the page doesn't expose stable column
// labels for it (see scrape-live.js: Metrics is a positional array).
var LIVE_SESSIONS_SHEET = 'Live Sessions';
var LIVE_PRODUCTS_SHEET = 'Live Products';

var LIVE_SESSION_HEADERS = [
  'scraped_at', 'shop', 'room_id', 'page', 'duration', 'session_range',
  'gmv', 'items_sold', 'viewers',
  'impressions', 'views', 'gmv_per_hour', 'impressions_per_hour',
  'show_gpm', 'avg_viewing_duration', 'comment_rate', 'follow_rate',
  'tap_through_rate_via_preview', 'tap_through_rate', 'live_ctr',
  'order_rate', 'share_rate', 'like_rate', 'over_1min_views',
  'products_count', 'traffic_sources_json'
];

// Composite key (room_id || Product ID) is column 1 so upsert lookups stay a
// single getRange on column A. The same product appears in many sessions, so
// keying only by Product ID would clobber per-session metrics across rooms.
var LIVE_PRODUCT_HEADERS = [
  'session_product_key', 'room_id', 'shop', 'Product ID',
  'Product name', 'Product link', 'metrics_json',
  'last_scraped_at', 'session_range'
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'empty body' });
    }
    var payload = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!expected || payload.token !== expected) {
      return jsonOut({ ok: false, error: 'unauthorized' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // The LIVE Dashboard payload is a different shape from the creator /
    // streamer one (no `metrics` / `videos` keys; has `products` and
    // `roomId`). Branch on a stable signal — presence of `roomId` plus a
    // `products` array — and route to the live writer. Without this branch
    // the legacy handler returns ok with metricsWritten=0/videosUpserted=0,
    // silently dropping the scrape.
    if (payload.roomId !== undefined && Array.isArray(payload.products)) {
      return handleLivePayload(ss, payload);
    }

    var creator   = payload.creator   || '';
    var scrapedAt = payload.scrapedAt || new Date().toISOString();
    var dateRange = payload.dateRange || { start: '', end: '' };

    var metricsWritten = 0;
    if (Array.isArray(payload.metrics) && payload.metrics.length) {
      var metricsSheet = ensureSheet(ss, METRICS_SHEET, METRICS_HEADERS);
      var metricRows = payload.metrics.map(function (m) {
        return [
          scrapedAt, creator, dateRange.start || '', dateRange.end || '',
          m.name || '', m.value || '', m.trend || ''
        ];
      });
      metricsSheet
        .getRange(metricsSheet.getLastRow() + 1, 1, metricRows.length, METRICS_HEADERS.length)
        .setValues(metricRows);
      metricsWritten = metricRows.length;
    }

    var videosUpserted = 0;
    if (Array.isArray(payload.videos) && payload.videos.length) {
      var videosSheet = ensureSheet(ss, VIDEOS_SHEET, VIDEO_HEADERS);
      videosUpserted = upsertVideos(videosSheet, payload.videos, creator, scrapedAt, dateRange);
    }

    return jsonOut({
      ok: true,
      metricsWritten: metricsWritten,
      videosUpserted: videosUpserted
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

function handleLivePayload(ss, payload) {
  var scrapedAt    = payload.scrapedAt    || new Date().toISOString();
  var shop         = payload.shop         || '';
  var roomId       = String(payload.roomId || '');
  var sessionRange = payload.sessionRange || '';
  var sideKpis     = payload.sideKpis     || {};
  var performance  = Array.isArray(payload.performance) ? payload.performance : [];
  var traffic      = Array.isArray(payload.trafficSources) ? payload.trafficSources : [];
  var products     = Array.isArray(payload.products) ? payload.products : [];

  // Index performance metrics by name for O(1) lookups when filling columns.
  // The carousel's slide order isn't stable, so positional lookup is unsafe.
  var perf = {};
  performance.forEach(function (m) {
    if (m && m.name) perf[m.name] = m.value || '';
  });

  var sessionsSheet = ensureSheet(ss, LIVE_SESSIONS_SHEET, LIVE_SESSION_HEADERS);
  var sessionRow = [
    scrapedAt, shop, roomId, payload.page || '', payload.duration || '',
    sessionRange, payload.gmv || '',
    sideKpis['Items sold'] || '', sideKpis['Viewers'] || '',
    perf['Impressions']                            || '',
    perf['Views']                                  || '',
    perf['GMV per hour']                           || '',
    perf['Impressions per hour']                   || '',
    perf['Show GPM']                               || '',
    perf['Avg. viewing duration per view']         || '',
    perf['Comment rate']                           || '',
    perf['Follow rate']                            || '',
    perf['Tap-through rate (via LIVE preview)']    || '',
    perf['Tap-through rate']                       || '',
    perf['LIVE CTR']                               || '',
    perf['Order rate (SKU orders)']                || '',
    perf['Share rate']                             || '',
    perf['Like rate']                              || '',
    perf['> 1 min. views']                         || '',
    products.length,
    JSON.stringify(traffic)
  ];
  sessionsSheet
    .getRange(sessionsSheet.getLastRow() + 1, 1, 1, LIVE_SESSION_HEADERS.length)
    .setValues([sessionRow]);

  var productsSheet = ensureSheet(ss, LIVE_PRODUCTS_SHEET, LIVE_PRODUCT_HEADERS);
  var productsUpserted = upsertLiveProducts(productsSheet, products, shop, roomId, scrapedAt, sessionRange);

  return jsonOut({
    ok: true,
    sessionRowsWritten: 1,
    productsUpserted: productsUpserted
  });
}

function upsertLiveProducts(sheet, products, shop, roomId, scrapedAt, sessionRange) {
  // Composite key keeps each (session, product) pair distinct so re-running
  // on the same room overwrites that room's row but doesn't clobber other
  // sessions that include the same product.
  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i][0];
      if (k !== '' && k !== null) existing[String(k)] = i + 2;
    }
  }

  var appends = [];
  var updates = [];
  products.forEach(function (p) {
    var productId = String(p['Product ID'] || '');
    if (!productId) return;
    var key = roomId + '|' + productId;
    var row = [
      key, roomId, shop, productId,
      p['Product name'] || '',
      p['Product link'] || '',
      JSON.stringify(p['Metrics'] || []),
      scrapedAt,
      sessionRange
    ];
    if (existing[key]) {
      updates.push({ row: existing[key], values: row });
    } else {
      appends.push(row);
    }
  });

  updates.forEach(function (u) {
    sheet.getRange(u.row, 1, 1, LIVE_PRODUCT_HEADERS.length).setValues([u.values]);
  });
  if (appends.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, appends.length, LIVE_PRODUCT_HEADERS.length)
      .setValues(appends);
  }
  return updates.length + appends.length;
}

/**
 * Simple GET handler so the deployment URL is easy to smoke-test in a browser.
 */
function doGet() {
  return jsonOut({ ok: true, service: 'tok-scrape metrics sink' });
}

function ensureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertVideos(sheet, videos, creator, scrapedAt, dateRange) {
  // Build an index of existing Video ID -> row number (1-based) in one read.
  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i][0];
      if (id !== '' && id !== null) existing[String(id)] = i + 2;
    }
  }

  var appends = [];
  var updates = []; // { row, values }
  videos.forEach(function (v) {
    var row = [
      v['Video ID'] || '',
      creator,
      v['Name'] || '',
      v['Link'] || '',
      v['Posted'] || '',
      v['Duration'] || '',
      v['Affiliate GMV'] || '',
      v['Items sold'] || '',
      v['Est. commissions'] || '',
      v['Direct GMV'] || '',
      v['RPM'] || '',
      v['Views'] || '',
      v['Completion rate'] || '',
      v['Details'] || '',
      scrapedAt,
      dateRange.start || '',
      dateRange.end || ''
    ];
    var key = String(v['Video ID'] || '');
    if (key && existing[key]) {
      updates.push({ row: existing[key], values: row });
    } else {
      appends.push(row);
    }
  });

  updates.forEach(function (u) {
    sheet.getRange(u.row, 1, 1, VIDEO_HEADERS.length).setValues([u.values]);
  });

  if (appends.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, appends.length, VIDEO_HEADERS.length)
      .setValues(appends);
  }

  return updates.length + appends.length;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
