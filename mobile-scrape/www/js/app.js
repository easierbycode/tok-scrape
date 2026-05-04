(function () {
  'use strict';

  var TARGETS = {
    creator: {
      url: 'https://partner.us.tiktokshop.com/compass/video-analysis',
      label: 'Creator',
    },
    sellers: {
      url: 'https://partner.us.tiktokshop.com/affiliate-campaign/partner-collabs',
      label: 'Sellers',
    },
    live: {
      url: 'https://shop.tiktok.com/workbench/live/overview',
      label: 'Live',
    },
    streamer: {
      url: 'https://shop.tiktok.com/streamer/compass/video-analysis/view',
      label: 'Streamer',
    },
  };

  // Desktop UA is configured via the OverrideUserAgent Cordova preference in
  // config.xml — NOT here. cordova-plugin-inappbrowser 6.0.0's parseFeature
  // splits the options string on `,`, then on `=`, so any value containing a
  // comma (every realistic desktop UA does) throws NoSuchElementException
  // before the IAB window opens.
  var cordovaReady = false;
  var statusEl = null;

  document.addEventListener('deviceready', function () {
    cordovaReady = true;
    log('deviceready (cordova ' + (window.cordova && cordova.version) +
        ', InAppBrowser ' + (window.cordova && cordova.InAppBrowser ? 'ok' : 'MISSING') + ')');
  }, false);

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    statusEl = document.getElementById('status');
    Array.prototype.forEach.call(document.querySelectorAll('.card[data-target]'), function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-target');
        log('tap ' + target);
        openTarget(target);
      });
    });
    log('boot — cordova=' + !!window.cordova + ' IAB=' + !!(window.cordova && cordova.InAppBrowser));
  }

  function log(msg) {
    try { console.log('[tok-scrape]', msg); } catch (_) {}
    if (statusEl) {
      var line = document.createElement('div');
      line.textContent = msg;
      statusEl.appendChild(line);
      while (statusEl.children.length > 14) statusEl.removeChild(statusEl.firstChild);
    }
  }

  function openTarget(target) {
    var entry = TARGETS[target];
    if (!entry) return;

    var payload = (window.PAYLOADS || {})[target];
    if (!payload) {
      log('payload missing for ' + target);
      alert('Bookmarklet payload missing for "' + target + '". Run `npm run sync`.');
      return;
    }

    if (!window.cordova || !cordova.InAppBrowser) {
      log('IAB unavailable — cordova=' + !!window.cordova);
      alert('Cordova InAppBrowser not loaded yet. Wait a moment and tap again.');
      return;
    }

    var opts = [
      'location=yes',
      'toolbar=yes',
      'hardwareback=yes',
      'clearcache=no',
      'clearsessioncache=no',
      'zoom=no',
    ].join(',');

    log('opening ' + entry.url);
    var ref;
    try {
      ref = cordova.InAppBrowser.open(entry.url, '_blank', opts);
    } catch (e) {
      log('IAB.open threw: ' + (e && e.message || e));
      alert('IAB.open threw: ' + (e && e.message || e));
      return;
    }
    if (!ref) {
      log('IAB.open returned null/undefined');
      alert('IAB.open returned no reference.');
      return;
    }

    var sawLoadstart = false;
    ref.addEventListener('loadstart', function (e) {
      sawLoadstart = true;
      log('loadstart ' + (e && e.url || ''));
    });
    ref.addEventListener('loadstop', function (e) {
      log('loadstop ' + (e && e.url || ''));
      injectFab(ref, target, payload);
    });
    ref.addEventListener('loaderror', function (e) {
      log('loaderror ' + (e && (e.message || e.url) || ''));
    });
    ref.addEventListener('exit', function () {
      log('exit ' + target);
    });
    ref.addEventListener('message', function (event) {
      handleIabMessage(ref, event && event.data);
    });
    setTimeout(function () {
      if (!sawLoadstart) log('watchdog: no loadstart in 3s for ' + target);
    }, 3000);
  }

  // Bridges fetch requests from the IAB (where the page CSP blocks Sheets /
  // Graylog hosts) to the launcher webview, which has connect-src *.
  function handleIabMessage(ref, data) {
    if (!data || data.kind !== 'tok-scrape-fetch') return;
    var id = data.id;
    // text/plain for both: Sheets accepts it and the response carries
    // Access-Control-Allow-Origin so we can read the JSON ack; GELF
    // ignores it and we use no-cors anyway to skip preflight (the GELF
    // HTTP input doesn't answer OPTIONS).
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data.payload)
    };
    if (data.type === 'gelf') opts.mode = 'no-cors';
    log('bridge ' + data.type + ' #' + id + ' → ' + data.endpoint);
    fetch(data.endpoint, opts).then(function (r) {
      return r.text().then(function (text) {
        var body = null;
        if (data.type === 'sheet') {
          try { body = JSON.parse(text); } catch (_) { body = text || null; }
        } else {
          body = text || null;
        }
        respondIab(ref, id, { ok: r.ok, status: r.status, body: body });
        log('bridge ' + data.type + ' #' + id + ' ' + r.status);
      }, function () {
        // CORS-blocked body read; the POST itself still landed.
        respondIab(ref, id, { ok: true, status: r.status || 0, body: null });
        log('bridge ' + data.type + ' #' + id + ' sent (opaque)');
      });
    }).catch(function (e) {
      var msg = String((e && e.message) || e);
      respondIab(ref, id, { ok: false, error: msg });
      log('bridge ' + data.type + ' #' + id + ' fail: ' + msg);
    });
  }

  function respondIab(ref, id, resp) {
    var code = '(window.__tokScrapeResolve||function(){})(' +
      JSON.stringify(id) + ',' + JSON.stringify(resp) + ');';
    try { ref.executeScript({ code: code }); } catch (_) {}
  }

  function injectFab(ref, target, payload) {
    var code =
      '(function(){' +
        'try {' +
          'if (window.__tokScrapeFab) return;' +
          'window.__tokScrapeFab = true;' +
          'var src = ' + JSON.stringify(payload) + ';' +
          'var label = ' + JSON.stringify(TARGETS[target].label) + ';' +
          'var btn = document.createElement("button");' +
          'btn.type = "button";' +
          'btn.textContent = "Run " + label + " scrape";' +
          'btn.style.cssText = [' +
            '"position:fixed",' +
            '"right:16px",' +
            '"bottom:24px",' +
            '"z-index:2147483647",' +
            '"padding:14px 20px",' +
            '"border:none",' +
            '"border-radius:28px",' +
            '"background:#ff3366",' +
            '"color:#fff",' +
            '"font:600 15px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",' +
            '"box-shadow:0 6px 20px rgba(0,0,0,.45)",' +
            '"cursor:pointer",' +
            '"-webkit-tap-highlight-color:transparent"' +
          '].join(";");' +
          'btn.addEventListener("click", function(ev){' +
            'ev.preventDefault();' +
            'ev.stopPropagation();' +
            'btn.disabled = true;' +
            'var prev = btn.textContent;' +
            'btn.textContent = "Running…";' +
            'btn.style.background = "#888";' +
            'try {' +
              '(0, eval)(src);' +
              'btn.textContent = "Sent ✓";' +
              'btn.style.background = "#1db954";' +
            '} catch (err) {' +
              'console.error("[tok-scrape] payload failed", err);' +
              'btn.textContent = "Failed — see console";' +
              'btn.style.background = "#c0392b";' +
              'alert("Scrape failed: " + (err && err.message || err));' +
            '}' +
            'setTimeout(function(){' +
              'btn.disabled = false;' +
              'btn.textContent = prev;' +
              'btn.style.background = "#ff3366";' +
            '}, 4000);' +
          '});' +
          'document.documentElement.appendChild(btn);' +
        '} catch (e) {' +
          'console.error("[tok-scrape] FAB inject failed", e);' +
        '}' +
      '})();';

    ref.executeScript({ code: code }, function () {});
  }
})();
