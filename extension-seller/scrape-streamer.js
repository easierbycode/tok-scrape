// Seller-side Streamer Compass video-analysis scraper:
//   shop.tiktok.com/streamer/compass/video-analysis/view
// Same metric "shape" as the partner-center creator dashboard, different DOM
// (Tailwind utilities, CSS module hashes, no arco table). Pulls the date
// range, the 5 KPI tiles, and the full video card stack.
(function () {
  var CFG = globalThis.TOK_CONFIG || {};
  var GRAYLOG_ENDPOINT = CFG.GRAYLOG_ENDPOINT;
  var GRAYLOG_TOKEN    = CFG.GRAYLOG_TOKEN;
  var GRAYLOG_HOST     = 'tiktok-bookmarklet-streamer';
  var SHEET_ENDPOINT   = CFG.SHEET_ENDPOINT;
  var SHEET_TOKEN      = CFG.SHEET_TOKEN;

  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };

  var titleHeader = document.querySelector('span.text-head-l.font-bold.text-neutral-text1');
  var titleEl = titleHeader ? titleHeader.querySelector('span') : null;
  var pageTitle = titleEl ? clean(titleEl.textContent) : '';

  var startInput = document.querySelector('input[placeholder="Start date"]');
  var endInput   = document.querySelector('input[placeholder="End date"]');
  var dateRange = {
    start: startInput ? startInput.value : '',
    end:   endInput   ? endInput.value   : ''
  };
  var prefixEl = document.querySelector('.arco-picker-prefix');
  var dateLabel = prefixEl ? clean(prefixEl.textContent.replace(/:\s*$/, '')) : '';

  var metrics = [];
  var grid = document.querySelector('.grid.grid-cols-3');
  if (grid) {
    grid.querySelectorAll(':scope > div').forEach(function (card) {
      var labelEl = card.querySelector('.text-body-m-medium.text-neutral-text1');
      if (!labelEl) return;
      var name = clean(labelEl.textContent);
      var valueEl = card.querySelector('.text-head-l.text-neutral-text1');
      var value = valueEl ? clean(valueEl.textContent) : '';
      var currencyEl = card.querySelector('.text-body-l-regular.mr-2');
      var currency = currencyEl ? clean(currencyEl.textContent) : '';
      var compareKeyEl = card.querySelector('.text-body-s-medium.text-neutral-text3 > div');
      var compareKey = compareKeyEl ? clean(compareKeyEl.textContent) : '';
      var deltaEl = card.querySelector('.text-body-s-medium.text-neutral-text3 .mx-4');
      var delta = deltaEl ? clean(deltaEl.textContent) : '';
      metrics.push({
        name:        name,
        value:       value,
        currency:    currency,
        compareKey:  compareKey,
        delta:       delta
      });
    });
  }

  var videos = [];
  document.querySelectorAll('img[alt="video thumbnail"]').forEach(function (thumb) {
    var card = thumb.closest('.mb-32');
    if (!card) return;

    var titleSpan = card.querySelector('span.text-body-l-medium.text-neutral-text1');
    var title = titleSpan ? clean(titleSpan.textContent) : '';

    var posted = '', duration = '';
    card.querySelectorAll('.text-body-m-regular.text-neutral-text3').forEach(function (s) {
      var spans = s.querySelectorAll('span');
      if (spans.length < 2) return;
      var label = clean(spans[0].textContent);
      var value = clean(s.querySelector('.text-body-m-medium')
        ? s.querySelector('.text-body-m-medium').textContent
        : '');
      if (/^Posted/.test(label)) posted = value;
      else if (/^Duration/.test(label)) duration = value;
    });

    var videoMetrics = [];
    var metricsRow = card.querySelector('.bg-neutral-bg2');
    if (metricsRow) {
      metricsRow.querySelectorAll(':scope > div').forEach(function (cell) {
        var labelEl = cell.querySelector('.text-body-s-regular.text-neutral-text2');
        var valueEl = cell.querySelector('.text-body-l-medium.text-neutral-text1');
        if (labelEl && valueEl) {
          videoMetrics.push({
            name:  clean(labelEl.textContent),
            value: clean(valueEl.textContent)
          });
        }
      });
    }

    videos.push({
      Thumbnail: thumb.getAttribute('src') || '',
      Title:     title,
      Posted:    posted,
      Duration:  duration,
      Metrics:   videoMetrics
    });
  });

  var payload = {
    page:       pageTitle,
    dateLabel:  dateLabel,
    dateRange:  dateRange,
    scrapedAt:  new Date().toISOString(),
    metrics:    metrics,
    videos:     videos
  };
  console.log('[tok-scrape:streamer]', payload);

  if (SHEET_ENDPOINT) {
    chrome.runtime.sendMessage({
      source: 'tok-scrape',
      type:   'sheet',
      endpoint: SHEET_ENDPOINT,
      payload: {
        token:     SHEET_TOKEN,
        page:      payload.page,
        dateLabel: payload.dateLabel,
        dateRange: payload.dateRange,
        scrapedAt: payload.scrapedAt,
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
    // OpenSearch dynamically mapped `date_end`/`date_start` as type=date from
    // earlier creator-scraper messages (which send "2026-04-27"). The streamer
    // page's date inputs render "Apr 27, 2026", which fails OpenSearch's date
    // parsers and rejects the whole message at index time. Normalize to ISO
    // YYYY-MM-DD using local components (avoid toISOString() — it converts to
    // UTC and can shift the date by one day).
    var toISODate = function (s) {
      if (!s) return '';
      var d = new Date(s);
      if (isNaN(d.getTime())) return s;
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var dd = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + dd;
    };
    var gelf = {
      version: '1.1',
      host: GRAYLOG_HOST,
      short_message: 'tiktok streamer scrape: ' + (pageTitle || 'unknown') + ' (' + videos.length + ' videos, ' + metrics.length + ' kpis)',
      timestamp: Math.floor(Date.now() / 1000),
      _page:           payload.page,
      _date_label:     payload.dateLabel,
      _date_start:     toISODate(dateRange.start),
      _date_end:       toISODate(dateRange.end),
      _scrapedAt:      payload.scrapedAt,
      _metrics_count:  metrics.length,
      _metrics_json:   JSON.stringify(metrics),
      _videos_count:   videos.length,
      _videos_json:    JSON.stringify(videos),
      _graylog_key:    GRAYLOG_TOKEN
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
