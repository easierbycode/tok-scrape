// Lifepreneur "Sample Value" demo — service worker.
//
// Two jobs:
//  1) On the toolbar-icon click, drive the demo: use the active tab when it is
//     already on a supported order-list page, otherwise navigate to the
//     deployed fixture, wait for the page to finish loading, then inject the
//     three content scripts that run the show (overlay UI → order-detail
//     template manager → orchestrator).
//  2) Relay cross-origin TikTok Shop price lookups. A content script can't
//     reliably fetch shop.tiktok.com (CORS), but the worker can
//     (see host_permissions), so the orchestrator asks us to look up the retail
//     price of a free-sample item by its description and we parse the first
//     price out of the search-results HTML.

const DEPLOYED_ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders-wizard.html';
const KIOSK_API_BASE = 'https://thirsty-store-kiosk.easierbycode.deno.net';

// Direct Graylog write path, same as the seller/agency scrapers. Points at the
// graylog-shim Deno Deploy app; the token is sent as _graylog_key and accepted
// by the shim's GELF write gate (it's in API_TOKENS). See MIGRATION_PLAN.md.
var GRAYLOG_ENDPOINT = 'https://graylog-shim.easierbycode.deno.net/gelf';
var GRAYLOG_TOKEN    = '1d1l5fhd0bugo25s5ulib29vtjshp93q8sg4ll76nck84rj6krlr';
const SUPPORTED_FIXTURES = [
  {
    origin: 'https://easierbycode.com',
    path: '/tok-scrape/fixtures/orders-wizard.html'
  },
  {
    origin: 'https://easierbycode.com',
    path: '/tok-scrape/fixtures/orders.html'
  }
];
const LOCAL_FIXTURE_HOSTS = new Set(['localhost', '127.0.0.1']);
const LOCAL_ORDER_LIST_PATHS = new Set([
  '/fixtures/orders.html',
  '/fixtures/orders-wizard.html',
  '/orders',
  '/orders/'
]);
const TIKTOK_ORDER_LIST_HOSTS = new Set(['www.tiktok.com']);
const TIKTOK_ORDER_LIST_PATHS = new Set(['/shop/order_list', '/shop/order_list/']);

// Scripts share one isolated world, so later files can read globals the earlier
// ones define (same pattern as the seller extension's config.js → scrape-*.js).
const INJECT_FILES = ['lifepreneur.js', 'template.js', 'demo.js'];

const bareUrl = (u) => (u || '').split('#')[0].split('?')[0];

function orderListPageForUrl(value) {
  try {
    const url = new URL(bareUrl(value));
    const deployed = SUPPORTED_FIXTURES.find((fixture) =>
      url.origin === fixture.origin && url.pathname === fixture.path
    );
    if (deployed) return deployed;
    if (url.protocol === 'http:' &&
        LOCAL_FIXTURE_HOSTS.has(url.hostname) &&
        LOCAL_ORDER_LIST_PATHS.has(url.pathname)) {
      return { origin: url.origin, path: url.pathname };
    }
    if (url.protocol === 'https:' &&
        TIKTOK_ORDER_LIST_HOSTS.has(url.hostname) &&
        TIKTOK_ORDER_LIST_PATHS.has(url.pathname)) {
      return { origin: url.origin, path: url.pathname };
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Resolve once the given tab reports status:complete on (or already sitting at)
// the orders URL. Falls back on a timeout so a hung navigation never wedges the
// click handler.
function waitForComplete(tabId, expectedUrl, timeoutMs = 15000) {
  const expected = bareUrl(expectedUrl);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, info, tab) => {
      if (id === tabId && info.status === 'complete' &&
          bareUrl(tab && tab.url) === expected) finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Already loaded? (e.g. we didn't navigate.)
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab && tab.status === 'complete' &&
          bareUrl(tab.url) === expected) finish();
    });
    const timer = setTimeout(finish, timeoutMs);
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    const activeOrderList = orderListPageForUrl(tab.url);
    const launchUrl = activeOrderList ? bareUrl(tab.url) : DEPLOYED_ORDERS_URL;

    if (!activeOrderList) {
      await chrome.tabs.update(tab.id, { url: launchUrl });
      await waitForComplete(tab.id, launchUrl);
    } else if (tab.status !== 'complete') {
      await waitForComplete(tab.id, launchUrl);
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: INJECT_FILES
    });
    chrome.action.setBadgeText({ tabId: tab.id, text: '●' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#e8650a' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 2500);
  } catch (e) {
    console.warn('[life-demo] launch failed', e);
  }
});

