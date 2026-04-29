// Partner Center video-analysis dashboard scraper.
// Injected by background.js via chrome.scripting.executeScript when the user
// clicks the action icon on partner.us.tiktokshop.com/compass/video-analysis.
// Runs alongside config.js (same isolated world), so TOK_CONFIG is available.
(function () {
  var CFG = globalThis.TOK_CONFIG || {};
  var GRAYLOG_ENDPOINT = CFG.GRAYLOG_ENDPOINT;
  var GRAYLOG_TOKEN    = CFG.GRAYLOG_TOKEN;
  var GRAYLOG_HOST     = 'tiktok-bookmarklet';
  var SHEET_ENDPOINT   = CFG.SHEET_ENDPOINT;
  var SHEET_TOKEN      = CFG.SHEET_TOKEN;

  var UP = "M2.97731 0.130983C3.11029 -0.0430998 3.37217 -0.0437687 3.50604 0.129632L6.44523 3.93668C6.6144 4.15581 6.45821 4.47372 6.18138 4.47372H4.60189V8.33326C4.60189 8.51735 4.45265 8.66659 4.26855 8.66659H2.26855C2.08446 8.66659 1.93522 8.51735 1.93522 8.33326V4.47372H0.333945C0.057903 4.47372 -0.0985142 4.15739 0.0690572 3.93803L2.97731 0.130983Z";
  var items = document.querySelectorAll('.arco-space-item');
  var metricsRoot = items[2];
  if (!metricsRoot) { console.warn('[tok-scrape] Key metrics container not found'); return; }

  var dateRoot = items[0];
  var dateRange = { start: '', end: '' };
  if (dateRoot) {
    var startEl = dateRoot.querySelector('input[placeholder="Start month"]');
    var endEl   = dateRoot.querySelector('input[placeholder="End month"]');
    dateRange.start = startEl ? startEl.value : '';
    dateRange.end   = endEl   ? endEl.value   : '';
  }

  var checked = items[1] && items[1].querySelector('.arco-radio-checked');
  var card = checked && checked.closest('.flex.w-full.flex-col');
  var nameEl = card && card.querySelector('.text-body-s-medium');
  var creator = nameEl ? nameEl.textContent.trim() : '';

  var metrics = [];
  metricsRoot.querySelectorAll('.flex.flex-col.items-start').forEach(function (c) {
    var k = c.querySelector('.text-14'),
        v = c.querySelector('.text-20');
    if (!k || !v) return;
    var row = v.nextElementSibling,
        p = row && row.querySelector('svg path'),
        pct = row && row.querySelector('span');
    var dir = p && p.getAttribute('d') === UP ? '↑' : '↓';
    metrics.push({
      name:  k.textContent.trim(),
      value: v.textContent.trim(),
      trend: dir + ' ' + (pct ? pct.textContent.trim() : '')
    });
  });

  var videos = [];
  var videosRoot = items[items.length - 1];
  if (videosRoot && videosRoot !== metricsRoot) {
    var rows = videosRoot.querySelectorAll('tbody tr.arco-table-tr');
    rows.forEach(function (row) {
      var link = row.querySelector('a.text-12.hover\\:underline');
      if (!link) return;

      var href = link.getAttribute('href');

      if (!creator) {
        var cm = href && href.match(/@([^/]+)/);
        if (cm) creator = '@' + cm[1];
      }

      var linkParent = link.parentElement;
      var infoCol   = linkParent.parentElement;

      var nameContainer = infoCol.querySelector('.whitespace-nowrap.overflow-ellipsis.overflow-hidden');
      var nameEl2 = nameContainer && nameContainer.querySelector('.overflow-hidden.overflow-ellipsis');
      var name = nameEl2 ? nameEl2.textContent.replace(/\s+/g, ' ').trim() : '';

      var idText = '';
      var idDiv = linkParent.previousElementSibling;
      if (idDiv) {
        var idEl = idDiv.querySelector('.text-12');
        idText = idEl ? idEl.textContent.trim().replace(/^Video ID:\s*/, '') : '';
      }

      var posted = '', duration = '';
      var postedDiv = linkParent.nextElementSibling;
      if (postedDiv) {
        var pEl = postedDiv.querySelector('.text-12');
        if (pEl) {
          var m = pEl.textContent.trim().match(/Posted:\s*(\S+)\s+Duration:\s*(\S+)/);
          if (m) { posted = m[1]; duration = m[2]; }
        }
      }

      var tds = row.querySelectorAll('td.arco-table-td');
      var get = function (td) {
        var inner = td.querySelector('.arco-table-cell-wrap-value');
        return inner ? inner.textContent.trim() : '';
      };

      var detailsLink = '';
      if (tds[8]) {
        var a = tds[8].querySelector('a');
        detailsLink = a ? a.getAttribute('href') : '';
      }

      videos.push({
        'Video ID':         idText,
        'Name':             name,
        'Link':             href,
        'Posted':           posted,
        'Duration':         duration,
        'Affiliate GMV':    tds[1] ? get(tds[1]) : '',
        'Items sold':       tds[2] ? get(tds[2]) : '',
        'Est. commissions': tds[3] ? get(tds[3]) : '',
        'Direct GMV':       tds[4] ? get(tds[4]) : '',
        'RPM':              tds[5] ? get(tds[5]) : '',
        'Views':            tds[6] ? get(tds[6]) : '',
        'Completion rate':  tds[7] ? get(tds[7]) : '',
        'Details':          detailsLink
      });
    });
  }

  var payload = {
    creator:   creator,
    scrapedAt: new Date().toISOString(),
    dateRange: dateRange,
    metrics:   metrics,
    videos:    videos
  };
  console.log('[tok-scrape:creator]', payload);

  if (SHEET_ENDPOINT) {
    chrome.runtime.sendMessage({
      source: 'tok-scrape',
      type:   'sheet',
      endpoint: SHEET_ENDPOINT,
      payload: {
        token:     SHEET_TOKEN,
        creator:   payload.creator,
        scrapedAt: payload.scrapedAt,
        dateRange: payload.dateRange,
        metrics:   payload.metrics,
        videos:    payload.videos
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
      short_message: 'tiktok scrape: ' + (payload.creator || 'unknown') + ' (' + videos.length + ' videos)',
      timestamp: Math.floor(Date.now() / 1000),
      _creator:       payload.creator,
      _scrapedAt:     payload.scrapedAt,
      _date_start:    dateRange.start,
      _date_end:      dateRange.end,
      _metrics_count: metrics.length,
      _videos_count:  videos.length,
      _metrics_json:  JSON.stringify(metrics),
      _videos_json:   JSON.stringify(videos),
      _graylog_key:   GRAYLOG_TOKEN
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
