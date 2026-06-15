// Orchestrator — runs the whole show on the supported order-list fixture
// currently loaded in the tab (localhost or easierbycode.com).
//
// 1. Snapshot every order card (store, icon, product description, date, status).
//    Two dialects: the SSR orders.html fixture (tux/H4 classes, no prices on
//    cards) and the in-app webview render orders-wizard.html (imdcf-* classes,
//    real "N items: USD x.xx" order totals).
// 2. Split samples from paid orders. Wizard cards carry real totals, so a
//    cheap, non-canceled order IS the free sample; orders.html has no prices,
//    so it keeps the deterministic ~9-of-10 split.
// 3. For each order in turn: flash its "View order details" button, open the
//    order.html template filled with that order's data (samples show $0.00 with
//    the struck price removed), and tick the Lifepreneur scanning HUD.
// 4. For each sample, look up its retail value on shop.tiktok.com (via the
//    background relay) by its description; fall back to an estimate when TikTok
//    can't be parsed, so the tally always completes.
// 5. Show the Lifepreneur "Sample Value" overlay with the total valuation.
(function () {
  const myRun = (window.__lifeRun = (window.__lifeRun || 0) + 1);
  const alive = () => window.__lifeRun === myRun;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const CARD_SEL = 'div.flex.flex-col.gap-12.background-color-UIPageFlat1.p-16.rounded-6.cursor-pointer.shadow';
  // orders-wizard.html (in-app webview snapshot). The class suffixes are CSS-module
  // hashes, so match on the stable prefixes only.
  const WIZARD_CARD_SEL = '[class*="item-wrapper_"]';
  // Wizard orders carry real totals; at or below this an order is a free sample
  // (creator samples are charged a token amount, the fixture medians ~$1.84).
  const SAMPLE_PRICE_MAX = 5;
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const money = (n, dp = 2) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function persistedProductId(desc) { return '900' + String(hash(clean(desc))).padStart(10, '0'); }

  const CENTS = [0.99, 0.49, 0.95, 0.89, 0.97, 0.99, 0.95, 0.79];
  function estRetail(desc) { const h = hash('r' + desc); return (8 + (h % 42)) + CENTS[h % CENTS.length] - 1 + 0.0; }
  function paidPrice(desc) { const h = hash('p' + desc); return (19 + (h % 71)) + CENTS[(h >> 3) % CENTS.length] - 1; }
  const TONES = ['#7c5cff', '#19c37d', '#2bb3d4', '#f5a623', '#e0517a', '#e8650a'];
  const tone = (desc) => TONES[hash(desc) % TONES.length];

  const CATS = [
    ['Personal care', /serum|lotion|toothpaste|shampoo|skin|cream|balm|deodorant|moistur|soap.*body|face|hair/i],
    ['Household', /trash|toilet|paper towel|dish|detergent|cleaner|cleaning|laundry|wipes|sponge|garbage|napkin/i],
    ['Grocery', /coffee|protein|olive oil|snack|tea|gummies|gummy|probiotic|supplement|vitamin|drink|water|nutrition|honey|sauce|seasoning|bar\b|powder/i],
    ['Electronics', /cable|charger|usb|led|bulb|headphone|earbud|battery|power bank|camera|charging|softbox|light|speaker|adapter|webcam/i],
    ['Home goods', /bowl|candle|kitchen|mug|decor|organizer|storage|furniture|lamp|rug|pillow|blanket|curtain|towel|holder|rack/i],
    ['Apparel', /socks|shirt|wool|hat|gloves|apparel|clothing|shoe|legging|jacket|hoodie|dress|underwear/i],
    ['Pet', /\bdog\b|\bcat\b|\bpet\b|treats|leash|litter/i],
    ['Beauty', /makeup|lipstick|\blip\b|nail|brush|mascara|foundation|eyeshadow|beauty/i]
  ];
  function category(desc) { for (const [name, re] of CATS) if (re.test(desc)) return name; return 'Other'; }

  // "Ordered on Mar 17" -> "Mar 17, 2026"
  function dateText(raw) {
    const m = clean(raw).replace(/^ordered on\s*/i, '');
    return m ? (/\d{4}/.test(m) ? m : m + ', 2026') : 'Recently';
  }
  function shortName(desc) { const d = clean(desc); return d.length > 42 ? d.slice(0, 42) + '…' : d; }

  // ---- snapshot --------------------------------------------------------------
  function snapshotOrdersHtml() {
    const cards = Array.prototype.slice.call(document.querySelectorAll(CARD_SEL));
    return cards.map((card, i) => {
      const iconImg = card.querySelector('img.w-20.h-20') || card.querySelector('.flex.items-center.gap-8 img');
      const nameEl = card.querySelector('.H4-Semibold.text-color-UIText1');
      const dateEl = card.querySelector('.P3-Regular.text-color-UIText2');
      const statusEl = card.querySelector('.H4-Bold.text-color-UIText1');
      const prodImg = card.querySelector('div.relative.flex-shrink-0.w-80.h-80 img[alt]') || card.querySelector('img.w-full[alt]');
      let btn = null;
      card.querySelectorAll('button, .tux-button__content-naVKgq').forEach(b => { if (!btn && /view order details/i.test(b.textContent || '')) btn = b.closest('[data-testid="tux-web-button-container"]') || b.closest('button') || b; });
      const description = prodImg ? clean(prodImg.getAttribute('alt')) : '';
      return {
        i,
        shopName: nameEl ? clean(nameEl.textContent) : 'Shop',
        shopIconSrc: iconImg ? iconImg.src : '',
        description: description || 'Sample item',
        productImgSrc: prodImg ? prodImg.src : '',
        dateText: dateText(dateEl ? dateEl.textContent : ''),
        statusText: statusEl ? clean(statusEl.textContent) : 'Order completed',
        buttonRef: btn, cardRef: card
      };
    }).filter(o => o.description);
  }

  // orders-wizard.html: every card carries exactly two imdcf-base-img images
  // (shop icon, then product), two text-p2 spans (shop name, then status), one
  // bold text-p3 (description), one text-color-4 (variant) and one text-t1
  // total ("N items: USD x.xx"). No dates and no detail buttons on this page.
  function snapshotWizard() {
    const cards = Array.prototype.slice.call(document.querySelectorAll(WIZARD_CARD_SEL));
    return cards.map((card, i) => {
      const imgs = card.querySelectorAll('img.imdcf-base-img');
      const heads = card.querySelectorAll('[class*="imdcf-text-p2"] span');
      const descEl = card.querySelector('[class*="imdcf-text-color-1"][class*="imdcf-text-p3"] span');
      const variantEl = card.querySelector('[class*="imdcf-text-color-4"] span');
      const totalEl = card.querySelector('[class*="imdcf-text-t1"] span');
      const m = totalEl ? clean(totalEl.textContent).match(/(\d+)\s*items?:\s*USD\s*([0-9]+(?:\.[0-9]+)?)/i) : null;
      const status = heads.length > 1 ? clean(heads[1].textContent) : 'Completed';
      return {
        i,
        shopName: heads.length ? clean(heads[0].textContent) : 'Shop',
        shopIconSrc: imgs.length ? imgs[0].src : '',
        description: descEl ? clean(descEl.textContent) : '',
        variantText: variantEl ? clean(variantEl.textContent) : '',
        productImgSrc: imgs.length > 1 ? imgs[1].src : '',
        dateText: dateText(''),
        statusText: 'Order ' + status.toLowerCase(),
        parsedPaid: m ? parseFloat(m[2]) : null,
        qty: m ? parseInt(m[1], 10) : 1,
        buttonRef: null, cardRef: card
      };
    }).filter(o => o.description);
  }

  let orders = snapshotOrdersHtml();
  if (!orders.length) orders = snapshotWizard();
  if (!orders.length) {
    console.warn('[life-demo] no order cards found — is this an orders fixture?');
    return;
  }

  // ---- assign sample / paid + value model -----------------------------------
  orders.forEach((o, i) => {
    o.isSample = o.parsedPaid != null
      ? (o.parsedPaid <= SAMPLE_PRICE_MAX && !/cancel/i.test(o.statusText))
      : ((i * 7 + 3) % 10) !== 0;               // no prices on cards: ~9 of 10, scattered
    o.tone = tone(o.description);
    o.category = category(o.description);
    if (o.isSample) {
      o.paid = o.parsedPaid || 0;
      o.retail = Math.round(estRetail(o.description) * 100) / 100;
      o.resolved = true;                         // fallback always yields a value
      o.confidence = 'med';                      // upgraded to 'high' on a real embedded hit
      o.name = o.description;
      o.store = o.shopName;
      o.date = o.dateText;
      o.img = o.productImgSrc;                   // share card shows it; lookup fills gaps
    } else {
      const p = o.parsedPaid != null ? o.parsedPaid : Math.round(paidPrice(o.description) * 100) / 100;
      o.paid = p; o.paidText = money(p);
      // Real totals get no synthetic struck-through "original" price.
      o.strikeText = o.parsedPaid != null ? null : money(Math.round((p + 2 + (hash(o.description) % 14)) * 100) / 100);
      o.retail = null;
    }
  });

  const samples = orders.filter(o => o.isSample);
  if (!samples.length) { console.warn('[life-demo] no samples after split'); return; }

  // week label from the parsed order dates (best-effort)
  const model = { weekLabel: weekLabel(orders), accountsConnected: 2, resalePct: 0.10, monthlyMultiplier: 4.3 };
  // The design frames the total as "this week"; the fixture's orders span the
  // whole year, so present a tidy 7-day window ending at the most recent order
  // rather than a Jan–Dec range that would expose the demo seam.
  function weekLabel(list) {
    const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const ds = [];
    list.forEach(o => { const m = o.dateText.match(/([A-Z][a-z]{2})\s+(\d{1,2})/); if (m && MON[m[1]] != null) ds.push(new Date(2026, MON[m[1]], +m[2]).getTime()); });
    if (!ds.length) return '';
    const latest = Math.max.apply(null, ds);
    const fmt = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric' });
    return fmt(latest - 6 * 86400000) + ' – ' + fmt(latest) + ', 2026';
  }

  // ---- real TikTok retail lookups (pooled, background relay) -----------------
  const LOOK = { done: 0, total: samples.length, real: 0 };
  let currentOrder = null;
  function lookupOne(s) {
    return new Promise((res) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; LOOK.done++; res(); };
      try {
        chrome.runtime.sendMessage({ source: 'life-demo', type: 'price-lookup', query: s.description }, (resp) => {
          if (!chrome.runtime.lastError && resp) {
            // product image from TikTok's embedded JSON — only fills the gap
            // when the order card didn't have one (the card's own image is the
            // surer match; the lookup is a description search)
            if (resp.img && !s.img) s.img = resp.img;
            if (resp.url) s.sourceUrl = resp.url;
            if (resp.ok && resp.price != null) {
              // 'embedded' = parsed from TikTok's JSON (trust as high); 'visible' =
              // a loose "$x.xx" off the page (weak signal → keep medium confidence).
              s.retail = resp.price; s.confidence = resp.tier === 'embedded' ? 'high' : 'med'; s._real = true; s.resolved = true; LOOK.real++;
              if (currentOrder === s && window.LifeTemplate) window.LifeTemplate.setRetail(money(s.retail));
            }
          }
          finish();
        });
      } catch (_) { finish(); }
    });
  }
  (function pool() {
    let idx = 0, active = 0; const CONC = 5;
    const pump = () => {
      while (active < CONC && idx < samples.length) {
        active++; lookupOne(samples[idx++]).then(() => { active--; pump(); });
      }
    };
    pump();
  })();

  const persistedSamples = new Set();
  function persistOneSample(s) {
    const price = Number(s && s.retail);
    const name = clean(s && s.description);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(price) || price <= 0 || persistedSamples.has(key)) {
      return Promise.resolve({ ok: false, skipped: true });
    }
    persistedSamples.add(key);

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return Promise.resolve({ ok: false, skipped: true });
    }

    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          source: 'life-demo',
          type: 'persist-sample-product',
          product: {
            productId: persistedProductId(name),
            name,
            price,
            sampleCount: s.qty || 1,
            category: s.category || 'Samples',
            seller: s.store || s.shopName || 'Lifepreneur extension',
            sourceUrl: s.sourceUrl,
            fetchedAt: new Date().toISOString(),
            lastSeen: s.dateText || s.date || new Date().toISOString()
            // No notes: the recovery queue's API/Extension source badge already
            // conveys provenance, so a "Resolved by extension lookup" note is noise.
          }
        }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { ok: false });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  async function persistPricedSamples(list) {
    let idx = 0, active = 0, saved = 0, failed = 0, skipped = 0;
    const CONC = 5;
    await new Promise((resolve) => {
      const pump = () => {
        if (idx >= list.length && active === 0) return resolve();
        while (active < CONC && idx < list.length) {
          active++;
          persistOneSample(list[idx++]).then((resp) => {
            if (resp && resp.skipped) skipped++;
            else if (resp && resp.ok) saved++;
            else failed++;
          }).finally(() => {
            active--;
            pump();
          });
        }
      };
      pump();
    });
    return { saved, failed, skipped };
  }

  function flashButton(o) {
    // Wizard cards have no "View order details" button — flash the card itself.
    const btn = (o.buttonRef && o.buttonRef.isConnected) ? o.buttonRef : o.cardRef;
    try { if (o.cardRef && o.cardRef.isConnected && o.cardRef.scrollIntoView) o.cardRef.scrollIntoView({ block: 'center' }); } catch (_) {}
    if (!btn || !btn.isConnected) return;
    const prev = btn.style.cssText;
    btn.style.outline = '2px solid #e8650a';
    btn.style.boxShadow = '0 0 0 4px rgba(232,101,10,0.25)';
    btn.style.borderRadius = btn === o.cardRef ? '8px' : '99px';
    setTimeout(() => { if (btn.isConnected) btn.style.cssText = prev; }, 260);
  }

  function view(o) {
    return o.isSample
      ? { shopName: o.shopName, shopIconSrc: o.shopIconSrc, description: o.description, productImgSrc: o.productImgSrc, dateText: o.dateText, statusText: o.statusText, isSample: true, priceText: money(o.paid || 0), strikeText: null, retailText: o.retail != null ? money(o.retail) : null }
      : { shopName: o.shopName, shopIconSrc: o.shopIconSrc, description: o.description, productImgSrc: o.productImgSrc, dateText: o.dateText, statusText: o.statusText, isSample: false, priceText: o.paidText, strikeText: o.strikeText, retailText: null };
  }

  async function settle(maxMs) {
    const t0 = Date.now();
    while (LOOK.done < LOOK.total && Date.now() - t0 < maxMs) await sleep(150);
  }

  // demo.js is re-injected (not load-once guarded) on every toolbar click, so a
  // second click starts a NEW run that now owns the shared LifeTemplate /
  // Lifepreneur singletons. A superseded run (alive()===false) must therefore
  // bail WITHOUT destroying that shared UI — the newest run will tear it down at
  // its own end. (Never call destroy()/scanStop() from a stale run.)

  // ---- run -------------------------------------------------------------------
  (async function run() {
    if (!window.Lifepreneur || !window.LifeTemplate) { console.warn('[life-demo] overlay/template not loaded'); return; }
    try { await window.LifeTemplate.ensure(); } catch (e) { console.warn('[life-demo] template load failed', e); }
    if (!alive()) return;

    const total = orders.length;
    const perOrder = total > 120 ? 110 : total > 40 ? 240 : total > 20 ? 320 : 460;
    window.Lifepreneur.scanStart(total);
    window.Lifepreneur.scanUpdate({ label: 'Reading your order list…' });
    await sleep(600);

    let running = 0, n = 0;
    for (const o of orders) {
      if (!alive()) return;
      currentOrder = o.isSample ? o : null;
      flashButton(o);
      window.LifeTemplate.show(view(o));
      n++;
      if (o.isSample) running += (o.retail || 0);
      window.Lifepreneur.scanUpdate({ n, label: o.shopName + ' · ' + shortName(o.description), runningTotal: running });
      await sleep(perOrder);
    }

    window.Lifepreneur.scanUpdate({ n: total, label: 'Matching remaining samples to retail…' });
    await settle(5000);
    if (!alive()) return;
    const persisted = await persistPricedSamples(samples);
    if (!alive()) return;

    console.log('[life-demo] valued ' + samples.length + ' samples · real TikTok prices: ' + LOOK.real + ', estimated: ' + (samples.length - LOOK.real));
    console.log('[life-demo] persisted priced samples to Thirsty kiosk: ' + persisted.saved + ' saved, ' + persisted.skipped + ' already saved, ' + persisted.failed + ' failed');

    window.LifeTemplate.hide();
    setTimeout(() => { if (alive()) window.LifeTemplate.destroy(); }, 420); // guarded: a newer run may now own the iframe
    window.Lifepreneur.scanStop();
    await sleep(360);
    if (!alive()) return;
    window.Lifepreneur.showResults({ samples, model });
  })();
})();
