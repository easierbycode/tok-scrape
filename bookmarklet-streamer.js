(function(){
  // ---- Google Sheets Apps Script Web App (fill these in once) ----
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzRGJMcZGvdRsAd9UHHATRG5ilpeh4JHCZ11ye5CMhHbs4LulaYJJsnndw8I2NfgvdG/exec';
  var TOKEN    = '**dingleding&&';
  // ---- Local Graylog GELF HTTP input (set to '' to disable) ----
  // The `bookmarklet-sync` sidecar in docker-compose.yml rewrites
  // GRAYLOG_ENDPOINT (ngrok public URL of the :12202 GELF tunnel) and
  // GRAYLOG_TOKEN (admin API token) on every `docker compose up`.
  var GRAYLOG_ENDPOINT = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
  var GRAYLOG_TOKEN    = '9dipsuq5er4puc1eikb9gcvq1msgelf8565caotiqpeh1hf7jeq';
  // Distinct source so Graylog can route this stream separately from the
  // creator (`tiktok-bookmarklet`), sellers (`tiktok-bookmarklet-sellers`),
  // and live (`tiktok-bookmarklet-live`) streams.
  var GRAYLOG_HOST     = 'tiktok-bookmarklet-streamer';
  // ----------------------------------------------------------------

  // Targets the seller-side Streamer Compass video-analysis view:
  //   shop.tiktok.com/streamer/compass/video-analysis/view
  // This is the seller's own video dashboard — same metric "shape" as the
  // partner-center creator bookmarklet, but a different DOM (Tailwind-only
  // utility classes, CSS module hashes, no arco table). Pulls the date
  // range, the 5 KPI tiles, and the full video card stack with per-video
  // metrics (GMV / Views / Items sold / CTR / Completion).

  var clean = function(s){ return (s || '').replace(/\s+/g, ' ').trim(); };

  // ── Page title + date range ─────────────────────────────────────────────
  // The header span wraps both the title and the date-picker — descend to
  // the inner <span> so we don't pick up "Last 28 days: …" too.
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

  // ── Core data — five KPI tiles in a 3-col grid ──────────────────────────
  // Each tile renders:
  //   <div index-module__container--W6C8V>
  //     <div text-body-m-medium ...>Label</div>          ← .text-body-m-medium.text-neutral-text1.pr-2
  //     <div text-body-l-regular>$</div>                 ← optional currency prefix
  //     <div text-head-l text-neutral-text1>VALUE</div>  ← the headline value
  //     <div text-body-s-medium text-neutral-text3>      ← compare row
  //       <div>vs_last_28d_us-style key</div>
  //       <div mx-4>+0.00</div>                          ← delta with leading sign
  //     </div>
  //   </div>
  // The hashed CSS-module class can drift on rebuilds; we anchor on the
  // grid container instead and treat each direct child as a card.
  var metrics = [];
  var grid = document.querySelector('.grid.grid-cols-3');
  if (grid) {
    grid.querySelectorAll(':scope > div').forEach(function(card){
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

  // ── Video Details — flex card stack (no arco-table here) ────────────────
  // Find each card by walking up from its thumbnail image. Each card has a
  // common ancestor `.mb-32` wrapper that contains the title/header and
  // the `.bg-neutral-bg2` metrics row.
  var videos = [];
  document.querySelectorAll('img[alt="video thumbnail"]').forEach(function(thumb){
    var card = thumb.closest('.mb-32');
    if (!card) return;

    // Title lives inside the first `<span class="text-body-l-medium ...">`
    // — the same class is used for cell values too, so we look for the
    // *span* variant which only wraps the title.
    var titleSpan = card.querySelector('span.text-body-l-medium.text-neutral-text1');
    var title = titleSpan ? clean(titleSpan.textContent) : '';

    // Posted + Duration: each is a `<span class="text-body-m-regular ...">`
    // wrapping a label span and a value span. The label text is
    // "Posted:" / "Duration:" — match on that to disambiguate.
    var posted = '', duration = '';
    card.querySelectorAll('.text-body-m-regular.text-neutral-text3').forEach(function(s){
      var spans = s.querySelectorAll('span');
      if (spans.length < 2) return;
      var label = clean(spans[0].textContent);
      var value = clean(s.querySelector('.text-body-m-medium')
        ? s.querySelector('.text-body-m-medium').textContent
        : '');
      if (/^Posted/.test(label)) posted = value;
      else if (/^Duration/.test(label)) duration = value;
    });

    // Per-video metrics row. Container has `.bg-neutral-bg2` — children
    // are the individual metric cells. Note: the row often shows two
    // "GMV" cells (total + a comparison), so we keep order via array
    // rather than collapsing into an object that would clobber dupes.
    var videoMetrics = [];
    var metricsRow = card.querySelector('.bg-neutral-bg2');
    if (metricsRow) {
      metricsRow.querySelectorAll(':scope > div').forEach(function(cell){
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

  // ── Payload + transport ─────────────────────────────────────────────────
  var payload = {
    page:       pageTitle,
    dateLabel:  dateLabel,
    dateRange:  dateRange,
    scrapedAt:  new Date().toISOString(),
    metrics:    metrics,
    videos:     videos
  };
  console.log(payload);

  if (ENDPOINT && ENDPOINT.indexOf('PASTE_') !== 0) {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token:     TOKEN,
        page:      payload.page,
        dateLabel: payload.dateLabel,
        dateRange: payload.dateRange,
        scrapedAt: payload.scrapedAt,
        metrics:   payload.metrics,
        videos:    payload.videos
      })
    }).then(function(r){ return r.json(); })
      .then(function(j){ console.log('[sheet]', j); })
      .catch(function(e){ console.warn('[sheet] post failed', e); });
  }

  if (GRAYLOG_ENDPOINT) {
    var gelf = {
      version: '1.1',
      host: GRAYLOG_HOST,
      short_message: 'tiktok streamer scrape: ' + (pageTitle || 'unknown') + ' (' + videos.length + ' videos, ' + metrics.length + ' kpis)',
      timestamp: Math.floor(Date.now() / 1000),
      _page:           payload.page,
      _date_label:     payload.dateLabel,
      _date_start:     dateRange.start,
      _date_end:       dateRange.end,
      _scrapedAt:      payload.scrapedAt,
      _metrics_count:  metrics.length,
      _metrics_json:   JSON.stringify(metrics),
      _videos_count:   videos.length,
      _videos_json:    JSON.stringify(videos),
      _graylog_key:    GRAYLOG_TOKEN
    };
    fetch(GRAYLOG_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(gelf)
    }).then(function(r){ console.log('[graylog] sent', r.status || 'opaque'); })
      .catch(function(e){ console.warn('[graylog] post failed', e); });
  }
})();
