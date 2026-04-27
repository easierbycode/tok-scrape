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
  // creator (`tiktok-bookmarklet`) and sellers (`tiktok-bookmarklet-sellers`)
  // streams.
  var GRAYLOG_HOST     = 'tiktok-bookmarklet-live';
  // ----------------------------------------------------------------

  // Targets the seller-side LIVE Dashboard:
  //   shop.tiktok.com/workbench/live/overview?room_id=<id>&region=<region>
  // Pulls per-session KPIs (GMV, Items sold, Viewers), the Performance
  // trends carousel (Impressions / Views / GMV per hour / etc.), the
  // Traffic source breakdown, and the Product List ranking.

  var clean = function(s){ return (s || '').replace(/\s+/g, ' ').trim(); };

  // ── Shop identity + live session header ─────────────────────────────────
  var pageTitleEl = document.querySelector('.font-medium.text-xl.leading-9');
  var pageTitle = pageTitleEl ? clean(pageTitleEl.textContent) : '';

  // The shop name lives inside the only `.flex.items-center.ml-7` that
  // also contains an avatar `<img>` — narrow on that to skip the language
  // dropdown which uses similar wrapping classes.
  var shop = '';
  document.querySelectorAll('.flex.items-center.ml-7').forEach(function(el){
    if (shop) return;
    if (!el.querySelector('img[alt="avatar"]')) return;
    var t = el.querySelector('.truncate');
    if (t) shop = clean(t.textContent);
  });

  var roomId = '';
  var rm = location.href.match(/[?&]room_id=(\d+)/);
  if (rm) roomId = rm[1];

  // Live session "Duration ... 1h1m37s" + the absolute timestamp range.
  var duration = '';
  var sessionRange = '';
  document.querySelectorAll('.text-neutral-text-1.text-base.leading-6.font-medium').forEach(function(el){
    var t = clean(el.textContent);
    if (!t) return;
    if (/^\d+h\d+m/.test(t) || /^\d+m\d+s/.test(t) || /^\d+s$/.test(t)) {
      if (!duration) duration = t;
    } else if (/-/.test(t) && /[A-Z][a-z]{2}\s/.test(t)) {
      if (!sessionRange) sessionRange = t;
    }
  });

  // ── Headline KPIs ───────────────────────────────────────────────────────
  // GMV: animated odometer. Each digit is its own `.odometer-digit` with a
  // ribbon; the visible numeral is in `.odometer-value`. Concatenating all
  // values from the container gives the displayed integer. Scoping to
  // `-container` (instead of `-basic`) catches future markup variants where
  // the basic wrapper may be replaced or renamed.
  var gmv = '';
  var odoBlock = document.querySelector('.ecom-screen-animated-number-container');
  if (odoBlock) {
    var digits = [];
    odoBlock.querySelectorAll('.odometer-value').forEach(function(d){
      digits.push(clean(d.textContent));
    });
    gmv = digits.join('');
  }

  // Items sold + Viewers + (in some session states) extra side badges.
  // Each badge uses `.bg-state-normal` and labels the metric via a
  // `.text-xl.font-medium.text-neutral-text-1.ml-1` div. The arco statistic
  // splits a number across `-int` / `-decimal` / `-suffix` spans, but the
  // suffix is nested *inside* the decimal — so reading `textContent` of
  // the wrapping `.arco-statistic-value` already yields the right thing
  // ("1.74K") without a manual concat that would double the suffix.
  var statValue = function(stat){
    return stat ? clean(stat.textContent) : '';
  };

  var sideKpis = {};
  document.querySelectorAll('.bg-state-normal').forEach(function(badge){
    var labelEl = badge.querySelector('.text-xl.font-medium.text-neutral-text-1.ml-1');
    if (!labelEl) return;
    var label = clean(labelEl.textContent);
    if (!label) return;
    var value = statValue(badge.querySelector('.arco-statistic-value'));
    sideKpis[label] = value;
  });

  // ── Performance trends carousel ─────────────────────────────────────────
  // The carousel rotates between metrics like Impressions / Views /
  // GMV per hour / Impressions per hour / Show GPM. All slide DOM stays
  // mounted so we can read every `.arco-col` that has both a label
  // (.text-base.text-neutral-text-1.truncate) and a value
  // (.arco-statistic-value). De-dupe by label since slides repeat as the
  // carousel cycles.
  var perfMap = {};
  document.querySelectorAll('.arco-col').forEach(function(col){
    var labelEl = col.querySelector('.text-base.text-neutral-text-1.truncate');
    var valueEl = col.querySelector('.arco-statistic-value');
    if (!labelEl || !valueEl) return;
    var label = clean(labelEl.textContent);
    if (!label || perfMap[label] != null) return;
    perfMap[label] = statValue(valueEl);
  });
  var performance = Object.keys(perfMap).map(function(k){
    return { name: k, value: perfMap[k] };
  });

  // ── Section helpers ─────────────────────────────────────────────────────
  // Find a section's nearest table by walking up to a common ancestor that
  // also contains a section header, then descending to its arco-table.
  // We match the header by `startsWith` so a trailing count badge (the
  // Product List header has e.g. " 60" appended) doesn't trip equality.
  var findSectionTable = function(headerText){
    var header = null;
    document.querySelectorAll('.text-xl.font-medium').forEach(function(el){
      if (header) return;
      if (clean(el.textContent).indexOf(headerText) === 0) header = el;
    });
    if (!header) return null;
    var node = header;
    for (var i = 0; i < 6 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      var tbl = node.querySelector('.arco-table');
      if (tbl) return tbl;
    }
    return null;
  };

  var cellText = function(td){
    if (!td) return '';
    var inner = td.querySelector('.arco-table-cell-wrap-value');
    return inner ? clean(inner.textContent) : '';
  };

  // ── Traffic source table ────────────────────────────────────────────────
  // Header: Channel | GMV | Impressions | Views.
  // Each visible row is two <tr>s — one with data (4 td.colspan="1") and a
  // following one with a single colspan="4" td that holds the share-bar.
  // Filter to data rows by requiring 4 cells.
  var trafficSources = [];
  var trafficTable = findSectionTable('Traffic source');
  if (trafficTable) {
    var headers = [];
    trafficTable.querySelectorAll('thead .arco-table-th-item-title').forEach(function(h){
      headers.push(clean(h.textContent));
    });
    trafficTable.querySelectorAll('tbody tr.arco-table-tr').forEach(function(tr){
      var tds = tr.querySelectorAll('td.arco-table-td');
      if (tds.length !== 4) return;
      // Visible rows are followed by a "progress bar" sibling row whose
      // first cell has `colspan="4"` and trailing empty cells — skip those
      // since they're decoration, not data.
      var first = tds[0];
      if (first.getAttribute('colspan') !== '1') return;
      if (first.querySelector('.arco-progress')) return;
      trafficSources.push({
        Channel:     cellText(tds[0]),
        GMV:         cellText(tds[1]),
        Impressions: cellText(tds[2]),
        Views:       cellText(tds[3])
      });
    });
    // Persist header labels in case the column set changes server-side.
    if (headers.length === 4) {
      trafficSources._headers = headers;
    }
  }

  // ── Product List ranking ────────────────────────────────────────────────
  // Each row: fixed-left Product cell (img + product link + product ID) +
  // a stats column (often blank) + several metric cells with `<p>` value.
  // Scrape every metric td as raw text so the column set can drift without
  // breaking the bookmarklet.
  var products = [];
  var productTable = findSectionTable('Product List');
  if (productTable) {
    var pHeaders = [];
    productTable.querySelectorAll('thead .arco-table-th-item-title').forEach(function(h){
      var inner = h.querySelector('.text-wrap, .line-clamp-3');
      pHeaders.push(clean(inner ? inner.textContent : h.textContent));
    });
    productTable.querySelectorAll('tbody tr.arco-table-tr').forEach(function(tr){
      var tds = tr.querySelectorAll('td.arco-table-td');
      if (tds.length < 2) return;
      var fixedCell = tds[0];
      var nameLink = fixedCell.querySelector('a[href*="/view/product/"]');
      var idEl     = fixedCell.querySelector('span.opacity-50');
      var productName = nameLink ? clean(nameLink.textContent) : '';
      var productHref = nameLink ? nameLink.getAttribute('href') : '';
      var productId   = '';
      if (idEl) {
        productId = clean(idEl.textContent.replace(/^\s*ID:\s*/, ''));
      }
      if (!productId && productHref) {
        var pm = productHref.match(/\/view\/product\/(\d+)/);
        if (pm) productId = pm[1];
      }
      var metrics = [];
      for (var i = 1; i < tds.length; i++) {
        metrics.push(cellText(tds[i]));
      }
      products.push({
        'Product ID':   productId,
        'Product name': productName,
        'Product link': productHref,
        'Metrics':      metrics
      });
    });
    if (pHeaders.length) products._headers = pHeaders;
  }

  // ── Payload + transport ─────────────────────────────────────────────────
  var payload = {
    page:           pageTitle,
    shop:           shop,
    roomId:         roomId,
    duration:       duration,
    sessionRange:   sessionRange,
    scrapedAt:      new Date().toISOString(),
    gmv:            gmv,
    sideKpis:       sideKpis,
    performance:    performance,
    trafficSources: trafficSources,
    products:       products
  };
  console.log(payload);

  if (ENDPOINT && ENDPOINT.indexOf('PASTE_') !== 0) {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token:          TOKEN,
        page:           payload.page,
        shop:           payload.shop,
        roomId:         payload.roomId,
        duration:       payload.duration,
        sessionRange:   payload.sessionRange,
        scrapedAt:      payload.scrapedAt,
        gmv:            payload.gmv,
        sideKpis:       payload.sideKpis,
        performance:    payload.performance,
        trafficSources: payload.trafficSources,
        products:       payload.products
      })
    }).then(function(r){ return r.json(); })
      .then(function(j){ console.log('[sheet]', j); })
      .catch(function(e){ console.warn('[sheet] post failed', e); });
  }

  if (GRAYLOG_ENDPOINT) {
    var gelf = {
      version: '1.1',
      host: GRAYLOG_HOST,
      short_message: 'tiktok live scrape: ' + (shop || 'unknown') + ' (' + products.length + ' products, gmv=' + (gmv || '?') + ')',
      timestamp: Math.floor(Date.now() / 1000),
      _page:                 payload.page,
      _shop:                 payload.shop,
      _room_id:              payload.roomId,
      _duration:             payload.duration,
      _session_range:        payload.sessionRange,
      _scrapedAt:            payload.scrapedAt,
      _gmv:                  payload.gmv,
      _side_kpis_json:       JSON.stringify(payload.sideKpis),
      _performance_count:    payload.performance.length,
      _performance_json:     JSON.stringify(payload.performance),
      _traffic_count:        payload.trafficSources.length,
      _traffic_sources_json: JSON.stringify(payload.trafficSources),
      _products_count:       payload.products.length,
      _products_json:        JSON.stringify(payload.products),
      _graylog_key:          GRAYLOG_TOKEN
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
