// Seller-side LIVE Analytics scraper:
//   shop.tiktok.com/streamer/compass/livestream-analytics/view
// Multi-session aggregate view ("Live Analysis"). Pulls two blocks:
//   1. Livestreams Core Data — date range + several groups of trend cards
//      (transaction / product / interactive / traffic), each with N metrics.
//   2. All livestreams — date range + the per-session ranking table.
// Class-module hashes (`index__module-container--XXX`, `index__trend-cards--YYY`
// etc.) change between deploys, so we use [class*=...] substring selectors.
(function () {
  var CFG = globalThis.TOK_CONFIG || {};
  var GRAYLOG_ENDPOINT = CFG.GRAYLOG_ENDPOINT;
  var GRAYLOG_TOKEN    = CFG.GRAYLOG_TOKEN;
  var GRAYLOG_HOST     = 'tiktok-bookmarklet-livestream-analytics';
  var SHEET_ENDPOINT   = CFG.SHEET_ENDPOINT;
  var SHEET_TOKEN      = CFG.SHEET_TOKEN;

  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };

  var titleHeader = document.querySelector('span.text-head-l.font-bold.text-neutral-text1');
  var titleEl = titleHeader ? titleHeader.querySelector('span') : null;
  var pageTitle = titleEl ? clean(titleEl.textContent) : '';

  // Each section is wrapped in a card with `index__module-container--<hash>`.
  var readDateRange = function (mod) {
    var prefixEl = mod.querySelector('.arco-picker-prefix');
    var label = prefixEl ? clean(prefixEl.textContent.replace(/:\s*$/, '')) : '';
    var startInput = mod.querySelector('input[placeholder="Start date"]');
    var endInput   = mod.querySelector('input[placeholder="End date"]');
    return {
      label: label,
      start: startInput ? startInput.value : '',
      end:   endInput   ? endInput.value   : ''
    };
  };

  var readTrendCards = function (mod) {
    // Inside each module the cards are grouped. The outer container uses
    // `index__trend-cards-container--*`; the inner groups use
    // `index__trend-cards--*` (no `-container-`). The substring
    // "index__trend-cards--" only matches the inner group class.
    var groups = [];
    mod.querySelectorAll('[class*="index__trend-cards--"]').forEach(function (gp) {
      var labelEl = gp.querySelector('.text-body-l-regular');
      var groupName = labelEl ? clean(labelEl.textContent) : '';
      var metrics = [];
      // Cards are `index__trend-card--<hash>`. The double-dash blocks the
      // group selector above (`trend-cards--`) from matching here.
      gp.querySelectorAll('[class*="index__trend-card--"]').forEach(function (card) {
        var nameEl  = card.querySelector('.text-body-m-regular');
        var valueEl = card.querySelector('.text-body-l-medium');
        if (!nameEl || !valueEl) return;
        metrics.push({
          name:  clean(nameEl.textContent),
          value: clean(valueEl.textContent)
        });
      });
      if (groupName || metrics.length) {
        groups.push({ name: groupName, metrics: metrics });
      }
    });
    return groups;
  };

  var readZepTable = function (mod) {
    var table = mod.querySelector('table');
    if (!table) return null;
    var headers = [];
    table.querySelectorAll('thead th .zep-table-th-item-title').forEach(function (h) {
      headers.push(clean(h.textContent));
    });
    var rows = [];
    table.querySelectorAll('tbody tr.zep-table-tr').forEach(function (tr) {
      if (tr.classList.contains('zep-table-empty-row')) return;
      var cells = [];
      tr.querySelectorAll('td.zep-table-td').forEach(function (td) {
        cells.push(clean(td.textContent));
      });
      rows.push(cells);
    });
    return { headers: headers, rows: rows };
  };

  var sections = [];
  document.querySelectorAll('[class*="index__module-container--"]').forEach(function (mod) {
    var nameEl = mod.querySelector('.text-head-l.text-neutral-text1');
    var sectionName = nameEl ? clean(nameEl.textContent) : '';
    sections.push({
      name:      sectionName,
      dateRange: readDateRange(mod),
      groups:    readTrendCards(mod),
      table:     readZepTable(mod)
    });
  });

  var coreData    = sections.find(function (s) { return /core data/i.test(s.name); }) || null;
  var livestreams = sections.find(function (s) { return /^all livestreams$/i.test(s.name); }) || null;

  var payload = {
    page:        pageTitle,
    scrapedAt:   new Date().toISOString(),
    sections:    sections,
    coreData:    coreData,
    livestreams: livestreams
  };
  console.log('[tok-scrape:analytics]', payload);

  var groupCount  = sections.reduce(function (a, s) { return a + (s.groups ? s.groups.length : 0); }, 0);
  var metricCount = sections.reduce(function (a, s) {
    if (!s.groups) return a;
    return a + s.groups.reduce(function (b, g) { return b + g.metrics.length; }, 0);
  }, 0);
  var rowCount = livestreams && livestreams.table ? livestreams.table.rows.length : 0;

  if (SHEET_ENDPOINT) {
    chrome.runtime.sendMessage({
      source: 'tok-scrape',
      type:   'sheet',
      endpoint: SHEET_ENDPOINT,
      payload: {
        token:       SHEET_TOKEN,
        page:        payload.page,
        scrapedAt:   payload.scrapedAt,
        sections:    payload.sections,
        coreData:    payload.coreData,
        livestreams: payload.livestreams
      }
    }, function (resp) {
      if (chrome.runtime.lastError) {
        console.warn('[sheet] post failed', chrome.runtime.lastError.message);
      } else if (resp && resp.ok) {
        console.log('[sheet]', resp.body || resp.status);
      } else {
        console.warn('[sheet] post failed', resp && (resp.error || resp.status));
      }
    });
  }

  if (GRAYLOG_ENDPOINT) {
    var gelf = {
      version: '1.1',
      host: GRAYLOG_HOST,
      short_message: 'tiktok livestream-analytics scrape: ' + (pageTitle || 'unknown') +
        ' (' + sections.length + ' sections, ' + groupCount + ' groups, ' +
        metricCount + ' metrics, ' + rowCount + ' rows)',
      timestamp: Math.floor(Date.now() / 1000),
      _page:             payload.page,
      _scrapedAt:        payload.scrapedAt,
      _sections_count:   sections.length,
      _groups_count:     groupCount,
      _metrics_count:    metricCount,
      _rows_count:       rowCount,
      _sections_json:    JSON.stringify(payload.sections),
      _core_data_json:   JSON.stringify(payload.coreData),
      _livestreams_json: JSON.stringify(payload.livestreams),
      _graylog_key:      GRAYLOG_TOKEN
    };
    chrome.runtime.sendMessage({
      source: 'tok-scrape',
      type:   'gelf',
      endpoint: GRAYLOG_ENDPOINT,
      payload: gelf
    }, function (resp) {
      if (chrome.runtime.lastError) {
        console.warn('[graylog] post failed', chrome.runtime.lastError.message);
      } else if (resp && resp.ok) {
        console.log('[graylog] sent', resp.status);
      } else {
        console.warn('[graylog] post failed', resp && (resp.error || resp.status));
      }
    });
  }
})();
