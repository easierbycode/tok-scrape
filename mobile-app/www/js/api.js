// Graylog REST API client.
//
// Auth: Graylog access tokens are sent as HTTP Basic auth where the username
// is the token and the password is the literal string "token".
// See: https://docs.graylog.org/docs/rest-api#access-tokens
//
// We use the Universal Search "relative" endpoint because it's the simplest
// way to pull recent messages with optional Lucene filter and field whitelist:
//   GET /api/search/universal/relative
//     ?query=<lucene>
//     &range=<seconds>      (0 = all time, but use a large number to be safe)
//     &fields=<csv>
//     &limit=<int>
//     &sort=timestamp:desc
//
// Response shape (abridged):
//   { messages: [ { message: { creator, scrapedAt, metrics_json, ... }, index } ],
//     total_results: <int>, ... }

(function (global) {
  'use strict';

  // AND `base` with a creator filter built from a single handle or an array
  // of handles. An array becomes an OR-joined disjunction so a multi-creator
  // scope returns scrapes from any listed handle. Empty / null skips the AND.
  //
  // Each handle expands to (creator:"@h" OR creator.keyword:"@h"). We need
  // both forms because Graylog's default mapping makes `creator` a text field
  // with a `.keyword` sub-field: handles that contain a `.` (e.g.
  // "@prettyplug.x") are tokenized as ["prettyplug", "x"] under the standard
  // analyzer, and a phrase query against the analyzed field is unreliable for
  // those handles. The `.keyword` clause does an exact-string match, which
  // works regardless of analyzer; if the sub-field doesn't exist on a given
  // index the clause simply matches nothing and the analyzed clause carries
  // the load. Single-token handles (e.g. "@wizardofdealz") match both
  // clauses, so OR'ing is harmless.
  function applyCreatorFilter(base, filter) {
    var handles;
    if (Array.isArray(filter))   handles = filter.filter(Boolean);
    else if (filter)             handles = [filter];
    else                         handles = [];
    if (!handles.length) return base;
    var clauses = handles.map(function (h) {
      var safe = String(h).replace(/"/g, '\\"');
      return '(creator:"' + safe + '" OR creator.keyword:"' + safe + '")';
    });
    var joined = clauses.length === 1 ? clauses[0] : '(' + clauses.join(' OR ') + ')';
    return '(' + base + ') AND ' + joined;
  }

  function GraylogClient(opts) {
    this.baseUrl = (opts.baseUrl || '').replace(/\/+$/, '');
    this.token   = opts.token || '';
  }

  GraylogClient.prototype._headers = function () {
    var auth = btoa(this.token + ':token');
    return {
      'Authorization':       'Basic ' + auth,
      'Accept':              'application/json',
      'X-Requested-By':      'tok-scrape-mobile' // Graylog rejects state-changing requests without this; harmless for GETs.
    };
  };

  // Mint a Graylog UI session cookie so the WebView can load the dashboard
  // page (e.g. /dashboards/<id>) without a separate username/password prompt.
  // Graylog accepts the API token in the same Basic auth slot as a username,
  // and `POST /api/system/sessions` returns a session_id that the browser
  // stores and replays on subsequent navigations to the same origin.
  // We rely on the response setting a Set-Cookie header (default behaviour);
  // `credentials: 'include'` is mandatory for the cookie to stick.
  GraylogClient.prototype.establishSession = function () {
    if (!this.baseUrl) return Promise.reject(new Error('Graylog URL not set'));
    if (!this.token)   return Promise.reject(new Error('Graylog API token not set'));
    var url = this.baseUrl + '/api/system/sessions';
    var body = JSON.stringify({ username: this.token, password: 'token', host: '' });
    var headers = this._headers();
    headers['Content-Type'] = 'application/json';
    return fetch(url, { method: 'POST', headers: headers, body: body, credentials: 'include' })
      .then(function (r) {
        if (!r.ok && r.status !== 200 && r.status !== 201) {
          return r.text().then(function (t) {
            var err = new Error('Graylog session ' + r.status + ': ' + (t || r.statusText));
            err.status = r.status;
            throw err;
          });
        }
        // Best-effort: response body has { session_id, valid_until } but the
        // cookie is what the WebView actually needs.
        return r.json().catch(function () { return {}; });
      });
  };

  GraylogClient.prototype.search = function (query, rangeSeconds, fields, limit) {
    if (!this.baseUrl) return Promise.reject(new Error('Graylog URL not set'));
    if (!this.token)   return Promise.reject(new Error('Graylog API token not set'));

    var range = rangeSeconds && rangeSeconds > 0 ? rangeSeconds : (5 * 365 * 24 * 3600); // ~5 years for "all time"
    var params = new URLSearchParams({
      query:  query || '*',
      range:  String(range),
      limit:  String(limit || 500),
      sort:   'timestamp:desc'
    });
    if (fields && fields.length) params.set('fields', fields.join(','));

    var url = this.baseUrl + '/api/search/universal/relative?' + params.toString();
    return fetch(url, { method: 'GET', headers: this._headers(), credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var err = new Error('Graylog ' + r.status + ': ' + (t || r.statusText));
            err.status = r.status;
            throw err;
          });
        }
        return r.json();
      });
  };

  // Convenience: pull bookmarklet scrapes and parse the JSON-stringified arrays
  // back into native objects.
  //
  // Args:
  //   lucene        - base Lucene query (usually the "source filter" from
  //                   Settings, e.g. source:tiktok-bookmarklet). Note: the
  //                   bookmarklet sends GELF `host: tiktok-bookmarklet`, which
  //                   Graylog indexes as the `source` field — there is no
  //                   `host` field on the stored message, so `source:` is
  //                   what matches.
  //   rangeSeconds  - relative time window
  //   creatorFilter - optional creator handle (e.g. "@wizardofdealz") or array
  //                   of handles. When set, the query is AND'd with
  //                   `creator:"<h>"` (or an OR-joined disjunction) so the
  //                   results are scoped to the listed creators.
  GraylogClient.prototype.fetchScrapes = function (lucene, rangeSeconds, creatorFilter) {
    var fields = [
      'creator', 'scrapedAt', 'date_start', 'date_end',
      'metrics_count', 'videos_count', 'metrics_json', 'videos_json'
    ];
    var base = lucene || 'source:tiktok-bookmarklet';
    var query = applyCreatorFilter(base, creatorFilter);
    return this.search(query, rangeSeconds, fields, 500)
      .then(function (resp) {
        var msgs = (resp && resp.messages) || [];
        return msgs.map(function (entry) {
          var m = entry.message || {};
          var scrape = {
            timestamp:    m.timestamp || m.scrapedAt || null,
            creator:      m.creator || '',
            scrapedAt:    m.scrapedAt || m.timestamp || '',
            dateStart:    m.date_start || '',
            dateEnd:      m.date_end || '',
            videosCount:  Number(m.videos_count || 0),
            metricsCount: Number(m.metrics_count || 0),
            metrics:      [],
            videos:       []
          };
          if (m.metrics_json) {
            try { scrape.metrics = JSON.parse(m.metrics_json) || []; }
            catch (e) { scrape.metrics = []; scrape._metricsParseError = e.message; }
          }
          if (m.videos_json) {
            try { scrape.videos = JSON.parse(m.videos_json) || []; }
            catch (e) { scrape.videos = []; scrape._videosParseError = e.message; }
          }
          return scrape;
        });
      });
  };

  // Convenience: pull livestream-analytics scrapes (seller-side LIVE Dashboard
  // dump from extension-seller/scrape-analytics.js). The host/source is
  // `tiktok-bookmarklet-livestream-analytics` and the schema is different from
  // creator scrapes — instead of metrics_json / videos_json there's
  // sections_json / core_data_json / livestreams_json.
  GraylogClient.prototype.fetchLiveAnalytics = function (rangeSeconds, creatorFilter) {
    var fields = [
      'creator', 'scrapedAt', 'sections_count', 'metrics_count', 'rows_count',
      'sections_json', 'core_data_json', 'livestreams_json'
    ];
    var base = 'source:tiktok-bookmarklet-livestream-analytics';
    var query = applyCreatorFilter(base, creatorFilter);
    return this.search(query, rangeSeconds, fields, 500)
      .then(function (resp) {
        var msgs = (resp && resp.messages) || [];
        return msgs.map(function (entry) {
          var m = entry.message || {};
          var scrape = {
            timestamp:   m.timestamp || m.scrapedAt || null,
            creator:     m.creator || '',
            scrapedAt:   m.scrapedAt || m.timestamp || '',
            coreData:    null,
            livestreams: null,
            sections:    []
          };
          if (m.core_data_json) {
            try { scrape.coreData = JSON.parse(m.core_data_json); }
            catch (e) { scrape._coreDataParseError = e.message; }
          }
          if (m.livestreams_json) {
            try { scrape.livestreams = JSON.parse(m.livestreams_json); }
            catch (e) { scrape._livestreamsParseError = e.message; }
          }
          if (m.sections_json) {
            try { scrape.sections = JSON.parse(m.sections_json) || []; }
            catch (e) { scrape.sections = []; scrape._sectionsParseError = e.message; }
          }
          return scrape;
        });
      });
  };

  // Pull seller-side Compass "Data Overview" snapshots
  // (source:tiktok-bookmarklet-data-overview). Each scrape is a single page
  // capture — KPI tiles plus an optional recent-livestreams table. Returned
  // newest-first so the renderer can pick scrapes[0] for "latest".
  GraylogClient.prototype.fetchDataOverview = function (rangeSeconds, creatorFilter) {
    var fields = [
      'creator', 'page', 'scrapedAt',
      'date_label', 'date_start', 'date_end',
      'metrics_count', 'metrics_json',
      'recent_livestreams_count', 'recent_livestreams_json'
    ];
    var base  = 'source:tiktok-bookmarklet-data-overview';
    var query = applyCreatorFilter(base, creatorFilter);
    return this.search(query, rangeSeconds, fields, 200)
      .then(function (resp) {
        var msgs = (resp && resp.messages) || [];
        return msgs.map(function (entry) {
          var m = entry.message || {};
          var scrape = {
            timestamp:  m.timestamp || m.scrapedAt || null,
            creator:    m.creator   || '',
            page:       m.page      || '',
            scrapedAt:  m.scrapedAt || m.timestamp || '',
            dateLabel:  m.date_label || '',
            dateStart:  m.date_start || '',
            dateEnd:    m.date_end   || '',
            metrics:    [],
            recentLivestreams: null
          };
          if (m.metrics_json) {
            try { scrape.metrics = JSON.parse(m.metrics_json) || []; }
            catch (e) { scrape.metrics = []; scrape._metricsParseError = e.message; }
          }
          if (m.recent_livestreams_json) {
            try { scrape.recentLivestreams = JSON.parse(m.recent_livestreams_json); }
            catch (e) { scrape._recentLivestreamsParseError = e.message; }
          }
          return scrape;
        });
      });
  };

  // Pull affiliate-export rows ingested via "Add Exported Data" (xlsx upload).
  // Source: tiktok-affiliate-export (one GELF message per order row). Returns
  // an array of order objects with the same keys we send up in postGelf below.
  GraylogClient.prototype.fetchAffiliateOrders = function (rangeSeconds, creatorFilter) {
    var fields = [
      'creator', 'agency', 'order_id', 'product_id', 'product_name',
      'content_type', 'content_id', 'currency',
      'price_num', 'gmv_num', 'items_sold_num', 'items_refunded_num',
      'est_commission_num', 'actual_commission_num',
      'order_date', 'order_date_iso', 'shop_name', 'order_settlement_status',
      'standard_rate'
    ];
    var base  = 'source:tiktok-affiliate-export';
    var query = applyCreatorFilter(base, creatorFilter);
    return this.search(query, rangeSeconds, fields, 1000)
      .then(function (resp) {
        var msgs = (resp && resp.messages) || [];
        return msgs.map(function (entry) {
          var m = entry.message || {};
          return {
            timestamp:        m.timestamp || m.order_date_iso || null,
            creator:          m.creator || m.agency || '',
            agency:           m.agency || '',
            orderId:          m.order_id || '',
            productId:        m.product_id || '',
            productName:      m.product_name || '',
            contentType:      m.content_type || '',
            contentId:        m.content_id || '',
            currency:         m.currency || '',
            price:            num(m.price_num),
            gmv:              num(m.gmv_num),
            itemsSold:        num(m.items_sold_num),
            itemsRefunded:    num(m.items_refunded_num),
            estCommission:    num(m.est_commission_num),
            actualCommission: num(m.actual_commission_num),
            orderDate:        m.order_date || '',
            orderDateIso:     m.order_date_iso || '',
            shopName:         m.shop_name || '',
            settlement:       m.order_settlement_status || '',
            standardRate:     m.standard_rate || ''
          };
        });
      });
  };

  function num(v) {
    if (v == null || v === '') return NaN;
    var n = Number(v);
    return isNaN(n) ? NaN : n;
  }

  // Push a single GELF v1.1 payload to a Graylog HTTP GELF input. The mobile
  // app uses this to ingest the per-order rows from "Add Exported Data" — it's
  // intentionally separate from the read path (REST API + token auth), since
  // the GELF endpoint typically lives on its own host (see config.js in the
  // browser extensions). The endpoint expects Content-Type: application/json.
  function postGelf(gelfEndpoint, payload) {
    if (!gelfEndpoint) return Promise.reject(new Error('GELF endpoint not configured'));
    return fetch(gelfEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit'
    }).then(function (r) {
      // GELF HTTP returns 202 Accepted with empty body on success. Drain the
      // body so the WebView doesn't surface a spurious net::ERR_ABORTED.
      return r.text().then(function (t) {
        if (!r.ok && r.status !== 202) {
          var err = new Error('GELF ' + r.status + ': ' + (t || r.statusText));
          err.status = r.status;
          throw err;
        }
        return { ok: true, status: r.status };
      });
    });
  }

  global.postGelf = postGelf;

  // Pull the unique set of `creator` handles observed across every known
  // bookmarklet/scraper source. Used to populate the user/login roster.
  // The list must mirror ALL_SOURCES_LUCENE in scripts/build-preloaded.js —
  // a creator that only appears in (say) data-overview must still light up
  // in the picker, otherwise the dashboard claims "no data" for them when
  // there's data sitting one source over.
  GraylogClient.prototype.fetchCreators = function (lucene, rangeSeconds) {
    var range = rangeSeconds && rangeSeconds > 0 ? rangeSeconds : (5 * 365 * 24 * 3600);
    var base = lucene || 'source:tiktok-bookmarklet';
    var extras = [
      'source:tiktok-bookmarklet-streamer',
      'source:tiktok-bookmarklet-livestream-analytics',
      'source:tiktok-bookmarklet-data-overview',
      'source:tiktok-affiliate-export'
    ];
    var query = '(' + base + ') OR ' + extras.join(' OR ');
    return this.search(query, range, ['creator'], 1000)
      .then(function (resp) {
        var msgs = (resp && resp.messages) || [];
        var seen = Object.create(null);
        msgs.forEach(function (entry) {
          var c = entry.message && entry.message.creator;
          if (c) seen[c] = true;
        });
        return Object.keys(seen).sort();
      });
  };

  global.GraylogClient = GraylogClient;
})(window);
