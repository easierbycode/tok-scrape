document.addEventListener('deviceready', onDeviceReady, false);

const ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders.html';

function isOrdersUrl(url) {
    if (!url) return false;
    return url.split('#')[0].split('?')[0].replace(/\/$/, '') === ORDERS_URL;
}

function onDeviceReady() {
    const target = '_blank';
    const options = 'location=yes,hidden=no,clearcache=yes,clearsessioncache=yes';

    const iab = cordova.InAppBrowser.open(ORDERS_URL, target, options);
    let pendingRun = false;

    iab.addEventListener('loadstop', function(e) {
        injectBridge(iab, function() {
            if (pendingRun && isOrdersUrl(e.url)) {
                pendingRun = false;
                runExtension(iab);
            }
        });
    });

    iab.addEventListener('message', function(e) {
        const data = JSON.parse(e.data);

        if (data.type === 'run-extension') {
            if (isOrdersUrl(e.url)) {
                runExtension(iab);
            } else {
                pendingRun = true;
                iab.executeScript({ code: `window.location.href = "${ORDERS_URL}";` });
            }
        } else if (data.payload && data.payload.type === 'price-lookup') {
            handlePriceLookup(iab, data.id, data.payload.type, data.payload.query);
        }
    });
}

function injectBridge(ref, cb) {
    const code = `
    (function(){
        try {
            if (window.__lifeBridgeLoaded) return;
            window.__lifeBridgeLoaded = true;

            function post(msg) {
                var s = JSON.stringify(msg);
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
                    window.webkit.messageHandlers.cordova_iab.postMessage(s);
                } else if (window.cordova_iab && window.cordova_iab.postMessage) {
                    window.cordova_iab.postMessage(s);
                }
            }

            var btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "LP";
            btn.style.cssText = [
                "position:fixed",
                "right:16px",
                "bottom:24px",
                "z-index:2147483647",
                "padding:14px 20px",
                "border:none",
                "border-radius:28px",
                "background:#ff3366",
                "color:#fff",
                "font:600 15px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",
                "box-shadow:0 6px 20px rgba(0,0,0,.45)",
                "cursor:pointer",
                "-webkit-tap-highlight-color:transparent"
            ].join(";");

            btn.addEventListener("click", function(ev){
                ev.preventDefault();
                ev.stopPropagation();
                post({ type: 'run-extension' });
            });

            function add() {
                if (document.getElementById("__lifeFab")) return;
                btn.id = "__lifeFab";
                (document.documentElement || document.body).appendChild(btn);
            }
            setInterval(add, 1000);
            add();

            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) window.chrome.runtime = {};
            window.chrome.runtime.sendMessage = function(message, callback) {
                var id = Math.random().toString(36).substring(7);
                if (callback) {
                    if (!window.__lifeCallbacks) window.__lifeCallbacks = {};
                    window.__lifeCallbacks[id] = callback;
                }
                post({ id: id, payload: message });
            };

            window.__lifeOnResponse = function(id, response) {
                if (window.__lifeCallbacks && window.__lifeCallbacks[id]) {
                    window.__lifeCallbacks[id](response);
                    delete window.__lifeCallbacks[id];
                }
            };
        } catch (e) {
            console.error("[tok-scrape] FAB inject failed", e);
        }
    })();
    `;
    ref.executeScript({ code: code }, cb);
}

function runExtension(iab) {
    iab.executeScript({ file: 'ext/lifepreneur.js' }, () => {
        iab.executeScript({ file: 'ext/template.js' }, () => {
            iab.executeScript({ file: 'ext/demo.js' });
        });
    });
}

function handlePriceLookup(iab, messageId, type, query) {
    const lookupUrl = 'https://shop.tiktok.com/us/s?q=' + encodeURIComponent(query);
    const http = (window.cordova && cordova.plugin && cordova.plugin.http) || null;

    if (http) {
        http.get(lookupUrl, {}, {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml'
        }, function(response) {
            const hit = firstPriceFromHtml(response.data);
            const res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
            iab.executeScript({ code: `window.__lifeOnResponse("${messageId}", ${JSON.stringify(res)});` });
        }, function(response) {
            const res = { ok: false, error: response.error };
            iab.executeScript({ code: `window.__lifeOnResponse("${messageId}", ${JSON.stringify(res)});` });
        });
    } else {
        fetch(lookupUrl, {
            credentials: 'omit',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        })
        .then(r => r.text())
        .then(html => {
            const hit = firstPriceFromHtml(html);
            const res = hit ? { ok: true, price: hit.price, tier: hit.tier } : { ok: false };
            iab.executeScript({ code: `window.__lifeOnResponse("${messageId}", ${JSON.stringify(res)});` });
        })
        .catch(err => {
            const res = { ok: false, error: String(err) };
            iab.executeScript({ code: `window.__lifeOnResponse("${messageId}", ${JSON.stringify(res)});` });
        });
    }
}

function firstPriceFromHtml(html) {
    if (!html) return null;
    const embedded = [
        /"sale_price"\s*:\s*\{[^}]*?"price_val"\s*:\s*"?\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"format(?:ed)?_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"real_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"price(?:_str)?"\s*:\s*"\$?\s*([0-9]+(?:\.[0-9]{1,2})?)"/i
    ];
    for (const re of embedded) {
        const m = html.match(re);
        if (m) {
            const n = parseFloat(m[1]);
            if (!isNaN(n) && n >= 0.5 && n <= 9999) return { price: n, tier: 'embedded' };
        }
    }
    const re = /\$\s?([0-9]{1,4}\.[0-9]{2})\b/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const n = parseFloat(m[1]);
        if (!isNaN(n) && n >= 3 && n <= 9999) return { price: n, tier: 'visible' };
    }
    return null;
}
