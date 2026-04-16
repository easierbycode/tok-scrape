// tok-scrape PWA shell: service worker registration, tab routing,
// bookmarklet generation (endpoint/token/graylog editable & saved locally).

(function () {
  'use strict';

  // ---- Defaults mirror metrics-bookmarklet.html ---------------------------
  var DEFAULTS = {
    endpoint: 'https://script.google.com/macros/s/AKfycbzRGJMcZGvdRsAd9UHHATRG5ilpeh4JHCZ11ye5CMhHbs4LulaYJJsnndw8I2NfgvdG/exec',
    token:    '**dingleding&&',
    graylog:  'http://localhost:12202/gelf'
  };
  var STORAGE_KEY = 'tok-scrape-config';
  var BUILD_ID = 'v1';

  // ---- Bookmarklet body ---------------------------------------------------
  // Kept in sync with metrics-bookmarklet.html. ENDPOINT / TOKEN / GRAYLOG_ENDPOINT
  // are injected as JSON-encoded literals at generation time so users can
  // personalise them from the Setup tab.
  function bookmarkletBody(ENDPOINT, TOKEN, GRAYLOG_ENDPOINT) {
    var UP = 'M2.97731 0.130983C3.11029 -0.0430998 3.37217 -0.0437687 3.50604 0.129632L6.44523 3.93668C6.6144 4.15581 6.45821 4.47372 6.18138 4.47372H4.60189V8.33326C4.60189 8.51735 4.45265 8.66659 4.26855 8.66659H2.26855C2.08446 8.66659 1.93522 8.51735 1.93522 8.33326V4.47372H0.333945C0.057903 4.47372 -0.0985142 4.15739 0.0690572 3.93803L2.97731 0.130983Z';
    var items = document.querySelectorAll('.arco-space-item');
    var metricsRoot = items[2];
    if (!metricsRoot) { console.warn('Key metrics container not found'); return; }

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
      var k = c.querySelector('.text-14'), v = c.querySelector('.text-20');
      if (!k || !v) return;
      var row = v.nextElementSibling,
          p = row && row.querySelector('svg path'),
          pct = row && row.querySelector('span');
      var dir = p && p.getAttribute('d') === UP ? '\u2191' : '\u2193';
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
        var infoCol = linkParent.parentElement;
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
      creator: creator,
      scrapedAt: new Date().toISOString(),
      dateRange: dateRange,
      metrics: metrics,
      videos: videos
    };
    console.log(payload);

    if (ENDPOINT && ENDPOINT.indexOf('PASTE_') !== 0) {
      fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          token:     TOKEN,
          creator:   payload.creator,
          scrapedAt: payload.scrapedAt,
          dateRange: payload.dateRange,
          metrics:   payload.metrics,
          videos:    payload.videos
        })
      }).then(function (r) { return r.json(); })
        .then(function (j) { console.log('[sheet]', j); })
        .catch(function (e) { console.warn('[sheet] post failed', e); });
    }

    if (GRAYLOG_ENDPOINT) {
      fetch(GRAYLOG_ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: '1.1',
          host: location.hostname || 'tok-scrape',
          short_message: 'tok-scrape ' + (payload.creator || 'unknown') + ': ' +
            payload.metrics.length + ' metrics, ' + payload.videos.length + ' videos',
          timestamp: Date.now() / 1000,
          level: 6,
          _creator: payload.creator,
          _scraped_at: payload.scrapedAt,
          _date_start: payload.dateRange.start,
          _date_end: payload.dateRange.end,
          _metrics_count: payload.metrics.length,
          _videos_count: payload.videos.length
        })
      }).then(function (r) { console.log('[graylog]', r.status); })
        .catch(function (e) { console.warn('[graylog] post failed', e); });
    }
  }

  // ---- Build a javascript: URL from the body above ------------------------
  function buildBookmarkletUrl(cfg) {
    var body = bookmarkletBody.toString();
    // Strip "function bookmarkletBody(ENDPOINT, TOKEN, GRAYLOG_ENDPOINT) {" header
    // and the trailing "}" so we can wrap it in our own IIFE with literal values.
    var inner = body.slice(body.indexOf('{') + 1, body.lastIndexOf('}'));
    var literals =
      'var ENDPOINT = ' + JSON.stringify(cfg.endpoint || '') + ';\n' +
      'var TOKEN = ' + JSON.stringify(cfg.token || '') + ';\n' +
      'var GRAYLOG_ENDPOINT = ' + JSON.stringify(cfg.graylog || '') + ';\n';
    var iife = '(function(){' + literals + inner + '})();';
    return 'javascript:' + encodeURIComponent(iife);
  }

  // ---- Config load/save ---------------------------------------------------
  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var cfg = JSON.parse(raw);
      return {
        endpoint: cfg.endpoint != null ? cfg.endpoint : DEFAULTS.endpoint,
        token:    cfg.token    != null ? cfg.token    : DEFAULTS.token,
        graylog:  cfg.graylog  != null ? cfg.graylog  : DEFAULTS.graylog
      };
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  // ---- UI wiring ----------------------------------------------------------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function activateTab(name) {
    $$('nav.tabs button[role="tab"]').forEach(function (btn) {
      var selected = btn.id === 'tab-' + name;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    $$('section[role="tabpanel"]').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + name);
    });
  }

  function refreshBookmarklet(cfg) {
    var url = buildBookmarkletUrl(cfg);
    var link = $('#bookmarklet');
    if (link) link.setAttribute('href', url);
    var preview = $('#bookmarklet-preview');
    if (preview) {
      var decoded = decodeURIComponent(url.replace(/^javascript:/, ''));
      preview.textContent = decoded;
    }
    return url;
  }

  function wireTabs() {
    $$('nav.tabs button[role="tab"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.id.replace('tab-', ''));
      });
    });
    $$('a[data-tab]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        activateTab(a.getAttribute('data-tab'));
      });
    });
  }

  function wireSetup(cfg) {
    $('#endpoint').value = cfg.endpoint;
    $('#token').value = cfg.token;
    $('#graylog').value = cfg.graylog;

    $('#generate-btn').addEventListener('click', function () {
      cfg.endpoint = $('#endpoint').value.trim();
      cfg.token    = $('#token').value;
      cfg.graylog  = $('#graylog').value.trim();
      saveConfig(cfg);
      refreshBookmarklet(cfg);
      activateTab('install');
    });

    $('#reset-btn').addEventListener('click', function () {
      cfg.endpoint = DEFAULTS.endpoint;
      cfg.token    = DEFAULTS.token;
      cfg.graylog  = DEFAULTS.graylog;
      saveConfig(cfg);
      $('#endpoint').value = cfg.endpoint;
      $('#token').value    = cfg.token;
      $('#graylog').value  = cfg.graylog;
      refreshBookmarklet(cfg);
    });

    $('#copy-btn').addEventListener('click', async function () {
      var url = refreshBookmarklet(cfg);
      try {
        await navigator.clipboard.writeText(url);
        $('#copy-btn').textContent = 'Copied!';
        setTimeout(function () { $('#copy-btn').textContent = 'Copy javascript: URL'; }, 1500);
      } catch (e) {
        alert('Clipboard blocked. The URL is shown in the preview below.');
      }
    });
  }

  // ---- Install prompt / share --------------------------------------------
  var deferredPrompt = null;
  function wireInstall() {
    var btn = $('#install-btn');
    var state = $('#install-state');

    // iOS Safari doesn't fire beforeinstallprompt; detect standalone fallback.
    var standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) {
      btn.disabled = true;
      btn.textContent = 'Installed';
      state.textContent = 'installed';
      return;
    }

    state.textContent = 'waiting for browser';

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.disabled = false;
      state.textContent = 'ready to install';
    });

    btn.addEventListener('click', async function () {
      if (!deferredPrompt) {
        alert('Use your browser menu: "Add to Home Screen" (iOS) or "Install app" (Chrome/Edge).');
        return;
      }
      deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      state.textContent = choice.outcome === 'accepted' ? 'installed' : 'dismissed';
      deferredPrompt = null;
      btn.disabled = true;
    });

    window.addEventListener('appinstalled', function () {
      state.textContent = 'installed';
      btn.disabled = true;
      btn.textContent = 'Installed';
    });

    $('#share-btn').addEventListener('click', async function () {
      var data = {
        title: 'tok-scrape',
        text: 'Installable TikTok Shop Key Metrics bookmarklet.',
        url: location.href
      };
      if (navigator.share) {
        try { await navigator.share(data); } catch (e) { /* user cancelled */ }
      } else if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(location.href);
          $('#share-btn').textContent = 'Link copied';
          setTimeout(function () { $('#share-btn').textContent = 'Share'; }, 1500);
        } catch (e) {
          alert(location.href);
        }
      } else {
        alert(location.href);
      }
    });
  }

  // ---- Offline banner -----------------------------------------------------
  function wireOffline() {
    function sync() { document.body.classList.toggle('offline', !navigator.onLine); }
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  // ---- Service worker -----------------------------------------------------
  function wireServiceWorker() {
    var status = $('#sw-status');
    var clearBtn = $('#clear-cache');

    if (!('serviceWorker' in navigator)) {
      status.textContent = 'service worker: unsupported';
      clearBtn.disabled = true;
      return;
    }

    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      status.textContent = 'service worker: registered';
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            status.textContent = 'service worker: update available (reload)';
          }
        });
      });
    }).catch(function (err) {
      status.textContent = 'service worker: failed';
      console.warn('SW registration failed', err);
    });

    clearBtn.addEventListener('click', async function () {
      if (!('caches' in window)) return;
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
      status.textContent = 'service worker: cleared (reload to reinstall)';
    });
  }

  // ---- Boot ---------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var cfg = loadConfig();
    wireTabs();
    wireSetup(cfg);
    wireInstall();
    wireOffline();
    wireServiceWorker();
    refreshBookmarklet(cfg);
    var build = document.getElementById('build-id');
    if (build) build.textContent = BUILD_ID;
  });
})();
