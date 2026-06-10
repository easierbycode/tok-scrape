document.addEventListener('deviceready', function() {
    console.log('[LP-host] deviceready');
    var ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders.html';

    // Open InAppBrowser with default settings. UA is configured in config.xml
    var iab = cordova.InAppBrowser.open(ORDERS_URL, '_blank', 'location=yes,hidden=no,clearcache=yes,clearsessioncache=yes');

    var pendingRun = false;
    var currentUrl = ORDERS_URL;

    // Load bridge from file on every page load
    iab.addEventListener('loadstop', function(e) {
        console.log('[LP-host] loadstop:', e.url);
        currentUrl = e.url;
        iab.executeScript({ file: 'js/guest-bridge.js' }, function() {
            console.log('[LP-host] bridge injected');
            if (pendingRun && e.url.indexOf('/fixtures/orders.html') !== -1) {
                pendingRun = false;
                runExtension();
            }
        });
    });

    // Handle messages from guest (bridge or extension)
    iab.addEventListener('message', function(e) {
        console.log('[LP-host] message received:', e.data);
        var data = e.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(_) { return; }
        }

        if (data.type === 'run-extension') {
            // Check if we are on the target page
            if (currentUrl && currentUrl.indexOf('/fixtures/orders.html') !== -1) {
                runExtension();
            } else {
                console.log('[LP-host] not on orders page, navigating...');
                pendingRun = true;
                iab.executeScript({ code: "window.location.href = '" + ORDERS_URL + "';" });
            }
        } else if (data.payload && data.payload.type === 'price-lookup') {
            handlePriceLookup(data.id, data.payload.query);
        }
    });

    function runExtension() {
        console.log('[LP-host] runExtension');
        // Sequential injection of extension files.
        // These rely on globals from each other.
        iab.executeScript({ file: 'ext/lifepreneur.js' }, function() {
            iab.executeScript({ file: 'ext/template.js' }, function() {
                iab.executeScript({ file: 'ext/demo.js' });
            });
        });
    }

    function handlePriceLookup(messageId, query) {
        console.log('[LP-host] price lookup:', query);
        var lookupUrl = 'https://shop.tiktok.com/us/s?q=' + encodeURIComponent(query);

        // Prefer native HTTP if available (for CORS), fallback to fetch
        var http = (window.cordova && cordova.plugin && cordova.plugin.http) || null;

        if (http) {
            http.get(lookupUrl, {}, {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
            }, function(response) {
                var hit = firstPriceFromHtml(response.data);
                var res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
                iab.executeScript({ code: 'window.__lifeOnResponse("' + messageId + '", ' + JSON.stringify(res) + ');' });
            }, function(response) {
                var res = { ok: false, error: response.error };
                iab.executeScript({ code: 'window.__lifeOnResponse("' + messageId + '", ' + JSON.stringify(res) + ');' });
            });
        } else {
            fetch(lookupUrl)
                .then(function(r) { return r.text(); })
                .then(function(html) {
                    var hit = firstPriceFromHtml(html);
                    var res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
                    iab.executeScript({ code: 'window.__lifeOnResponse("' + messageId + '", ' + JSON.stringify(res) + ');' });
                })
                .catch(function(err) {
                    var res = { ok: false, error: String(err) };
                    iab.executeScript({ code: 'window.__lifeOnResponse("' + messageId + '", ' + JSON.stringify(res) + ');' });
                });
        }
    }

    function firstPriceFromHtml(html) {
        if (!html) return null;
        var embedded = [
            /"sale_price"\s*:\s*\{[^}]*?"price_val"\s*:\s*"?\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
            /"format(?:ed)?_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
            /"real_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
            /"price(?:_str)?"\s*:\s*"\$?\s*([0-9]+(?:\.[0-9]{1,2})?)"/i
        ];
        for (var i = 0; i < embedded.length; i++) {
            var m = html.match(embedded[i]);
            if (m) {
                var n = parseFloat(m[1]);
                if (!isNaN(n) && n >= 0.5 && n <= 9999) return { price: n, tier: 'embedded' };
            }
        }
        var re = /\$\s?([0-9]{1,4}\.[0-9]{2})\b/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var n = parseFloat(m[1]);
            if (!isNaN(n) && n >= 3 && n <= 9999) return { price: n, tier: 'visible' };
        }
        return null;
    }
}, false);