// ---- TikTok Shop price lookup ---------------------------------------------
// Pull the first plausible price out of the search-results HTML. TikTok renders
// most of its grid client-side and gates bots, so this often comes back empty —
// the orchestrator treats a null result as "couldn't resolve" and falls back to
// an estimate, so the tally always completes. We just report what we can find.
function firstPriceFromHtml(html) {
  if (!html) return null;
  // Trusted: TikTok embeds product data as JSON in the initial document for SEO.
  const embedded = [
    /"sale_price"\s*:\s*\{[^}]*?"price_val"\s*:\s*"?\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"format(?:ed)?_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"real_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"price(?:_str)?"\s*:\s*"\$?\s*([0-9]+(?:\.[0-9]{1,2})?)"/i
  ];
  for (const re of embedded) {
    const m = html.match(re);
    if (m) { const n = parseFloat(m[1]); if (!isNaN(n) && n >= 0.5 && n <= 9999) return { price: n, tier: 'embedded' }; }
  }
  // Weak fallback: a visible "$x.xx". Scan ALL and skip implausibly-low values
  // (shipping/promo cents that aren't the product) — tag 'visible' so the caller
  // keeps it at medium confidence rather than presenting a guess as corroborated.
  const re = /\$\s?([0-9]{1,4}\.[0-9]{2})\b/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const n = parseFloat(m[1]);
    if (!isNaN(n) && n >= 3 && n <= 9999) return { price: n, tier: 'visible' };
  }
  return null;
}

// First product image out of the same embedded JSON, so the share card can show
// the real product photo when the order card didn't carry one. Best-effort like
// the price: a miss just means the lettered tile fallback.
function firstImageFromHtml(html) {
  if (!html) return null;
  const patterns = [
    /"(?:thumb_)?url_list"\s*:\s*\[\s*"(https:[^"]+?)"/i,
    /"(?:cover|image|img|main_image)(?:_url)?"\s*:\s*"(https:[^"]+?)"/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      // embedded JSON escapes slashes both ways
      const url = m[1].replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
      if (/^https:\/\/[^"\\\s]+$/.test(url)) return url;
    }
  }
  return null;
}

async function lookupPrice(query) {
  const url = 'https://shop.tiktok.com/us/s?q=' + encodeURIComponent(query);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      credentials: 'omit',
      headers: {
        // A real UA improves the odds of getting the SEO HTML over a bot wall.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!r.ok) return { ok: false, status: r.status, url };
    const html = await r.text();
    const hit = firstPriceFromHtml(html);
    const img = firstImageFromHtml(html) || undefined;
    return hit
      ? { ok: true, price: hit.price, tier: hit.tier, img, url, status: r.status }
      : { ok: false, img, url, status: r.status };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), url };
  } finally {
    clearTimeout(timer);
  }
}

