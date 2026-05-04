// Cordova-IAB shim for `chrome.runtime.sendMessage`.
//
// The extension scrapers (extension-{agency,seller}/scrape-*.js) delegate
// their Sheets / Graylog POSTs to the extension background service worker
// via chrome.runtime.sendMessage, which sits outside the page's CSP. Inside
// a Cordova InAppBrowser there's no service worker, AND the page CSP on
// shop.tiktok.com / partner.us.tiktokshop.com lacks an explicit
// `connect-src`, so its `default-src` (ByteDance/TikTok hosts only) blocks
// any fetch to script.google.com or our Graylog ngrok endpoint.
//
// We bridge the request to the launcher webview (https://localhost in the
// Cordova app, with our own `connect-src *` CSP) via the IAB plugin's
// built-in postMessage channel, and the host (app.js openTarget message
// handler) does the actual fetch and pushes the response back via
// executeScript → window.__tokScrapeResolve.
if (typeof globalThis.chrome === 'undefined' || !globalThis.chrome) {
  globalThis.chrome = {};
}
if (!chrome.runtime) chrome.runtime = {};

window.__tokScrapeReqs = window.__tokScrapeReqs || {};
window.__tokScrapeNext = window.__tokScrapeNext || 0;
window.__tokScrapeResolve = function (id, resp) {
  var cb = window.__tokScrapeReqs[id];
  delete window.__tokScrapeReqs[id];
  if (cb) { try { cb(resp); } catch (_) {} }
};

if (!chrome.runtime.sendMessage) {
  chrome.runtime.lastError = null;
  chrome.runtime.sendMessage = function (msg, cb) {
    var done = function (resp) { try { if (cb) cb(resp); } catch (_) {} };
    if (!msg || msg.source !== 'tok-scrape') { done(undefined); return; }
    if (msg.type !== 'gelf' && msg.type !== 'sheet') { done(undefined); return; }
    if (typeof cordova_iab === 'undefined' || !cordova_iab.postMessage) {
      done({ ok: false, error: 'cordova_iab bridge unavailable' });
      return;
    }
    var id = ++window.__tokScrapeNext;
    window.__tokScrapeReqs[id] = cb;
    try {
      cordova_iab.postMessage(JSON.stringify({
        kind:     'tok-scrape-fetch',
        id:       id,
        type:     msg.type,
        endpoint: msg.endpoint,
        payload:  msg.payload
      }));
    } catch (e) {
      delete window.__tokScrapeReqs[id];
      done({ ok: false, error: 'postMessage failed: ' + ((e && e.message) || e) });
    }
  };
}
