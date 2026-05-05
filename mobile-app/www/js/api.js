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
  //   creatorFilter - optional creator handle (e.g. "@wizardofdealz"). When
  //                   set, the query is AND'd with creator:"<handle>" so a
  //                   member only sees their own data.
  GraylogClient.prototype.fetchScrapes = function (lucene, rangeSeconds, creatorFilter) {
    var fields = [
      'creator', 'scrapedAt', 'date_start', 'date_end',
      'metrics_count', 'videos_count', 'metrics_json', 'videos_json'
    ];
    var base = lucene || 'source:tiktok-bookmarklet';
    var query = base;
    if (creatorFilter) {
      // Quote the handle so the "@" + any punctuation is treated literally.
      // Escape embedded double-quotes just in case.
      var safe = String(creatorFilter).replace(/"/g, '\\"');
      query = '(' + base + ') AND creator:"' + safe + '"';
    }
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
    var query = base;
    if (creatorFilter) {
      var safe = String(creatorFilter).replace(/"/g, '\\"');
      query = '(' + base + ') AND creator:"' + safe + '"';
    }
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

  // Pull the unique set of `creator` handles observed across both the video
  // bookmarklet source (configurable via Settings.query) and the seller-side
  // livestream-analytics source. Used to populate the user/login roster.
  GraylogClient.prototype.fetchCreators = function (lucene, rangeSeconds) {
    var range = rangeSeconds && rangeSeconds > 0 ? rangeSeconds : (5 * 365 * 24 * 3600);
    var base = lucene || 'source:tiktok-bookmarklet';
    var query = '(' + base + ') OR source:tiktok-bookmarklet-livestream-analytics';
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
