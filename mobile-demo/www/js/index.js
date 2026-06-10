document.addEventListener('deviceready', function() {
    console.log('[LP-host] deviceready');
    var ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders.html';

    // Open InAppBrowser. location=yes helps with visibility.
    var iab = cordova.InAppBrowser.open(ORDERS_URL, '_blank', 'location=yes,hidden=no,clearcache=yes,clearsessioncache=yes');

    var pendingRun = false;

    // Robust bridge code for injection
    var bridgeCode = "(function() { " +
        "if (window.__lpBridge) return; " +
        "window.__lpBridge = true; " +
        "console.log('[LP-guest] bridge loading'); " +

        "function post(msg) { " +
            "var s = JSON.stringify(msg); " +
            "if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) { " +
                "window.webkit.messageHandlers.cordova_iab.postMessage(s); " +
            "} else if (window.cordova_iab && window.cordova_iab.postMessage) { " +
                "window.cordova_iab.postMessage(s); " +
            "} " +
        "} " +

        "var btn = document.createElement('button'); " +
        "btn.id = '__lifeFab'; " +
        "btn.textContent = 'LP'; " +
        "btn.style.cssText = 'position:fixed !important; bottom:100px !important; right:20px !important; width:72px !important; height:72px !important; border-radius:36px !important; background:#e8650a !important; color:#ffffff !important; display:flex !important; align-items:center !important; justify-content:center !important; font-weight:900 !important; font-size:22px !important; box-shadow:0 8px 32px rgba(0,0,0,0.5) !important; z-index:2147483647 !important; cursor:pointer !important; border:3px solid #ffffff !important; outline:none !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;'; " +

        "btn.onclick = function(e) { " +
            "e.preventDefault(); e.stopPropagation(); " +
            "console.log('[LP-guest] button tapped'); " +
            "post({ type: 'run-extension' }); " +
        "}; " +

        "function ensure() { " +
            "if (!document.getElementById('__lifeFab')) { " +
                "var target = document.body || document.documentElement; " +
                "if (target) { target.appendChild(btn); console.log('[LP-guest] button injected'); } " +
            "} " +
        "} " +
        "setInterval(ensure, 1000); " +
        "ensure(); " +

        // Chrome runtime polyfills
        "if (!window.chrome) window.chrome = {}; " +
        "if (!window.chrome.runtime) window.chrome.runtime = {}; " +
        "window.chrome.runtime.sendMessage = function(m, c) { " +
            "var id = Math.random().toString(36).substring(7); " +
            "if (c) { if (!window.__lpc) window.__lpc = {}; window.__lpc[id] = c; } " +
            "post({ id: id, payload: m }); " +
        "}; " +
        "window.__lpRes = function(id, r) { " +
            "if (window.__lpc && window.__lpc[id]) { window.__lpc[id](r); delete window.__lpc[id]; } " +
        "}; " +
    "})();";

    iab.addEventListener('loadstop', function(e) {
        console.log('[LP-host] loadstop: ' + e.url);
        iab.executeScript({ code: bridgeCode });
        // Retry injection to be sure
        setTimeout(function() { iab.executeScript({ code: bridgeCode }); }, 1000);

        if (pendingRun && e.url && e.url.indexOf('/fixtures/orders.html') !== -1) {
            pendingRun = false;
            setTimeout(runExtension, 500);
        }
    });

    iab.addEventListener('message', function(e) {
        var data = e.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(ex) { return; }
        }

        if (data.type === 'run-extension') {
            iab.executeScript({ code: "window.location.href" }, function(values) {
                var url = (values && values[0]) ? values[0] : "";
                if (url.indexOf('/fixtures/orders.html') !== -1) {
                    runExtension();
                } else {
                    console.log('[LP-host] redirecting to orders fixture');
                    pendingRun = true;
                    iab.executeScript({ code: "window.location.href = '" + ORDERS_URL + "';" });
                }
            });
        } else if (data.id && data.payload && data.payload.type === 'price-lookup') {
            doPriceLookup(data.id, data.payload.query);
        }
    });

    function runExtension() {
        console.log('[LP-host] executing extension scripts');
        iab.executeScript({ file: 'ext/lifepreneur.js' }, function() {
            iab.executeScript({ file: 'ext/template.js' }, function() {
                iab.executeScript({ file: 'ext/demo.js' });
            });
        });
    }

    function doPriceLookup(id, query) {
        var url = 'https://shop.tiktok.com/us/s?q=' + encodeURIComponent(query);
        fetch(url)
            .then(function(r) { return r.text(); })
            .then(function(html) {
                var m = html.match(/"price_val"\s*:\s*"?\$?([0-9.]+)/i);
                var res = m ? { ok: true, price: parseFloat(m[1]) } : { ok: false };
                iab.executeScript({ code: "if(window.__lpRes) window.__lpRes('" + id + "', " + JSON.stringify(res) + ");" });
            })
            .catch(function(err) {
                iab.executeScript({ code: "if(window.__lpRes) window.__lpRes('" + id + "', {ok:false});" });
            });
    }
}, false);
