// Lifepreneur "Sample Value" demo — service worker.
//
// Two jobs:
//  1) On the toolbar-icon click, drive the demo: navigate the active tab to the
//     deployed orders.html fixture (if it isn't already there), wait for the
//     page to finish loading, then inject the three content scripts that run the
//     show (overlay UI → order-detail template manager → orchestrator).
//  2) Relay cross-origin TikTok Shop price lookups. A content script on
//     easierbycode.com can't fetch shop.tiktok.com (CORS), but the worker can
//     (see host_permissions), so the orchestrator asks us to look up the retail
//     price of a free-sample item by its description and we parse the first
//     price out of the search-results HTML.

const ORDERS_URL = 'https://easierbycode.com/tok-scrape/fixtures/orders.html';

// Scripts share one isolated world, so later files can read globals the earlier
// ones define (same pattern as the seller extension's config.js → scrape-*.js).
const INJECT_FILES = ['lifepreneur.js', 'template.js', 'demo.js'];

const bareUrl = (u) => (u || '').split('#')[0].split('?')[0];

// Resolve once the given tab reports status:complete on (or already sitting at)
// the orders URL. Falls back on a timeout so a hung navigation never wedges the
// click handler.
function waitForComplete(tabId, timeoutMs = 15000) {
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
          bareUrl(tab && tab.url) === ORDERS_URL) finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Already loaded? (e.g. we didn't navigate.)
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab && tab.status === 'complete' &&
          bareUrl(tab.url) === ORDERS_URL) finish();
    });
    const timer = setTimeout(finish, timeoutMs);
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    if (bareUrl(tab.url) !== ORDERS_URL) {
      await chrome.tabs.update(tab.id, { url: ORDERS_URL });
      await waitForComplete(tab.id);
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
    return hit
      ? { ok: true, price: hit.price, tier: hit.tier, url, status: r.status }
      : { ok: false, url, status: r.status };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), url };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.source !== 'life-demo') return false;
  if (msg.type === 'price-lookup') {
    lookupPrice(msg.query).then(sendResponse);
    return true; // async sendResponse
  }
  return false;
});
