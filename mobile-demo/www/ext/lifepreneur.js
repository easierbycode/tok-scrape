console.log('[LP-ext] lifepreneur.js starting');
// Lifepreneur — "Sample Value" overlay.
//
// A vanilla-JS + Shadow-DOM port of the Claude Design handoff
// (Lifepreneur Sample Value.html / app.jsx / states.jsx / components.jsx).
// The prototype was React-via-CDN; injecting React+Babel into a content script
// is heavy and the README explicitly says to "recreate pixel-perfectly in
// whatever tech fits the target." A content script fits a Shadow DOM with inline
// styles (the prototype already styles everything inline) + one constructed
// stylesheet for the design tokens, keyframes and webfonts.
//
// Exposes window.Lifepreneur with three surfaces the orchestrator drives:
//   scanStart/scanUpdate/scanStop  — the top "Scanning" HUD shown during the loop
//   showResults({samples, model})  — the design's Results state (total valuation)
//   showQueued({samples, model})   — the design's Queued/24h state (fallback)
// All money is scoped to this feature only (the club's own initiative).
(function () {
  if (window.__LifepreneurLoaded) return;
  window.__LifepreneurLoaded = true;

  const Z = 2147483600; // sit above the host page + the order-detail template
  const ACCENT = '#e8650a';

  // ---- formatting -----------------------------------------------------------
  const money = (n, dp = 2) =>
    n == null ? '—'
    : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const money0 = (n) => money(n, 0);

  // ---- tiny DOM builders ----------------------------------------------------
  function el(tag, style, props) {
    const n = document.createElement(tag);
    if (style) Object.assign(n.style, style);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    return n;
  }
  const add = (parent, ...kids) => { for (const k of kids) if (k != null) parent.appendChild(k); return parent; };
  function svg(tag, attrs) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ---- design tokens + keyframes (constructed stylesheet, CSP-proof) ---------
  const TOKENS = `
  :host{
    --accent:${ACCENT};
    --accent-2:color-mix(in oklab, ${ACCENT} 78%, #fff);
    --gold:#f5b73c; --gold-soft:rgba(245,183,60,0.14);
    --bg:#0b0d11; --surface:#14171e; --surface-2:#1b1f28; --surface-3:#232834;
    --line:rgba(255,255,255,0.09); --line-strong:rgba(255,255,255,0.16);
    --text:#f5f7f9; --text-dim:#99a2af; --text-faint:#6a727f;
    --accent-soft:color-mix(in oklab, var(--accent) 16%, transparent);
    --accent-line:color-mix(in oklab, var(--accent) 38%, transparent);
    --radius:18px; --radius-sm:12px;
    --shadow:0 30px 80px -20px rgba(0,0,0,0.6), 0 10px 30px -10px rgba(0,0,0,0.5);
    --font-display:'Space Grotesk',system-ui,sans-serif;
    --font-body:'Figtree',system-ui,sans-serif;
    all: initial;
    font-family: var(--font-body);
    color: var(--text);
  }
  *{ box-sizing:border-box; }
  .tnum{ font-variant-numeric: tabular-nums; font-feature-settings:"tnum" 1; }
  ::-webkit-scrollbar{ width:10px; height:10px; }
  ::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.14); border-radius:99px; border:2px solid transparent; background-clip:padding-box; }
  ::-webkit-scrollbar-track{ background:transparent; }
  button{ font-family: var(--font-body); }
  @keyframes lifeFadeUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:none;} }
  @keyframes lifeSpin{ to{ transform:rotate(360deg);} }
  @keyframes lifePulse{ 0%,100%{opacity:.4;} 50%{opacity:1;} }
  @keyframes lifeSweep{ 0%{transform:translateX(-100%);} 100%{transform:translateX(220%);} }
  @keyframes lifeBob{ 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
  @media (prefers-reduced-motion: reduce){ *{ animation-duration:.001ms !important; animation-iteration-count:1 !important; } }
  `;

  // Webfonts are global; load once into the host document head (CSP is open on
  // GitHub Pages). If they ever fail, the system-ui fallback keeps it legible.
  function ensureFonts() {
    if (document.getElementById('life-fonts')) return;
    const l = el('link', null, {
      id: 'life-fonts', rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Figtree:wght@400;500;600;700;800&display=swap'
    });
    document.head && document.head.appendChild(l);
  }

  // ---- shadow host ----------------------------------------------------------
  let host, shadow;
  function ensureHost() {
    if (shadow) return shadow;
    ensureFonts();
    host = el('div', { position: 'fixed', inset: '0', zIndex: String(Z), pointerEvents: 'none' });
    host.id = 'lifepreneur-overlay-host';
    shadow = host.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(TOKENS);
      shadow.adoptedStyleSheets = [sheet];
    } catch (_) {
      // very old engines: fall back to a <style> (no page CSP to fight here)
      add(shadow, el('style', null, { text: TOKENS }));
    }
    // documentElement, not body — survives any host-app body re-render.
    document.documentElement.appendChild(host);
    return shadow;
  }

  // ---- shared primitives ----------------------------------------------------
  function Logo(size) {
    size = size || 30;
    const mark = el('div', {
      width: size + 'px', height: size + 'px', borderRadius: '9px', position: 'relative',
      background: 'linear-gradient(150deg, var(--accent-2), var(--accent))',
      display: 'grid', placeItems: 'center', flexShrink: '0',
      boxShadow: '0 6px 16px -6px var(--accent)'
    });
    const s = svg('svg', { width: size * 0.56, height: size * 0.56, viewBox: '0 0 24 24', fill: 'none' });
    add(s,
      svg('path', { d: 'M5 14.5 L10 9 L13.5 12.5 L19 6.5', stroke: '#06130d', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      svg('path', { d: 'M14.5 6.5 L19 6.5 L19 11', stroke: '#06130d', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    );
    add(mark, s);
    const word = el('div', { lineHeight: '1' });
    const name = el('div', { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px', letterSpacing: '-0.01em' });
    name.innerHTML = 'Life<span style="color:var(--accent)">preneur</span>';
    add(word, name);
    return add(el('div', { display: 'flex', alignItems: 'center', gap: '10px' }), mark, word);
  }

  function Pill(text, tone, soft, extra) {
    if (soft == null) soft = true;
    const map = {
      accent: ['var(--accent)', 'var(--accent-soft)'],
      gold: ['var(--gold)', 'var(--gold-soft)'],
      dim: ['var(--text-dim)', 'rgba(255,255,255,0.06)']
    };
    const [fg, bg] = map[tone] || map.accent;
    const style = {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11.5px', fontWeight: '600', letterSpacing: '0.02em',
      color: soft ? fg : '#06130d', background: soft ? bg : fg,
      padding: '3px 9px', borderRadius: '99px', whiteSpace: 'nowrap',
      border: soft ? '1px solid color-mix(in oklab, ' + fg + ' 26%, transparent)' : 'none'
    };
    if (extra) Object.assign(style, extra);
    const p = el('span', style, { class: 'tnum' });
    if (typeof text === 'string') p.textContent = text; else add(p, text);
    return p;
  }

  function Thumb(tone, label, size, radius) {
    tone = tone || 'var(--accent)'; size = size || 56; radius = radius || 12;
    const initials = (label || '').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    return el('div', {
      width: size + 'px', height: size + 'px', borderRadius: radius + 'px', flexShrink: '0',
      background: 'linear-gradient(135deg, ' + tone + ', color-mix(in oklab, ' + tone + ' 55%, #000))',
      display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.92)',
      fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: (size * 0.3) + 'px',
      letterSpacing: '0.02em', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)'
    }, { text: initials });
  }

  function ConfidenceDot(level) {
    const c = level === 'high' ? 'var(--accent)' : level === 'med' ? 'var(--gold)' : 'var(--text-faint)';
    return el('span', { width: '7px', height: '7px', borderRadius: '99px', background: c, display: 'inline-block', flexShrink: '0' });
  }

  function SectionLabel(text, right) {
    const row = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 12px' });
    add(row, el('div', { fontSize: '11.5px', fontWeight: '700', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-faint)' }, { text }));
    if (right) add(row, right);
    return row;
  }

  function countUp(node, target, opts) {
    opts = opts || {};
    const dur = opts.duration || 1100;
    const fmt = opts.format || money;
    let start = null, raf = 0;
    const step = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Guarantee the final value lands even if rAF is throttled (bg tab etc).
    setTimeout(() => { cancelAnimationFrame(raf); node.textContent = fmt(target); }, dur + 140);
  }

  // ---- summary --------------------------------------------------------------
  function summarize(samples) {
    const resolved = samples.filter(s => s.resolved);
    const round2 = (x) => Math.round(x * 100) / 100;
    return {
      count: samples.length,
      resolvedCount: resolved.length,
      pendingCount: samples.length - resolved.length,
      resolvedValue: round2(resolved.reduce((a, s) => a + (s.retail || 0), 0)),
      totalValue: round2(samples.reduce((a, s) => a + (s.retail || 0), 0)),
      paid: samples.reduce((a, s) => a + (s.paid || 0), 0)
    };
  }

  // ---- share-image capture (SVG foreignObject → canvas → PNG) ----------------
  // The share card is built entirely from inline styles, so a deep clone plus
  // the design tokens (rescoped from :host to a class) re-renders pixel-exact
  // inside a foreignObject. Webfonts must be inlined as data: URLs — external
  // fetches are blocked while an SVG image rasterizes.
  let fontCssPromise = null;
  function embeddedFontCss() {
    if (fontCssPromise) return fontCssPromise;
    const attempt = (async () => {
      const link = document.getElementById('life-fonts');
      if (!link || !link.href) return '';
      const css = await (await fetch(link.href)).text();
      const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
      const out = [];
      for (const block of blocks) {
        const range = block.match(/unicode-range:\s*([^;]+);/i);
        if (range && !/U\+0000/i.test(range[1])) continue; // latin subset only
        const u = block.match(/url\((https:[^)]+)\)/i);
        if (!u) continue;
        const bytes = new Uint8Array(await (await fetch(u[1])).arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        out.push(block.replace(u[1], 'data:font/woff2;base64,' + btoa(bin)));
      }
      return out.join('\n');
    })();
    // Timebox the font fetches: the result is cached for the page's lifetime,
    // so a stalled network here must degrade to system fonts (and allow a
    // retry on the next capture), never wedge every future capture.
    fontCssPromise = Promise.race([
      attempt,
      new Promise((res) => setTimeout(() => res(null), 4000))
    ]).then((css) => {
      if (css == null) { fontCssPromise = null; return ''; }
      return css;
    }).catch(() => { fontCssPromise = null; return ''; });
    return fontCssPromise;
  }

  // External <img> srcs never load while an SVG image rasterizes (same secure
  // static mode that blocks external fonts) — inline them as data: URLs, or
  // drop the node so its styled fallback shows instead of a blank box.
  function inlineCloneImages(clone) {
    const imgs = Array.prototype.slice.call(clone.querySelectorAll('img'));
    return Promise.all(imgs.map((im) => {
      const src = im.getAttribute('src') || '';
      if (!src || src.lastIndexOf('data:', 0) === 0) return Promise.resolve();
      const strip = () => { if (im.parentNode) im.parentNode.removeChild(im); };
      return Promise.race([
        (async () => {
          const blob = await (await fetch(im.src)).blob();
          const dataUrl = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
          im.setAttribute('src', dataUrl);
        })(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('img inline timeout')), 2500))
      ]).catch(strip);
    }));
  }

  function captureCard(dialog) {
    return embeddedFontCss().then((fontCss) => {
      // offsetWidth, not getBoundingClientRect: the entrance transform
      // (scale 0.96) is still running if the user taps share immediately
      const W = Math.max(300, dialog.offsetWidth || 400);
      const clone = dialog.cloneNode(true);
      clone.querySelectorAll('[data-life-nocapture]').forEach((n) => n.parentNode.removeChild(n));
      // un-clip: the live card scrolls; the image shows the full content.
      // box-sizing inline: the rescoped tokens' `all: initial` would otherwise
      // beat the `*` border-box rule inside the SVG but not during measurement
      Object.assign(clone.style, { width: W + 'px', maxHeight: 'none', height: 'auto', opacity: '1', transform: 'none', transition: 'none', position: 'static', margin: '0', boxSizing: 'border-box' });
      clone.classList.add('life-cap-root');
      clone.querySelectorAll('[data-life-scroll]').forEach((n) => { n.style.overflow = 'visible'; n.style.maxHeight = 'none'; });
      return inlineCloneImages(clone).then(() => new Promise((resolve, reject) => {
      // measure full height inside the shadow root, where the tokens resolve
      const sh = ensureHost();
      const meas = el('div', { position: 'fixed', left: '-100000px', top: '0', width: W + 'px', pointerEvents: 'none' });
      meas.appendChild(clone);
      sh.appendChild(meas);
      const H = Math.ceil(clone.getBoundingClientRect().height) + 1;
      sh.removeChild(meas);
      const css = TOKENS.replace(':host', '.life-cap-root') + '\n' + fontCss;
      const xhtml = new XMLSerializer().serializeToString(clone);
      const svgSrc = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
        '<style>' + css + '</style>' +
        '<foreignObject width="100%" height="100%">' + xhtml + '</foreignObject></svg>';
      let settled = false;
      const ok = (v) => { if (!settled) { settled = true; resolve(v); } };
      const fail = (why) => { if (!settled) { settled = true; reject(new Error(why)); } };
      setTimeout(() => fail('share-image rasterize timed out'), 10000);
      const img = new Image();
      img.onload = () => {
        const draw = () => {
          try {
            // mobile GPUs cap canvas textures (often 4096px) and overflow is a
            // silent blank PNG — clamp the export scale to stay under it
            const scale = Math.min(Math.min(3, Math.max(2, window.devicePixelRatio || 1)), 4000 / H, 4000 / W);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(W * scale);
            canvas.height = Math.round(H * scale);
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, W, H);
            ok(canvas.toDataURL('image/png'));
          } catch (e) { if (!settled) { settled = true; reject(e); } }
        };
        // decode + a frame before drawing — engines can fire onload before the
        // SVG subresources (embedded fonts) are ready, yielding partial renders.
        // draw is idempotent and scheduled via BOTH rAF and a timer: rAF never
        // fires while the page is hidden/occluded (background WebView), which
        // would otherwise wedge the capture forever.
        const after = () => { requestAnimationFrame(draw); setTimeout(draw, 250); };
        if (img.decode) { img.decode().then(after, after); setTimeout(after, 500); } else after();
      };
      img.onerror = () => fail('share-image rasterize failed');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSrc);
      }));
    });
  }

  // ---- share plumbing ---------------------------------------------------------
  function sendToHost(msg, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => finish(null), timeoutMs || 2500);
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          try { if (chrome.runtime.lastError) return finish(null); } catch (_) {}
          finish(resp || null);
        });
      } catch (_) { finish(null); }
    });
  }

  function dataUrlToFile(dataUrl, name) {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png' });
  }

  async function shareImage(dataUrl, text) {
    // 1) native share via the Cordova host — opens the Facebook app directly.
    // Generous timeout: the multi-MB data URL takes a while to cross the
    // bridge on slow devices, and a premature fallback would double the share
    // UI (the host can't be cancelled once the message is posted). Contexts
    // without a host resolve instantly via the catch/lastError paths.
    const resp = await sendToHost({ source: 'life-demo', type: 'share-image', dataUrl, text }, 8000);
    if (resp && resp.ok) return { via: resp.via || 'native' };
    // 2) Web Share API with the image attached (share sheet)
    try {
      const file = dataUrlToFile(dataUrl, 'lifepreneur-free-samples.png');
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return { via: 'webshare' };
      }
    } catch (e) { if (e && e.name === 'AbortError') return { via: 'cancelled' }; }
    // Inside the InAppBrowser the download fallback can't work (the host drops
    // the download event) and window.open('_blank') would navigate THIS
    // webview to a Facebook login wall, killing the demo — fail honestly.
    if (window.cordova_iab || (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab)) {
      return { via: 'unavailable' };
    }
    // 3) browser only: save the PNG + open Facebook's share dialog (URL-only —
    // sharer.php can't carry a local image, so the user attaches the saved PNG)
    const a = el('a', null, { href: dataUrl, download: 'lifepreneur-free-samples.png' });
    document.documentElement.appendChild(a); a.click(); a.remove();
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href), '_blank');
    return { via: 'sharer-url' };
  }

  // The host calls this if the native share fails after it already acked —
  // the only error channel once the early {ok:true} response is consumed.
  window.__lifeShareFailed = function () { toast('Sharing failed — please try again'); };

  function toast(msg) {
    const sh = ensureHost();
    const t = el('div', {
      position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(20,23,30,0.95)', color: 'var(--text)', border: '1px solid var(--line-strong)',
      padding: '10px 16px', borderRadius: '99px', fontSize: '13px', fontWeight: '600',
      zIndex: String(Z + 2), pointerEvents: 'none', opacity: '0', transition: 'opacity 0.25s ease',
      maxWidth: '86vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
    }, { text: msg });
    add(sh, t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
  }

  // ---- modal shell ----------------------------------------------------------
  let openModal = null;
  function closeModal() {
    if (openModal && openModal.parentNode) openModal.parentNode.removeChild(openModal);
    openModal = null;
    document.removeEventListener('keydown', onEsc, true);
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function ModalShell(accentRing) {
    const sh = ensureHost();
    closeModal();
    const wrap = el('div', { position: 'fixed', inset: '0', zIndex: String(Z), display: 'grid', placeItems: 'center', padding: '24px', pointerEvents: 'auto' });
    const backdrop = el('div', { position: 'absolute', inset: '0', background: 'rgba(6,8,12,0.62)', backdropFilter: 'blur(3px)', opacity: '0', transition: 'opacity 0.35s ease' }, { onclick: closeModal });
    const dialog = el('div', {
      position: 'relative', width: 'min(560px, 100%)', maxHeight: 'min(88vh, 760px)',
      background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--line-strong)',
      boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      opacity: '0', transform: 'scale(0.96) translateY(8px)',
      transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(.2,.8,.2,1)'
    }, { role: 'dialog', 'aria-modal': 'true' });
    const glow = el('div', { position: 'absolute', top: '-120px', left: '50%', transform: 'translateX(-50%)', width: '420px', height: '240px', background: 'radial-gradient(closest-side, var(--accent-soft), transparent)', pointerEvents: 'none', opacity: accentRing ? '0.9' : '0.6' });
    const header = el('header', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--line)', position: 'relative' });
    const closeBtn = el('button', {
      width: '32px', height: '32px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)',
      color: 'var(--text-dim)', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '16px'
    }, { text: '✕', 'aria-label': 'Close', onclick: closeModal });
    add(header, Logo(), closeBtn);
    add(dialog, glow, header);
    add(wrap, backdrop, dialog);
    add(sh, wrap);
    requestAnimationFrame(() => { backdrop.style.opacity = '1'; dialog.style.opacity = '1'; dialog.style.transform = 'none'; });
    openModal = wrap;
    document.addEventListener('keydown', onEsc, true);
    return { wrap, dialog, body: dialog };
  }

  // ---- Tile / ItemRow / Footer / buttons ------------------------------------
  function Tile(label, value, sub, tone) {
    const fg = tone === 'gold' ? 'var(--gold)' : 'var(--accent)';
    const box = el('div', { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '13px 14px' });
    add(box,
      el('div', { fontSize: '11px', color: 'var(--text-faint)', fontWeight: '600', letterSpacing: '0.02em' }, { text: label }),
      el('div', { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '22px', marginTop: '5px', color: fg }, { class: 'tnum', text: value }),
      el('div', { fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }, { text: sub })
    );
    return box;
  }

  function ItemRow(s, value, pending) {
    const row = el('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--line)' });
    const mid = el('div', { minWidth: '0', flex: '1' });
    const sub = el('div', { fontSize: '11.5px', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' });
    if (!pending) add(sub, ConfidenceDot(s.confidence));
    add(sub, document.createTextNode(s.store || ''));
    add(mid,
      el('div', { fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, { text: s.name }),
      sub
    );
    add(row, Thumb(s.tone, s.name, 40, 9), mid,
      pending
        ? Pill('Estimating…', 'dim', true, { fontSize: '10.5px' })
        : el('span', { fontWeight: '700', fontSize: '14px' }, { class: 'tnum', text: value }));
    return row;
  }

  function Footer(...kids) {
    const f = el('footer', { display: 'flex', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)' });
    return add(f, ...kids);
  }
  const BTN_PRIMARY = { flex: '1', padding: '12px 16px', borderRadius: '11px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px', color: '#06130d', background: 'linear-gradient(180deg, var(--accent-2), var(--accent))', boxShadow: '0 6px 16px -8px var(--accent)' };
  const BTN_GHOST = { padding: '12px 18px', borderRadius: '11px', border: '1px solid var(--line-strong)', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: 'var(--text)', background: 'transparent' };

  // ===========================================================================
  // RESULTS — the total-valuation overlay (primary deliverable)
  // ===========================================================================
  function showResults(opts) {
    const samples = opts.samples || [];
    const M = Object.assign({ weekLabel: '', accountsConnected: 2, resalePct: 0.10, monthlyMultiplier: 4.3 }, opts.model || {});
    const s = summarize(samples);
    const resale = s.totalValue * M.resalePct;

    const { dialog } = ModalShell(false);
    const scroller = el('div', { overflowY: 'auto', padding: '24px 22px 0' });

    // hero
    const hero = el('div', { textAlign: 'center', paddingBottom: '4px' });
    add(hero, Pill('● Report ready' + (M.weekLabel ? ' · ' + M.weekLabel : ''), 'accent'));
    const heroNum = el('div', {
      fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '60px', lineHeight: '1.04', marginTop: '14px',
      letterSpacing: '-0.02em', background: 'linear-gradient(180deg, #fff, color-mix(in oklab, var(--accent) 32%, #fff))',
      webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent', color: 'transparent'
    }, { class: 'tnum', text: money(0) });
    add(hero, heroNum);
    const subline = el('div', { color: 'var(--text-dim)', fontSize: '14px', marginTop: '8px', fontWeight: '500' });
    subline.innerHTML = 'in free samples this week — <span style="color:var(--text);font-weight:700">you paid ' + money(0) + '</span>';
    add(hero, subline);
    add(scroller, hero);

    // tiles
    const tiles = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '22px 0' });
    add(tiles,
      Tile('Samples corroborated', String(s.count), 'across ' + M.accountsConnected + ' accounts'),
      Tile('Avg. retail / sample', money(s.count ? s.totalValue / s.count : 0), 'vs. $0.00 paid'),
      Tile('Resale at 10%', money(resale), 'if you flip them', 'gold'),
      Tile('Monthly pace', money0(s.totalValue * M.monthlyMultiplier), "at this week's rate")
    );
    add(scroller, tiles);

    // category breakdown
    const byCat = {};
    samples.forEach(x => { byCat[x.category || 'Other'] = (byCat[x.category || 'Other'] || 0) + (x.retail || 0); });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));
    add(scroller, SectionLabel('Where the value lands'));
    const catWrap = el('div', { marginBottom: '22px' });
    cats.forEach(([name, val]) => {
      const r = el('div', { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '9px' });
      const track = el('div', { flex: '1', height: '8px', background: 'var(--surface-2)', borderRadius: '99px', overflow: 'hidden' });
      add(track, el('div', { width: ((val / maxCat) * 100) + '%', height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }));
      add(r,
        el('div', { width: '96px', fontSize: '12.5px', color: 'var(--text-dim)', fontWeight: '500', flexShrink: '0' }, { text: name }),
        track,
        el('div', { width: '56px', textAlign: 'right', fontSize: '12.5px', fontWeight: '600' }, { class: 'tnum', text: money0(val) })
      );
      add(catWrap, r);
    });
    add(scroller, catWrap);

    // itemized list
    add(scroller, SectionLabel('All ' + s.count + ' samples', el('span', { fontSize: '11px', color: 'var(--text-faint)' }, { text: 'est. retail' })));
    const list = el('div', { marginBottom: '8px' });
    samples.forEach(x => add(list, ItemRow(x, money(x.retail))));
    add(scroller, list);

    const shareBtn = el('button', BTN_GHOST, { text: 'Share', onclick: () => showShareCard(s, samples) });
    const dlBtn = el('button', BTN_PRIMARY, { text: '↓ Download full report', onclick: () => downloadReport(samples, M) });
    add(dialog, scroller, Footer(shareBtn, dlBtn));

    countUp(heroNum, s.totalValue, { duration: 1100, format: money });
  }

  function showShareCard(s, samples) {
    const { dialog } = ModalShell(false);
    const scroller = el('div', { flex: '1', overflowY: 'auto', padding: '32px 24px 8px', textAlign: 'center' }, { 'data-life-scroll': '1' });

    // Avatar + Name
    const header = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' });
    const avatar = el('div', {
      width: '64px', height: '64px', borderRadius: '99px', background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
      display: 'grid', placeItems: 'center', color: '#06130d', fontSize: '24px', fontWeight: '700',
      boxShadow: '0 0 20px var(--accent-soft)', position: 'relative', overflow: 'hidden'
    }, { text: 'K' });
    // Kyle's avatar from the fixture (resolved against the host page so it
    // works on both the deployed fixture and local previews); the gradient
    // "K" underneath stays as the fallback if the image can't load
    const avatarImg = el('img', { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' }, {
      src: new URL('orders_files/831fd8188287557752e933eac7af810a~tplv-tiktokx-cropcenter_100_100.webp', location.href).href,
      alt: 'Kyle'
    });
    avatarImg.addEventListener('error', () => avatarImg.remove());
    add(avatar, avatarImg);
    const nameLabel = el('div', { fontSize: '20px', fontWeight: '700', color: 'var(--text)' }, { text: 'Kyle got' });
    add(header, avatar, nameLabel);
    add(scroller, header);

    // Hero Total
    const hero = el('div', { marginBottom: '32px' });
    const total = el('div', {
      fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: '700', lineHeight: '1',
      letterSpacing: '-0.03em', color: 'var(--text)'
    }, { class: 'tnum', text: money(s.totalValue) });
    const sub = el('div', { fontSize: '18px', color: 'var(--text-dim)', marginTop: '8px' });
    sub.innerHTML = 'in <span style="color:var(--accent);font-weight:800">FREE</span> products';
    add(hero, total, sub);
    add(scroller, hero);

    // Product List (First 3)
    const list = el('div', { display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--line)', margin: '0 -24px 16px' });
    const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800'];
    samples.slice(0, 3).forEach((x, i) => {
      const row = el('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', background: 'var(--bg)' });
      const thumb = Thumb(x.tone || colors[i % colors.length], x.name, 48, 12);
      const mid = el('div', { flex: '1', textAlign: 'left', minWidth: '0' });
      add(mid, el('div', { fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, { text: x.name }));
      const price = el('div', { color: 'var(--accent)', fontWeight: '700', fontSize: '16px', marginLeft: '12px' }, { class: 'tnum', text: money(x.retail) });
      add(row, thumb, mid, price);
      add(list, row);
    });
    add(scroller, list);

    if (samples.length > 3) {
      add(scroller, el('div', { fontSize: '14px', color: 'var(--text-faint)', fontWeight: '600', marginBottom: '24px' }, { text: '+ ' + (samples.length - 3) + ' more free samples' }));
    }

    // Steps Box
    const steps = el('div', {
      background: 'var(--surface)', borderRadius: '16px', padding: '20px', textAlign: 'left',
      border: '1px solid var(--line)', marginBottom: '16px', margin: '0 4px 24px'
    });
    add(steps, el('div', { color: 'var(--accent)', fontWeight: '800', fontSize: '13px', letterSpacing: '0.05em', marginBottom: '12px' }, { text: '2 STEPS!' }));
    const stepRow = (n, txt) => {
      const r = el('div', { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' });
      const dot = el('div', {
        width: '20px', height: '20px', borderRadius: '99px', border: '1px solid var(--accent)',
        display: 'grid', placeItems: 'center', color: 'var(--accent)', fontSize: '11px', fontWeight: '800', flexShrink: '0'
      }, { text: String(n) });
      add(r, dot, el('div', { fontSize: '15px', fontWeight: '600', color: 'var(--text)' }, { text: txt }));
      return r;
    };
    add(steps, stepRow(1, 'Connect with an influencer agency'), stepRow(2, 'Request FREE products'));
    add(scroller, steps);

    const modalHeader = dialog.querySelector('header');
    if (modalHeader) modalHeader.style.display = 'none';
    const modalGlow = dialog.querySelector('div');
    if (modalGlow) modalGlow.style.opacity = '0.4';

    // CTA Button — lives in the card body so it's part of the shared image
    const btn = el('button', {
      width: '100%', padding: '16px', borderRadius: '99px', background: 'linear-gradient(180deg, var(--accent-2), var(--accent))',
      border: 'none', color: '#06130d', fontWeight: '800', fontSize: '16px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 0 24px'
    });
    btn.innerHTML = '✉ Message me your email';
    btn.onclick = () => { closeModal(); alert('Action: Message email'); };
    add(scroller, btn);

    // Facebook share — renders the card (message button included) to a PNG and
    // posts it; excluded from the capture itself via data-life-nocapture.
    const shareText = 'Kyle got ' + money(s.totalValue) + ' in FREE products with Lifepreneur';
    let imgPromise = null;
    const ensureImage = () => (imgPromise = imgPromise || captureCard(dialog).catch((e) => { imgPromise = null; throw e; }));

    const fbBtn = el('button', {
      width: '100%', padding: '14px', borderRadius: '99px', border: 'none', cursor: 'pointer',
      background: '#1877F2', color: '#fff', fontWeight: '800', fontSize: '15px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    }, { 'data-life-nocapture': '1' });
    const fbIcon = svg('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' });
    add(fbIcon, svg('path', { d: 'M13.4 21v-8.2h2.76l.41-3.2H13.4V7.55c0-.93.26-1.56 1.59-1.56h1.69V3.13c-.29-.04-1.3-.13-2.47-.13-2.44 0-4.12 1.5-4.12 4.23v2.36H7.33v3.2h2.76V21h3.31z', fill: '#fff' }));
    const fbLabel = el('span', null, { text: 'Share to Facebook' });
    add(fbBtn, fbIcon, fbLabel);
    fbBtn.onclick = async () => {
      if (fbBtn.disabled) return;
      fbBtn.disabled = true; fbBtn.style.opacity = '0.75'; fbLabel.textContent = 'Creating image…';
      try {
        const dataUrl = await ensureImage();
        fbLabel.textContent = 'Opening share…';
        const r = await shareImage(dataUrl, shareText);
        if (r.via === 'sharer-url') toast('Image saved — attach it to your Facebook post');
        if (r.via === 'unavailable') toast('Sharing isn’t available on this build');
        fbLabel.textContent = (r.via === 'cancelled' || r.via === 'unavailable') ? 'Share to Facebook' : '✓ Ready to post';
      } catch (e) {
        console.warn('[life-demo] share failed', e);
        toast('Couldn’t create the share image');
        fbLabel.textContent = 'Share to Facebook';
      }
      setTimeout(() => { fbLabel.textContent = 'Share to Facebook'; fbBtn.disabled = false; fbBtn.style.opacity = '1'; }, 1800);
    };
    // pre-render the image once the entrance transition settles → instant
    // share; skip if the card was already dismissed in that window
    setTimeout(() => { if (dialog.isConnected) ensureImage().catch(() => {}); }, 700);

    // the footer now only holds the share button, so exclude it wholesale —
    // otherwise the capture would end in an empty footer strip
    const foot = Footer(fbBtn);
    foot.setAttribute('data-life-nocapture', '1');
    add(dialog, scroller, foot);
  }

  function shareSummary(s, samples) {
    const txt = 'Lifepreneur — free-sample value this week: ' + money(s.totalValue) +
      ' across ' + s.count + ' samples (you paid $0.00). Resale at 10%: ' + money(s.totalValue * 0.10) + '.';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(() => {});
    }
    console.log('[life-demo] share:', txt);
  }

  function downloadReport(samples, M) {
    const rows = [['store', 'date', 'product', 'category', 'paid', 'est_retail', 'confidence']];
    samples.forEach(x => rows.push([x.store, x.date, '"' + String(x.name).replace(/"/g, '""') + '"', x.category || '', x.paid || 0, x.retail != null ? x.retail : '', x.confidence || '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = el('a', null, { href: url, download: 'lifepreneur-sample-value.csv' });
    document.documentElement.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
    console.log('[life-demo] downloaded report (' + samples.length + ' samples)');
  }

  // ===========================================================================
  // QUEUED — several unknown prices → 24h report (fallback end-state)
  // ===========================================================================
  function Step(n, title, desc, active, done, last) {
    const wrap = el('div', { display: 'flex', gap: '13px', position: 'relative' });
    if (!last) add(wrap, el('div', { position: 'absolute', left: '13px', top: '26px', bottom: '-2px', width: '2px', background: active ? 'var(--accent-line)' : 'var(--line)' }));
    const dot = el('div', {
      width: '28px', height: '28px', borderRadius: '99px', flexShrink: '0', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: '700', zIndex: '1',
      background: done ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--surface-2)',
      color: done ? '#06130d' : active ? 'var(--accent)' : 'var(--text-faint)',
      border: active && !done ? '1px solid var(--accent-line)' : 'none'
    }, { text: done ? '✓' : n });
    const txt = el('div', { paddingBottom: last ? '0' : '16px' });
    const tl = el('div', { fontSize: '13.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' });
    add(tl, document.createTextNode(title));
    if (active && !done) add(tl, el('span', { width: '6px', height: '6px', borderRadius: '99px', background: 'var(--accent)', animation: 'lifePulse 1.2s ease-in-out infinite' }));
    add(txt, tl, el('div', { fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: '1.45' }, { text: desc }));
    return add(wrap, dot, txt);
  }

  function NotifyRow(label, value, on) {
    const row = el('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' });
    const left = el('div', { flex: '1' });
    add(left, el('div', { fontSize: '13.5px', fontWeight: '600' }, { text: label }), el('div', { fontSize: '12px', color: 'var(--text-dim)', marginTop: '1px' }, { text: value }));
    let state = !!on;
    const knob = el('span', { position: 'absolute', top: '3px', left: state ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '99px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' });
    const toggle = el('button', { width: '44px', height: '26px', borderRadius: '99px', border: 'none', cursor: 'pointer', position: 'relative', background: state ? 'var(--accent)' : 'var(--surface-3)', transition: 'background 0.2s' }, {
      'aria-pressed': String(state),
      onclick: () => { state = !state; toggle.style.background = state ? 'var(--accent)' : 'var(--surface-3)'; knob.style.left = state ? '21px' : '3px'; toggle.setAttribute('aria-pressed', String(state)); }
    });
    add(toggle, knob);
    return add(row, left, toggle);
  }

  function showQueued(opts) {
    const samples = opts.samples || [];
    const M = Object.assign({ resalePct: 0.10 }, opts.model || {});
    const s = summarize(samples);
    const { dialog } = ModalShell(true);
    const scroller = el('div', { overflowY: 'auto', padding: '24px 22px 0' });

    // status banner
    const banner = el('div', { display: 'flex', gap: '14px', alignItems: 'center', padding: '16px', background: 'var(--gold-soft)', border: '1px solid color-mix(in oklab, var(--gold) 30%, transparent)', borderRadius: 'var(--radius-sm)', marginBottom: '20px' });
    const clock = el('div', { width: '42px', height: '42px', borderRadius: '11px', background: 'var(--gold)', display: 'grid', placeItems: 'center', flexShrink: '0', animation: 'lifeBob 2.4s ease-in-out infinite' });
    const cs = svg('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' });
    add(cs, svg('path', { d: 'M12 7v5l3 2', stroke: '#1c1505', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), svg('circle', { cx: 12, cy: 12, r: 8.5, stroke: '#1c1505', 'stroke-width': '2.2' }));
    add(clock, cs);
    const btext = el('div');
    const bsub = el('div', { fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: '1.45' });
    bsub.innerHTML = 'They have no listed price or link, so we’ll match them against retail databases. Your full report is ready within <b style="color:var(--text)">24 hours</b>.';
    add(btext, el('div', { fontWeight: '700', fontSize: '15px' }, { text: s.pendingCount + ' samples need a deeper look' }), bsub);
    add(banner, clock, btext);
    add(scroller, banner);

    // valued-now / queued split
    const split = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' });
    const a1 = el('div', { background: 'var(--surface)', border: '1px solid var(--accent-line)', borderRadius: 'var(--radius-sm)', padding: '14px' });
    add(a1, Pill('✓ Valued now', 'accent', true, { marginBottom: '8px' }), el('div', { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '26px', color: 'var(--accent)' }, { class: 'tnum', text: money(s.resolvedValue) }), el('div', { fontSize: '12px', color: 'var(--text-dim)', marginTop: '3px' }, { text: s.resolvedCount + ' samples confirmed' }));
    const a2 = el('div', { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '14px' });
    add(a2, Pill('⏳ In the queue', 'gold', true, { marginBottom: '8px' }), el('div', { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '26px', color: 'var(--text-dim)' }, { class: 'tnum', text: String(s.pendingCount) }), el('div', { fontSize: '12px', color: 'var(--text-dim)', marginTop: '3px' }, { text: 'samples being matched' }));
    add(split, a1, a2);
    add(scroller, split);

    add(scroller, SectionLabel('What happens next'));
    const tl = el('div', { marginBottom: '20px' });
    add(tl,
      Step('1', 'Queued', 'Your unmatched samples are sent for deep retail matching.', true, true, false),
      Step('2', 'Matching against retail data', 'Image + description matched to live catalog prices.', true, false, false),
      Step('3', 'Report delivered', 'Full corroborated value lands — typically well under 24h.', false, false, true)
    );
    add(scroller, tl);

    add(scroller, SectionLabel('Notify me when it’s ready'));
    const notif = el('div', { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', marginBottom: '18px' });
    add(notif, NotifyRow('Email', 'member@lifepreneur.club', true), el('div', { height: '1px', background: 'var(--line)' }), NotifyRow('Push notification', 'Browser & mobile app', false));
    add(scroller, notif);

    add(scroller, SectionLabel(s.pendingCount + ' samples in the queue'));
    const pend = el('div', { marginBottom: '8px' });
    samples.filter(x => !x.resolved).forEach(x => add(pend, ItemRow(x, null, true)));
    add(scroller, pend);

    let done = false;
    const closeBtn = el('button', BTN_GHOST, { text: 'Close', onclick: closeModal });
    const notifyBtn = el('button', BTN_PRIMARY, { text: 'Notify me in ≤24h' });
    notifyBtn.addEventListener('click', () => { done = true; notifyBtn.textContent = '✓ You’re all set — we’ll email you'; notifyBtn.style.opacity = '0.7'; });
    add(dialog, scroller, Footer(closeBtn, notifyBtn));
  }

  // ===========================================================================
  // SCANNING HUD — compact top dock shown while the loop runs
  // ===========================================================================
  let hud = null;
  const R = 16, CIRC = 2 * Math.PI * R;
  function scanStart(total) {
    const sh = ensureHost();
    if (hud && hud.root.parentNode) hud.root.parentNode.removeChild(hud.root);

    const root = el('div', {
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%) translateY(-8px)',
      zIndex: String(Z + 1), display: 'flex', alignItems: 'center', gap: '14px',
      padding: '10px 16px 10px 12px', borderRadius: '99px',
      background: 'rgba(11,13,17,0.92)', border: '1px solid var(--line-strong)',
      backdropFilter: 'blur(8px)', boxShadow: '0 12px 30px -10px rgba(0,0,0,0.55)',
      pointerEvents: 'auto', opacity: '0', transition: 'opacity 0.3s ease, transform 0.3s ease', maxWidth: '92vw'
    });

    // mini progress ring
    const ringWrap = el('div', { position: 'relative', width: '40px', height: '40px', flexShrink: '0' });
    const s = svg('svg', { width: 40, height: 40 }); s.style.transform = 'rotate(-90deg)';
    add(s, svg('circle', { cx: 20, cy: 20, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': '4' }));
    const prog = svg('circle', { cx: 20, cy: 20, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC });
    prog.style.transition = 'stroke-dashoffset 0.35s ease';
    add(s, prog);
    const ringNum = el('div', { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '12px' }, { class: 'tnum', text: '0' });
    add(ringWrap, s, ringNum);

    // middle column: title + current item
    const mid = el('div', { minWidth: '0', display: 'flex', flexDirection: 'column', gap: '3px' });
    const title = el('div', { display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '13px' });
    add(title, document.createTextNode('Valuing free samples'), Pill('0/' + total, 'accent', true, { fontSize: '10.5px' }));
    // a fresh pill node for the count so we can swap it
    const countPill = title.lastChild;
    const cur = el('div', { fontSize: '11.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }, { text: 'Reading your order list…' });
    // shimmer scan bar
    const barWrap = el('div', { width: '100%', height: '3px', borderRadius: '99px', background: 'var(--surface-2)', overflow: 'hidden', position: 'relative', marginTop: '1px' });
    add(barWrap, el('div', { position: 'absolute', inset: '0', width: '40%', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', animation: 'lifeSweep 1.1s linear infinite' }));
    add(mid, title, cur, barWrap);

    // running valued total
    const divider = el('div', { width: '1px', height: '30px', background: 'var(--line)', flexShrink: '0' });
    const totWrap = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: '0' });
    const totNum = el('div', { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px', color: 'var(--accent)' }, { class: 'tnum', text: money(0) });
    add(totWrap, totNum, el('div', { fontSize: '10px', color: 'var(--text-faint)', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }, { text: 'valued' }));
    add(root, ringWrap, mid, divider, totWrap);
    add(sh, root);
    requestAnimationFrame(() => { root.style.opacity = '1'; root.style.transform = 'translateX(-50%) translateY(0)'; });

    hud = { root, prog, ringNum, countPill, cur, totNum, total };
    return hud;
  }

  function scanUpdate(o) {
    if (!hud) return;
    const total = hud.total || 1;
    if (o.n != null) {
      const pct = Math.min(1, o.n / total);
      hud.prog.setAttribute('stroke-dashoffset', String(CIRC * (1 - pct)));
      hud.ringNum.textContent = String(o.n);
      const fresh = Pill(o.n + '/' + total, 'accent', true, { fontSize: '10.5px' });
      hud.countPill.replaceWith(fresh); hud.countPill = fresh;
    }
    if (o.label != null) hud.cur.textContent = o.label;
    if (o.runningTotal != null) hud.totNum.textContent = money(o.runningTotal);
  }

  function scanStop() {
    if (!hud) return;
    const h = hud; hud = null;
    h.root.style.opacity = '0';
    h.root.style.transform = 'translateX(-50%) translateY(-8px)';
    setTimeout(() => { if (h.root.parentNode) h.root.parentNode.removeChild(h.root); }, 320);
  }

  window.Lifepreneur = {
    scanStart, scanUpdate, scanStop,
    showResults, showQueued, close: closeModal,
    _summarize: summarize, _money: money, _captureCard: captureCard
  };
})();