const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function fetchKioskJson(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(KIOSK_API_BASE + path, {
      credentials: 'omit',
      signal: ctrl.signal,
      headers: { 'accept': 'application/json' }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Known prices already in the kiosk, by product id and by normalized name.
// /api/unpriced-samples carries recovered prices (edits) for sample rows;
// /api/products carries raw Graylog prices for everything else. A lookup
// failure just yields empty maps — when the kiosk can't be asked, persist
// rather than silently drop data. One in-flight load is shared by the pool,
// re-fetched after a minute.
let knownPricesPromise = null;
let knownPricesAt = 0;
function loadKnownPrices() {
  if (!knownPricesPromise || Date.now() - knownPricesAt > 60000) {
    knownPricesAt = Date.now();
    knownPricesPromise = (async () => {
      const byId = new Map(), byName = new Map();
      const note = (id, name, price) => {
        const p = Number(price) || 0;
        if (p <= 0) return;
        if (id) byId.set(String(id), Math.max(p, byId.get(String(id)) || 0));
        const n = normName(name);
        if (n) byName.set(n, Math.max(p, byName.get(n) || 0));
      };
      const [samples, products] = await Promise.all([
        fetchKioskJson('/api/unpriced-samples?limit=1000'),
        fetchKioskJson('/api/products?limit=500')
      ]);
      ((samples && samples.items) || []).forEach((s) => note(s.productId, s.name, s.price));
      (Array.isArray(products) ? products : []).forEach((p) => note(p.productId, p.name, p.min_sku_original_price));
      return { byId, byName };
    })();
  }
  return knownPricesPromise;
}

async function postSampleToKiosk(product, name, price) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(KIOSK_API_BASE + '/api/sample-products', {
      method: 'POST',
      credentials: 'omit',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        productId: product.productId,
        name,
        price,
        sampleCount: product.sampleCount || 1,
        category: product.category || 'Samples',
        seller: product.seller || product.store || 'Lifepreneur extension',
        sourceUrl: product.sourceUrl,
        fetchedAt: product.fetchedAt,
        lastSeen: product.lastSeen,
        notes: product.notes || ''
      })
    });
    const text = await r.text();
    const body = text ? JSON.parse(text) : {};
    if (!r.ok) {
      return { ok: false, status: r.status, error: body.error || text || 'Persist failed' };
    }
    return { ok: true, sample: body };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// Write the product straight to Graylog the way the seller/agency scrapers do.
// Mirrors the kiosk's own GELF shape: the product row rides in core_data_json
// (price 0, so it stays in the recovery queue) and the price in
// sample_edit_json, which the kiosk recovers on read.
async function sendSampleToGraylog(product, name, price) {
  if (!GRAYLOG_ENDPOINT || !GRAYLOG_TOKEN) return { ok: false, error: 'Graylog not configured' };
  const now = new Date().toISOString();
  const sampleCount = Number(product.sampleCount) || 1;
  const seller = product.seller || product.store || 'Lifepreneur extension';
  const gelf = {
    version: '1.1',
    host: 'lifepreneur-extension',
    short_message: 'thirsty sample product: ' + name,
    timestamp: Math.floor(Date.now() / 1000),
    _graylog_key: GRAYLOG_TOKEN,
    _sample_source: 'extension',
    _core_data_json: JSON.stringify({
      productId: product.productId,
      name,
      min_sku_original_price: 0,
      sample_count: sampleCount,
      category: product.category || 'Samples',
      seller,
      estimated_retail_value: price * sampleCount,
      scrapedAt: product.fetchedAt || now
    }),
    _sample_edit_json: JSON.stringify({
      productId: product.productId,
      price,
      sampleCount,
      notes: product.notes || '',
      source: 'extension',
      sourceUrl: product.sourceUrl,
      apiTitle: name,
      apiSeller: seller,
      fetchedAt: product.fetchedAt || now,
      updatedAt: now
    })
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(GRAYLOG_ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gelf)
    });
    if (!r.ok) return { ok: false, status: r.status, error: 'GELF post failed: ' + r.status };
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

async function persistSampleProduct(product) {
  const name = String((product && product.name) || '').trim();
  const price = Number(product && product.price);
  if (!name || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'Missing product name or price' };
  }

  // Only products the kiosk doesn't already have a price for get persisted.
  // Unpriced rows still go through — recovering their price is the point.
  const known = await loadKnownPrices();
  const knownPrice = Math.max(
    known.byId.get(String((product && product.productId) || '')) || 0,
    known.byName.get(normName(name)) || 0
  );
  if (knownPrice > 0) {
    return { ok: true, skipped: 'already-priced', price: knownPrice };
  }

  // Prefer the kiosk endpoint (it stores provenance and forwards to Graylog).
  // When the kiosk is unreachable, older than this feature, or couldn't reach
  // Graylog itself, write the GELF message directly so the data still lands
  // in the durable store.
  const viaKiosk = await postSampleToKiosk(product, name, price);
  const durable = viaKiosk.ok && viaKiosk.sample &&
    Array.isArray(viaKiosk.sample.persistedTo) &&
    viaKiosk.sample.persistedTo.indexOf('graylog') !== -1;
  if (durable) return viaKiosk;

  const viaGelf = await sendSampleToGraylog(product, name, price);
  if (viaGelf.ok || viaKiosk.ok) {
    return { ok: true, kiosk: !!viaKiosk.ok, graylog: !!viaGelf.ok, sample: viaKiosk.sample };
  }
  return { ok: false, error: viaGelf.error || viaKiosk.error || 'Persist failed' };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.source !== 'life-demo') return false;
  if (msg.type === 'price-lookup') {
    lookupPrice(msg.query).then(sendResponse);
    return true; // async sendResponse
  }
  if (msg.type === 'persist-sample-product') {
    persistSampleProduct(msg.product).then(sendResponse, (e) => {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    });
    return true; // async sendResponse
  }
  return false;
});
