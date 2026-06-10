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
        // Use executeScript({file:...}) for cleaner injection
        iab.executeScript({ file: 'js/guest-bridge.js' }, () => {
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
            handlePriceLookup(iab, data.id, data.payload.query);
        }
    });
}

function runExtension(iab) {
    // Sequence ensures globals are available before demo.js runs
    iab.executeScript({ file: 'ext/lifepreneur.js' }, () => {
        iab.executeScript({ file: 'ext/template.js' }, () => {
            iab.executeScript({ file: 'ext/demo.js' });
        });
    });
}

function handlePriceLookup(iab, messageId, query) {
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
