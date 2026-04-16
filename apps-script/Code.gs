/**
 * Google Apps Script Web App backend for the Key Metrics bookmarklet.
 *
 * Receives the JSON payload emitted by index.html and writes
 * it into two tabs of the container spreadsheet:
 *
 *   - "Metrics": one row per metric per scrape (time-series, append only)
 *   - "Videos":  one row per video, upserted by Video ID
 *
 * Setup
 * -----
 * 1. Create a Google Sheet. Add two tabs named exactly "Metrics" and "Videos".
 * 2. Extensions -> Apps Script. Replace Code.gs with this file. Save.
 * 3. Project Settings -> Script properties -> Add property:
 *       TOKEN = <a random shared secret>
 *    Paste the same value into the TOKEN constant in index.html.
 * 4. Deploy -> New deployment -> Select type: Web app.
 *       Execute as: Me
 *       Who has access: Anyone
 *    Copy the /exec URL and paste it into the ENDPOINT constant in
 *    index.html.
 *
 * Payload shape (see index.html):
 *   {
 *     token:     "<shared secret>",
 *     creator:   "@handle",
 *     scrapedAt: "2026-04-14T12:34:56.000Z",
 *     dateRange: { start: "2026-03-01", end: "2026-03-31" },
 *     metrics:   [ { name, value, trend }, ... ],
 *     videos:    [ { "Video ID", "Name", "Link", "Posted", "Duration",
 *                    "Affiliate GMV", "Items sold", "Est. commissions",
 *                    "Direct GMV", "RPM", "Views", "Completion rate",
 *                    "Details" }, ... ]
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
