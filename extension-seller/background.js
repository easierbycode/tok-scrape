// Service worker: routes the action click to the right scrape script based
// on URL, and forwards GELF / Sheets payloads to their endpoints in a context
// the page's CSP can't block.

const ROUTES = [
  {
    test: /https:\/\/shop\.tiktok\.com\/workbench\/live\/overview/,
    files: ['config.js', 'scrape-live.js'],
    label: 'live'
  },
  {
    // Local dev fixture for the LIVE Dashboard, served either as a file:// URL
    // (Chrome needs "Allow access to file URLs" enabled on the extension) or
    // via a local HTTP server (e.g. `python -m http.server`, Vite, etc.):
    //   file:///.../fixtures/live_overview.html
    //   http://localhost:5173/fixtures/live_overview.html
    //   http://localhost:5173/fixtures/live_overview__boosted.html?foo=bar
    // The trailing group allows optional ?query / #fragment so dev URLs with
    // a cache-buster or anchor still match.
    test: /\/fixtures\/live_overview(?:__[^/]*)?\.html(?:[?#]|$)/,
    files: ['config.js', 'scrape-live.js'],
    label: 'live'
  },
  {
    test: /https:\/\/shop\.tiktok\.com\/streamer\/compass\/video-analysis\/view/,
    files: ['config.js', 'scrape-streamer.js'],
    label: 'streamer'
  },
  {
    test: /https:\/\/shop\.tiktok\.com\/streamer\/compass\/livestream-analytics\/view/,
    files: ['config.js', 'scrape-analytics.js'],
    label: 'analytics'
  }
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;
  const route = ROUTES.find((r) => r.test.test(tab.url));
  if (!route) {
    console.warn('[tok-scrape-seller] no route for', tab.url);
    chrome.action.setBadgeText({ tabId: tab.id, text: '?' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#888' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 2000);
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: route.files
    });
    chrome.action.setBadgeText({ tabId: tab.id, text: route.label[0].toUpperCase() });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#2a8' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 2000);
  } catch (e) {
    console.warn('[tok-scrape-seller] inject failed', e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.source !== 'tok-scrape') return false;

  if (msg.type === 'gelf' || msg.type === 'sheet') {
    const headers = msg.type === 'sheet'
      ? { 'Content-Type': 'text/plain;charset=utf-8' }
      : { 'Content-Type': 'application/json' };
    fetch(msg.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(msg.payload)
    })
      .then(async (r) => {
        // Always drain the body. Sheets returns JSON we want to log; Graylog
        // GELF returns 202 + empty body, but if we don't consume the stream
        // Chrome closes it client-side and stamps the entry net::ERR_ABORTED
        // in DevTools, masking what is in fact a successful POST.
        let body = null;
        try {
          const text = await r.text();
          if (msg.type === 'sheet') {
            try { body = JSON.parse(text); } catch (_) { body = text || null; }
          } else {
            body = text || null;
          }
        } catch (_) { body = null; }
        sendResponse({ ok: r.ok, status: r.status, body });
      })
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true; // async sendResponse
  }

  return false;
});
