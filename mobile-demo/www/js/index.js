document.addEventListener('deviceready', function() {
    console.log('[LP-host] deviceready');
    var ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders.html';
    var iab = cordova.InAppBrowser.open(ORDERS_URL, '_blank', 'location=yes,hidden=no,clearcache=yes,clearsessioncache=yes');

    var pendingRun = false;
    var currentUrl = ORDERS_URL;

    function injectFile(path, next) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', path, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    iab.executeScript({ code: xhr.responseText }, function() {
                        console.log('[LP-host] injected ' + path);
                        if (next) next();
                    });
                } else {
                    console.error('[LP-host] failed to load ' + path + ' status: ' + xhr.status);
                }
            }
        };
        xhr.send();
    }

    iab.addEventListener('loadstop', function(e) {
        console.log('[LP-host] loadstop: ' + e.url);
        currentUrl = e.url;
        injectFile('js/guest-bridge.js');

        if (pendingRun && e.url && e.url.indexOf('/fixtures/orders.html') !== -1) {
            console.log('[LP-host] executing pending run');
            pendingRun = false;
            setTimeout(runExtension, 1000);
        }
    });

    iab.addEventListener('message', function(e) {
        console.log('[LP-host] message received: ' + JSON.stringify(e.data));
        var data = e.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(ex) { return; }
        }

        if (data.type === 'run-extension') {
            var url = data.url || currentUrl;
            if (url.indexOf('/fixtures/orders.html') !== -1) {
                runExtension();
            } else {
                console.log('[LP-host] redirecting to orders fixture');
                pendingRun = true;
                iab.executeScript({ code: "window.location.href = '" + ORDERS_URL + "';" });
            }
        } else if (data.id && data.payload && data.payload.type === 'price-lookup') {
            doPriceLookup(data.id, data.payload.query);
        }
    });

    function runExtension() {
        console.log('[LP-host] runExtension starting');
        injectFile('ext/lifepreneur.js', function() {
            injectFile('ext/template.js', function() {
                injectFile('ext/demo.js');
            });
        });
    }

    function doPriceLookup(id, query) {
        console.log('[LP-host] price lookup: ' + query);
        var lookupUrl = 'https://shop.tiktok.com/us/s?q=' + encodeURIComponent(query);

        var http = (window.cordova && cordova.plugin && cordova.plugin.http) || null;
        if (http) {
            http.get(lookupUrl, {}, {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
            }, function(response) {
                var hit = firstPriceFromHtml(response.data);
                var res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
                iab.executeScript({ code: "if(window.__lifeOnResponse) window.__lifeOnResponse('" + id + "', " + JSON.stringify(res) + ");" });
            }, function(response) {
                iab.executeScript({ code: "if(window.__lifeOnResponse) window.__lifeOnResponse('" + id + "', {ok:false});" });
            });
        } else {
            fetch(lookupUrl)
                .then(function(r) { return r.text(); })
                .then(function(html) {
                    var hit = firstPriceFromHtml(html);
                    var res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
                    iab.executeScript({ code: "if(window.__lifeOnResponse) window.__lifeOnResponse('" + id + "', " + JSON.stringify(res) + ");" });
                })
                .catch(function(err) {
                    iab.executeScript({ code: "if(window.__lifeOnResponse) window.__lifeOnResponse('" + id + "', {ok:false});" });
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
