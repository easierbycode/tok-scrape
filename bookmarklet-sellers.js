(function(){
  // ---- Local Graylog GELF HTTP input (set to '' to disable) ----
  // Graylog-only — by design. The sellers payload doesn't fit the Apps
  // Script Sheet schema (which is creator/video oriented), so this
  // bookmarklet skips the Sheets POST and only ships to Graylog.
  // The `bookmarklet-sync` sidecar in docker-compose.yml rewrites
  // GRAYLOG_ENDPOINT (ngrok public URL of the :12202 GELF tunnel) and
  // GRAYLOG_TOKEN (admin API token) on every `docker compose up`.
  var GRAYLOG_ENDPOINT = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
  var GRAYLOG_TOKEN    = '9dipsuq5er4puc1eikb9gcvq1msgelf8565caotiqpeh1hf7jeq';
  // Distinct source so Graylog can route this stream separately from the
  // creator/video bookmarklet (`tiktok-bookmarklet`).
  var GRAYLOG_HOST     = 'tiktok-bookmarklet-sellers';
  // ----------------------------------------------------------------

  // Targets the Partner Collabs Agency Detail page:
  //   partner.us.tiktokshop.com/affiliate-campaign/partner-collabs/agency/detail?campaign_id=...
  // Each row pairs a product row with the seller (shop) that registered it.

  var clean = function(s){ return (s || '').replace(/\s+/g, ' ').trim(); };

  var pageTitleEl = document.querySelector('.text-head-l');
  var pageTitle = pageTitleEl ? clean(pageTitleEl.textContent) : '';

  var campaignId = '';
  var cm = location.href.match(/[?&]campaign_id=(\d+)/);
  if (cm) campaignId = cm[1];

  // The page nests two `.arco-tabs` groups — an outer one with
  // "Collaboration info" / "Performance", and an inner one with the
  // product-status tabs (Pending, Approved, Rejected, Pending closed,
  // Closed). We want the inner group only. The Pending span and its count
  // span both render inside the title-text element with no whitespace
  // between them, so textContent yields "Pending8" — strip the count.
  var STATUS_RE = /^(Pending closed|Pending|Approved|Rejected|Closed)$/;
  var labelOf = function(t){
    var countEl = t.querySelector('.tab-value');
    var countText = countEl ? clean(countEl.textContent) : '';
    var full = clean(t.textContent);
    var label = full;
    if (countText) {
      var i = label.lastIndexOf(countText);
      if (i >= 0) label = label.slice(0, i).trim();
    }
    return { label: label, count: countText };
  };

  var statusTabs = [];
  document.querySelectorAll('.arco-tabs-header-title .arco-tabs-header-title-text').forEach(function(t){
    var lc = labelOf(t);
    if (!STATUS_RE.test(lc.label)) return;
    statusTabs.push(lc);
  });
  var activeStatus = '';
  var activeCount  = '';
  document.querySelectorAll('.arco-tabs-header-title-active .arco-tabs-header-title-text').forEach(function(t){
    if (activeStatus) return;
    var lc = labelOf(t);
    if (STATUS_RE.test(lc.label)) {
      activeStatus = lc.label;
      activeCount  = lc.count;
    }
  });

  var get = function(td){
    if (!td) return '';
    var inner = td.querySelector('.arco-table-cell-wrap-value');
    if (!inner) return '';
    // Multi-paragraph cells (e.g. commission rate w/ "vs. open collab" line)
    // render as sibling <p>s with no whitespace between them — joining via
    // textContent collapses to "40%vs. open collab 20%". Split + rejoin.
    var ps = inner.querySelectorAll('p');
    if (ps.length > 1) {
      var parts = [];
      ps.forEach(function(p){ var s = clean(p.textContent); if (s) parts.push(s); });
      if (parts.length) return parts.join(' / ');
    }
    return clean(inner.textContent);
  };

  var sellers = [];
  var rows = document.querySelectorAll('tbody tr.arco-table-tr');
  rows.forEach(function(row){
    var checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox) return; // skip header rows / no-data rows

    // td.arco-table-td order (the shop-info <td> has no `arco-table-td`
    // class on the outer element so it's excluded — we read it separately):
    //   [0] checkbox
    //   [1] product
    //   [2] date registered
    //   [3] total commission rate
    //   [4] total shop ads commission rate
    //   [5] sale price
    //   [6] stock
    //   [7] available samples
    //   [8] items sold
    //   [9] product rating
    //   [10] actions (right-fixed)
    var tds = row.querySelectorAll('td.arco-table-td');

    var productId = checkbox.value || '';
    var productNameEl = tds[1] && tds[1].querySelector('.arco-typography[title]');
    var productName = productNameEl
      ? clean(productNameEl.getAttribute('title') || productNameEl.textContent)
      : '';

    if (!productId && tds[1]) {
      var idEl = tds[1].querySelector('.text-body-s-regular');
      var im = idEl && idEl.textContent.match(/ID:\s*(\S+)/);
      if (im) productId = im[1];
    }

    var ratingValueEl = tds[9] && tds[9].querySelector('.text-body-m-regular');
    var ratingValue = ratingValueEl ? clean(ratingValueEl.textContent) : '';
    var reviewCountEl = tds[9] && tds[9].querySelector('.text-body-s-regular');
    var reviewCount = reviewCountEl ? clean(reviewCountEl.textContent) : '';

    // Shop info column lives in a sibling <td id="shop-info-wrapper"> that
    // sits between the regular cells and the right-fixed actions cell, but
    // doesn't carry the `arco-table-td` class on its outer element.
    var shopWrap = row.querySelector('#shop-info-wrapper, .shop-info-td');
    var shopName = '', shopRating = '', shopEmail = '', shopCode = '';
    if (shopWrap) {
      var nameEl = shopWrap.querySelector('.arco-typography');
      shopName = nameEl ? clean(nameEl.textContent) : '';

      var ratingEl = shopWrap.querySelector('.font-semibold.ml-2');
      shopRating = ratingEl ? clean(ratingEl.textContent) : '';

      var emailEls = shopWrap.querySelectorAll('.arco-typography');
      // Index [0] = shop name, [1] = email (truncated typography).
      shopEmail = emailEls[1] ? clean(emailEls[1].textContent) : '';

      var codeWrap = shopWrap.querySelector('.shop_code');
      if (codeWrap) {
        shopCode = clean(codeWrap.textContent.replace(/^\s*Shop code:\s*/, ''));
      }
    }

    sellers.push({
      'Product ID':                     productId,
      'Product name':                   productName,
      'Date registered':                tds[2] ? get(tds[2]) : '',
      'Total commission rate':          tds[3] ? get(tds[3]) : '',
      'Total Shop Ads commission rate': tds[4] ? get(tds[4]) : '',
      'Sale price':                     tds[5] ? get(tds[5]) : '',
      'Stock':                          tds[6] ? get(tds[6]) : '',
      'Available samples':              tds[7] ? get(tds[7]) : '',
      'Items sold':                     tds[8] ? get(tds[8]) : '',
      'Product rating':                 ratingValue,
      'Reviews':                        reviewCount,
      'Shop name':                      shopName,
      'Shop rating':                    shopRating,
      'Shop email':                     shopEmail,
      'Shop code':                      shopCode,
      'Status':                         activeStatus
    });
  });

  var payload = {
    page:        pageTitle,
    campaignId:  campaignId,
    status:      activeStatus,
    statusCount: activeCount,
    statusTabs:  statusTabs,
    scrapedAt:   new Date().toISOString(),
    sellers:     sellers
  };
  console.log(payload);

  // Post to local Graylog GELF HTTP input (if configured).
  if (GRAYLOG_ENDPOINT) {
    var gelf = {
      version: '1.1',
      host: GRAYLOG_HOST,
      short_message: 'tiktok seller scrape: ' + (activeStatus || pageTitle || 'unknown') + ' (' + sellers.length + ' sellers)',
      timestamp: Math.floor(Date.now() / 1000),
      _page:          payload.page,
      _campaign_id:   payload.campaignId,
      _status:        payload.status,
      _status_count:  payload.statusCount,
      _scrapedAt:     payload.scrapedAt,
      _tabs_count:    statusTabs.length,
      _tabs_json:     JSON.stringify(statusTabs),
      _sellers_count: sellers.length,
      _sellers_json:  JSON.stringify(sellers),
      _graylog_key:   GRAYLOG_TOKEN
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
