// Order-detail template manager.
//
// The spec: clicking "View order details" on each order should open a template
// that "uses fixtures/order.html as its starting point" with the shop icon/name,
// product description, purchase date and price filled in. We literally render
// the sibling order.html fixture from the current fixture host (localhost or
// easierbycode.com) — scripts stripped so its React bundle can't hydrate over
// our fills — inside a centered iframe, then mutate the exact nodes the seller
// scraper already knows (see scrape-order.js for the same selectors).
//
// window.LifeTemplate:
//   ensure()                 -> Promise<void>, builds + loads the iframe once
//   show(order)              -> fill fields, pop the card for this order
//   setRetail(text)          -> update the "est. retail" annotation in place
//   hide() / destroy()
(function () {
  if (window.__LifeTemplateLoaded) return;
  window.__LifeTemplateLoaded = true;

  const Z = 2147483590; // below the Lifepreneur HUD/modal, above the host page
  const DEPLOYED_FIXTURE_BASE = 'https://easierbycode.com/tok-scrape/fixtures/';
  const TEMPLATE_SOURCES = templateSourcesFromLocation();
  const ACCENT = '#e8650a';

  let scrim, frame, iframe, ready = null, annotation = null;

  function sourceFromBase(base) {
    return { url: new URL('order.html', base).href, base };
  }

  function uniqueSources(sources) {
    const seen = new Set();
    return sources.filter((source) => {
      const key = source.url + '|' + source.base;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function templateSourcesFromLocation() {
    const sources = [];
    try {
      const url = new URL(window.location.href);
      if (/\/fixtures\/orders\.html$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/orders\.html$/i, '');
        url.search = '';
        url.hash = '';
        sources.push(sourceFromBase(url.href));
      }
      if (
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        /^\/orders\/?$/i.test(url.pathname)
      ) {
        sources.push(
          { url: url.origin + '/order/', base: url.origin + '/order/' },
          { url: url.origin + '/order.html', base: url.origin + '/' },
          sourceFromBase(url.origin + '/fixtures/')
        );
      }
    } catch (_) {}
    sources.push(sourceFromBase(DEPLOYED_FIXTURE_BASE));
    return uniqueSources(sources);
  }

  async function fetchTemplate() {
    let lastError = null;
    for (const source of TEMPLATE_SOURCES) {
      try {
        const response = await fetch(source.url, { credentials: 'omit' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return { html: await response.text(), base: source.base };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('No order template source available');
  }

  function buildSrcdoc(html, base) {
    // Strip every <script> (the live lib-react/main/page bundles would otherwise
    // hydrate #root and wipe our fills); the page already ships fully
    // server-rendered, so it looks identical static.
    let out = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // <base> so the page's relative CSS/images resolve against the fixtures dir.
    if (/<head[^>]*>/i.test(out)) out = out.replace(/<head([^>]*)>/i, '<head$1><base href="' + base + '">');
    else out = '<base href="' + base + '">' + out;
    return out;
  }

  function ensure() {
    if (ready) return ready;
    ready = (async () => {
      const template = await fetchTemplate();
      scrim = document.createElement('div');
      Object.assign(scrim.style, {
        position: 'fixed', inset: '0', zIndex: String(Z),
        background: 'rgba(6,8,12,0.45)', backdropFilter: 'blur(1.5px)',
        display: 'grid', placeItems: 'center', padding: '88px 24px 28px',
        opacity: '0', transition: 'opacity 0.3s ease', pointerEvents: 'none'
      });
      frame = document.createElement('div');
      Object.assign(frame.style, {
        position: 'relative', width: 'min(920px, 94vw)', height: 'min(78vh, 760px)',
        borderRadius: '14px', overflow: 'hidden', background: '#fff',
        boxShadow: '0 40px 90px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.06)',
        transform: 'scale(0.985)', opacity: '0', transition: 'transform 0.35s cubic-bezier(.2,.8,.2,1), opacity 0.3s ease'
      });
      iframe = document.createElement('iframe');
      Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none', display: 'block' });
      iframe.setAttribute('title', 'Order detail');
      frame.appendChild(iframe);
      scrim.appendChild(frame);
      document.documentElement.appendChild(scrim);
      await new Promise((resolve) => {
        iframe.addEventListener('load', () => resolve(), { once: true });
        iframe.srcdoc = buildSrcdoc(template.html, template.base);
      });
    })();
    return ready;
  }

  const txt = (node, s) => { if (node) node.textContent = s; };

  function setKV(doc, key, value) {
    const rows = doc.querySelectorAll('.flex.justify-between.items-center');
    for (const row of rows) {
      const label = row.firstElementChild, val = row.lastElementChild;
      if (!label || !val || label === val || label.childElementCount > 0) continue;
      if ((label.textContent || '').trim() === key) { txt(val, value); return; }
    }
  }

  function fill(order) {
    const doc = iframe.contentDocument;
    if (!doc) return;

    // status + "Order placed on <date>"
    txt(doc.querySelector('.H3-Bold.text-color-UIText1 span') || doc.querySelector('.H3-Bold.text-color-UIText1'), order.statusText || 'Order completed');
    const placed = doc.querySelector('.P2-Regular.text-color-UIText3');
    if (placed) {
      const dateSpan = placed.querySelector('.text-color-UIText1');
      if (dateSpan) txt(dateSpan, order.dateText);
    }

    // store icon + name
    const storeImg = doc.querySelector('img.w-24.h-24');
    if (storeImg && order.shopIconSrc) { storeImg.src = order.shopIconSrc; storeImg.alt = order.shopName || ''; }
    txt(doc.querySelector('.H4-Bold.text-color-UIText1'), order.shopName || '');

    // product image + title + price — ALL scoped to the product row. (The page
    // has an earlier nav element that also matches .P1-Regular.text-color-UIText1,
    // so a document-wide query for the title would fill the wrong node.)
    const pImg = doc.querySelector('img.w-90.h-90.object-cover.rounded-4');
    if (pImg) {
      if (order.productImgSrc) pImg.src = order.productImgSrc;
      pImg.alt = order.description || '';
      const row = pImg.closest('.flex.gap-16') || pImg.parentElement;
      txt(row && row.querySelector('.P1-Regular.text-color-UIText1'), order.description || '');
      const priceRow = row && row.querySelector('.flex.justify-between.items-center');
      if (priceRow) {
        const cluster = priceRow.querySelector('.flex.items-center.gap-4') || priceRow.firstElementChild;
        const unitEl = priceRow.querySelector('.H4-Semibold.text-color-UIText1');
        const strikeEl = priceRow.querySelector('.H4-Regular.text-color-UIText3.line-through');
        txt(unitEl, order.priceText);
        if (order.isSample) {
          if (strikeEl) strikeEl.remove();      // samples carry no struck "original"
        } else if (strikeEl && order.strikeText) {
          txt(strikeEl, order.strikeText);
        }
        // Lifepreneur retail annotation (our own UI, not TikTok's) for samples.
        if (cluster) {
          annotation = priceRow.querySelector('#life-retail-note');
          if (order.isSample) {
            if (!annotation) {
              annotation = doc.createElement('span');
              annotation.id = 'life-retail-note';
              Object.assign(annotation.style, {
                marginLeft: '10px', fontSize: '12px', fontWeight: '700', color: ACCENT,
                background: 'rgba(232,101,10,0.10)', border: '1px solid rgba(232,101,10,0.30)',
                padding: '2px 9px', borderRadius: '99px', whiteSpace: 'nowrap', fontFamily: 'sans-serif'
              });
              cluster.appendChild(annotation);
            }
            annotation.textContent = order.retailText ? ('Free sample · est. retail ' + order.retailText) : 'Free sample · valuing…';
          } else if (annotation) {
            annotation.remove(); annotation = null;
          }
        }
      }
    }

    // order-info card date value
    setKV(doc, 'Order date', order.dateText);

    // bring the product/price block into view
    try {
      const anchor = doc.querySelector('img.w-90.h-90.object-cover.rounded-4');
      if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'center' });
    } catch (_) {}
  }

  function show(order) {
    if (!iframe) return;
    fill(order);
    scrim.style.opacity = '1';
    // quick pop so each order reads as a freshly-opened detail view
    frame.style.transition = 'none';
    frame.style.opacity = '0.35'; frame.style.transform = 'scale(0.985)';
    requestAnimationFrame(() => {
      frame.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.2,1), opacity 0.3s ease';
      frame.style.opacity = '1'; frame.style.transform = 'scale(1)';
    });
  }

  function setRetail(text) {
    if (annotation) annotation.textContent = 'Free sample · est. retail ' + text;
  }

  function hide() {
    if (scrim) { scrim.style.opacity = '0'; }
    if (frame) { frame.style.opacity = '0'; frame.style.transform = 'scale(0.985)'; }
  }

  function destroy() {
    if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim);
    scrim = frame = iframe = ready = annotation = null;
  }

  window.LifeTemplate = { ensure, show, setRetail, hide, destroy };
})();
