// Free Sample Haul modal — a self-contained, in-page reveal of the retail value
// of free ($0) TikTok Shop samples collected in a period.
//
//   TOK_SAMPLES_MODAL.show(haul, { style })   // style: 'smashtv'|'showcase'|'boring'
//   TOK_SAMPLES_MODAL.close()
//   TOK_SAMPLES_MODAL.replay()                 // re-run the current style's animation
//   TOK_SAMPLES_MODAL.setStyle('showcase')
//
// `haul` matches the shape in samples-mock.js. The whole UI lives in a shadow
// root attached to a single host element, so the host page's CSS can't reach in
// and nothing here leaks out. No external assets, fonts, or network — safe to
// inject as a content script later when the real data feed exists.
//
// Three styles + a "just the numbers" boring toggle (per issue #48):
//   • smashtv  — arcade "PACKAGE BONUS" box pyramid + a green odometer counting
//                up to the total retail value.
//   • showcase — Price Is Right "showcase showdown": reveal category lots one by
//                one, the running total climbing to the ACTUAL RETAIL VALUE.
//   • boring   — clean numbers: totals, by-category bars, accounts, sample table.
(function () {
  'use strict';

  // ---- formatting & motion helpers -----------------------------------------
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf = new Intl.NumberFormat('en-US');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // Ported from member-app's use-animated-count.ts: one-shot rAF tween with
  // easeOutCubic, a cancel handle, and a reduced-motion short-circuit.
  function animateCount(from, to, durationMs, onTick, opts) {
    opts = opts || {};
    if (opts.reduced || durationMs <= 0) { onTick(to); if (opts.onDone) opts.onDone(); return function () {}; }
    var raf = null, start = null, cancelled = false;
    function tick(now) {
      if (cancelled) return;
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / durationMs);
      onTick(from + (to - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (opts.onDone) opts.onDone();
    }
    raf = requestAnimationFrame(tick);
    return function () { cancelled = true; if (raf) cancelAnimationFrame(raf); };
  }

  function fmtRange(p) {
    if (!p || !p.start || !p.end) return p && p.label ? '' : '';
    try {
      var s = new Date(p.start + 'T00:00:00'), e = new Date(p.end + 'T00:00:00');
      var mo = function (d) { return d.toLocaleString('en-US', { month: 'short' }); };
      if (s.getMonth() === e.getMonth()) return mo(s) + ' ' + s.getDate() + '–' + e.getDate();
      return mo(s) + ' ' + s.getDate() + ' – ' + mo(e) + ' ' + e.getDate();
    } catch (e2) { return ''; }
  }

  // ---- timing ---------------------------------------------------------------
  var SMASH_MS = 2400;       // odometer + pyramid fill
  var SHOWCASE_STEP = 760;   // delay between lot reveals
  var PYRAMID_ROWS = 10;     // 1+2+...+10 = 55 decorative boxes

  // ---- module state ---------------------------------------------------------
  var STYLES = ['smashtv', 'showcase', 'boring'];
  var STORAGE_KEY = 'tokSamplesBoring';
  var current = null; // { host, shadow, haul, style, fancy, cancels:[], onKey }

  function boringPref() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function setBoringPref(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
  }

  function pushCancel(fn) { if (current) current.cancels.push(fn); }
  function schedule(fn, ms) {
    var id = setTimeout(fn, ms);
    pushCancel(function () { clearTimeout(id); });
    return id;
  }
  function clearAnimations() {
    if (!current) return;
    current.cancels.forEach(function (fn) { try { fn(); } catch (e) {} });
    current.cancels = [];
  }

  // ==========================================================================
  // CSS (injected once per render into the shadow root)
  // ==========================================================================
  var CSS = [
    ':host, * { box-sizing: border-box; }',
    '.overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center;',
    '  justify-content: center; padding: 18px; background: rgba(6,6,10,.66); backdrop-filter: blur(3px);',
    "  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; animation: tok-fade .18s ease; }",
    '@keyframes tok-fade { from { opacity: 0 } to { opacity: 1 } }',
    '.panel { width: min(560px, 96vw); max-height: 94vh; display: flex; flex-direction: column;',
    '  border-radius: 16px; overflow: hidden; box-shadow: 0 28px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.06); }',

    // ---- header bar ----
    '.bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #15151b;',
    '  border-bottom: 1px solid rgba(255,255,255,.08); color: #e9e9ee; }',
    '.brand { font-weight: 800; font-size: 12.5px; letter-spacing: .5px; white-space: nowrap; flex-shrink: 0; }',
    '.period { font-size: 11px; color: #9aa; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; }',
    '.spacer { flex: 1; min-width: 4px; }',
    '.seg { display: inline-flex; flex-shrink: 0; background: #0e0e13; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; overflow: hidden; }',
    '.seg.is-boring { opacity: .45; }',
    '.segbtn { appearance: none; border: 0; background: transparent; color: #cfcfe0; font: inherit; font-size: 11.5px;',
    '  font-weight: 700; padding: 5px 9px; cursor: pointer; }',
    '.segbtn.on { background: #f54e00; color: #fff; }',
    '.btoggle { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #c7c7d2; cursor: pointer; white-space: nowrap; flex-shrink: 0; }',
    '.btoggle input { accent-color: #f54e00; }',
    '.close { appearance: none; border: 0; background: transparent; color: #9aa; font-size: 20px; line-height: 1;',
    '  cursor: pointer; padding: 2px 6px; border-radius: 6px; flex-shrink: 0; }',
    '.close:hover { background: rgba(255,255,255,.08); color: #fff; }',
    '.body { overflow: auto; }',

    // ================= SMASH TV =================
    '.smash { position: relative; padding: 22px 20px 18px; text-align: center; overflow: hidden;',
    '  background: radial-gradient(120% 90% at 50% -10%, #2a1466 0%, #140a2e 45%, #07060f 100%); color: #fff; }',
    '.smash::after { content: ""; position: absolute; inset: 0; pointer-events: none;',
    '  background: repeating-linear-gradient(rgba(0,0,0,0) 0 2px, rgba(0,0,0,.22) 2px 4px); mix-blend-mode: multiply; }',
    '.smash > * { position: relative; z-index: 1; }',
    ".smash-title { font-family: 'Arial Black', Impact, sans-serif; text-transform: uppercase; letter-spacing: 3px;",
    '  font-size: 30px; font-weight: 900; line-height: 1; color: #ffd23f;',
    '  text-shadow: 0 2px 0 #c0451b, 0 4px 0 #7a2c10, 3px 3px 0 #e53935, 0 6px 14px rgba(0,0,0,.55); }',
    '.smash-title small { display: block; font-size: 13px; letter-spacing: 6px; color: #b59bff; -webkit-text-stroke: 0;',
    '  text-shadow: none; margin-top: 4px; }',
    ".smash-amount { font-family: 'Courier New', monospace; font-weight: 700; font-size: 52px; letter-spacing: 2px;",
    '  margin: 10px 0 2px; color: #39ff14; text-shadow: 0 0 12px rgba(57,255,20,.55), 0 3px 0 #0c3d0c; }',
    '.smash-sub { font-size: 12px; color: #cdd; opacity: .85; }',
    '.smash-sub b { color: #ffd23f; }',
    '.pyramid { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 16px auto 12px; }',
    '.prow { display: flex; gap: 5px; }',
    '.box { width: 30px; height: 26px; position: relative; border-radius: 3px; border: 2px solid #6e4a22;',
    '  background: linear-gradient(#e0b277, #c4884a); box-shadow: inset 0 -4px 0 rgba(0,0,0,.18); transform-origin: bottom center;',
    '  animation: tok-pop .42s cubic-bezier(.2,.9,.3,1.35) both; }',
    '.box::before { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 8px; transform: translateX(-50%);',
    '  background: rgba(226,206,170,.6); }',
    '.box::after { content: ""; position: absolute; left: -2px; right: -2px; top: 47%; height: 2px; background: rgba(110,74,34,.55); }',
    '.pyramid.static .box { animation: none; }',
    '@keyframes tok-pop { 0% { transform: scale(0) translateY(8px); opacity: 0 } 70% { transform: scale(1.12) } 100% { transform: scale(1) translateY(0); opacity: 1 } }',
    '.smash-foot { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center;',
    '  font-size: 12px; color: #d7d2ff; }',
    '.smash-foot b { color: #fff; }',
    '.smash-foot .dot { opacity: .4; }',
    '.smash-foot .resell { color: #39ff14; }',

    // ================= SHOWCASE (Price Is Right) =================
    '.showcase { position: relative; padding: 16px 18px 18px; text-align: center;',
    '  background: linear-gradient(160deg, #3a1066 0%, #5a1e9c 55%, #1c0940 100%); color: #fff; }',
    '.bulbs { height: 12px; margin: 2px -2px; border-radius: 8px;',
    '  background-image: radial-gradient(circle, #ffe27a 0 3px, rgba(255,226,122,0) 4px);',
    '  background-size: 18px 12px; background-position: 0 50%; animation: tok-chase 1s steps(2) infinite; }',
    '.bulbs--bottom { animation-delay: .5s; }',
    '@keyframes tok-chase { to { background-position: 18px 50% } }',
    ".showcase-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 22px; letter-spacing: 1px;",
    '  color: #ffe27a; text-shadow: 0 2px 0 #7a3c00, 0 0 16px rgba(255,210,80,.5); margin: 8px 0 2px; }',
    '.showcase-total { font-size: 13px; color: #f4e9ff; margin-bottom: 10px; }',
    '.showcase-total span { font-weight: 800; font-size: 20px; color: #ffe27a; }',
    '.lots { display: flex; flex-direction: column; gap: 7px; text-align: left; }',
    '.lot { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 10px;',
    '  background: rgba(255,255,255,.07); border: 1px solid rgba(255,226,122,.25);',
    '  opacity: 0; transform: translateY(10px) scale(.98); transition: opacity .35s ease, transform .35s cubic-bezier(.2,.9,.3,1.3); }',
    '.lot.in { opacity: 1; transform: none; }',
    '.lot-emoji { font-size: 26px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.4)); }',
    '.lot-main { flex: 1; min-width: 0; }',
    '.lot-name { font-weight: 700; font-size: 14px; color: #fff; }',
    '.lot-blurb { font-size: 11.5px; color: #d9c7f5; }',
    '.lot-meta { text-align: right; white-space: nowrap; }',
    '.lot-count { font-size: 10.5px; color: #cbb6ee; }',
    '.lot-value { font-weight: 800; font-size: 16px; color: #ffe27a; }',
    '.showcase-final { margin-top: 12px; padding: 12px; border-radius: 12px;',
    '  background: radial-gradient(120% 120% at 50% 0%, rgba(255,226,122,.22), rgba(255,226,122,0));',
    '  border: 1px solid rgba(255,226,122,.4); opacity: 0; transform: scale(.9); transition: opacity .4s ease, transform .4s cubic-bezier(.2,.9,.3,1.4); }',
    '.showcase-final.in { opacity: 1; transform: none; }',
    '.final-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #f4e9ff; }',
    '.final-amount { font-family: Georgia, serif; font-weight: 800; font-size: 40px; color: #ffe27a;',
    '  text-shadow: 0 2px 0 #7a3c00, 0 0 22px rgba(255,210,80,.6); }',
    '.final-kicker { font-size: 12px; color: #eaddff; margin-top: 2px; }',
    '.final-kicker b { color: #aeffa0; }',

    // ================= BORING =================
    '.boring { padding: 16px 16px 18px; background: #14141a; color: #e7e7ec; }',
    '.boring-head { text-align: center; padding: 6px 0 14px; }',
    '.boring-amount { font-size: 44px; font-weight: 800; color: #f54e00; letter-spacing: -1px; line-height: 1; }',
    '.boring-headsub { font-size: 12.5px; color: #9a9aa6; margin-top: 4px; }',
    '.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }',
    '.stat { background: #1d1d25; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 9px 10px; }',
    '.stat-v { font-size: 17px; font-weight: 800; color: #fff; }',
    '.stat-l { font-size: 10.5px; color: #9a9aa6; text-transform: uppercase; letter-spacing: .4px; margin-top: 2px; }',
    '.sec-title { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #8a8a96;',
    '  margin: 14px 2px 7px; display: flex; justify-content: space-between; }',
    '.sec-title .muted { color: #66667a; text-transform: none; letter-spacing: 0; }',
    '.cat-table { width: 100%; border-collapse: collapse; }',
    '.cat-table td { padding: 5px 4px; font-size: 12.5px; vertical-align: middle; }',
    '.ct-cat { white-space: nowrap; }',
    '.ct-count { color: #9a9aa6; text-align: right; width: 64px; }',
    '.ct-bar { width: 38%; }',
    '.ct-bar span { display: block; height: 8px; border-radius: 5px; background: linear-gradient(90deg, #f54e00, #ffae6a); }',
    '.ct-val { text-align: right; font-weight: 700; color: #fff; width: 72px; }',
    '.acct-row { display: flex; gap: 8px; flex-wrap: wrap; }',
    '.acct-chip { flex: 1; min-width: 150px; display: flex; align-items: baseline; gap: 8px; background: #1d1d25;',
    '  border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 8px 11px; }',
    '.ac-h { font-weight: 700; color: #fff; font-size: 13px; }',
    '.ac-c { font-size: 11px; color: #9a9aa6; }',
    '.ac-v { margin-left: auto; font-weight: 800; color: #f54e00; }',
    '.samp-wrap { max-height: 200px; overflow: auto; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; }',
    '.samp-table { width: 100%; border-collapse: collapse; font-size: 12px; }',
    '.samp-table th { position: sticky; top: 0; background: #1d1d25; color: #8a8a96; font-weight: 600; text-align: left;',
    '  padding: 7px 9px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; }',
    '.samp-table td { padding: 7px 9px; border-top: 1px solid rgba(255,255,255,.05); }',
    '.samp-table tr:nth-child(even) td { background: rgba(255,255,255,.018); }',
    '.brand-tag { color: #76768a; font-size: 10.5px; margin-left: 6px; }',
    '.samp-table .acct { color: #9a9aa6; white-space: nowrap; }',
    '.samp-table .rv { text-align: right; font-weight: 700; color: #fff; white-space: nowrap; }',
    '@media (prefers-reduced-motion: reduce) { .overlay, .lot, .showcase-final, .bulbs { animation: none !important; transition: none !important; } }'
  ].join('\n');

  // ==========================================================================
  // markup builders
  // ==========================================================================
  function pyramidHtml(rows, durationMs, reduced) {
    var total = rows * (rows + 1) / 2;
    var html = '', i = 0;
    for (var r = 1; r <= rows; r++) {
      html += '<div class="prow">';
      for (var c = 0; c < r; c++) {
        var delay = reduced ? 0 : Math.round((i / total) * durationMs);
        html += '<span class="box" style="animation-delay:' + delay + 'ms"></span>';
        i++;
      }
      html += '</div>';
    }
    return html;
  }

  var BODY = {
    smashtv: function (haul, reduced) {
      var t = haul.totals || {};
      return ''
        + '<div class="smash">'
        + '  <div class="smash-title">Package Bonus<small>FREE SAMPLE HAUL</small></div>'
        + '  <div class="smash-amount" data-odo>' + usd0.format(0) + '</div>'
        + '  <div class="smash-sub">retail value collected — you paid <b>' + usd0.format(t.pricePaid || 0) + '</b></div>'
        + '  <div class="pyramid' + (reduced ? ' static' : '') + '">' + pyramidHtml(PYRAMID_ROWS, SMASH_MS, reduced) + '</div>'
        + '  <div class="smash-foot">'
        + '    <span><b>' + nf.format(t.count || 0) + '</b> packages</span><span class="dot">•</span>'
        + '    <span><b>' + usd0.format(t.avgValue || 0) + '</b> avg</span><span class="dot">•</span>'
        + '    <span class="resell">resell @10% → <b>' + usd0.format(t.resaleValue || 0) + '</b></span>'
        + '  </div>'
        + '</div>';
    },

    showcase: function (haul, reduced) {
      var t = haul.totals || {};
      var lots = (haul.showcase || []).map(function (l) {
        return ''
          + '<div class="lot" data-lot data-value="' + (l.retailValue || 0) + '">'
          + '  <div class="lot-emoji">' + esc(l.emoji || '🎁') + '</div>'
          + '  <div class="lot-main"><div class="lot-name">' + esc(l.name) + '</div>'
          + '    <div class="lot-blurb">' + esc(l.blurb || '') + '</div></div>'
          + '  <div class="lot-meta"><div class="lot-count">' + nf.format(l.count || 0) + ' items</div>'
          + '    <div class="lot-value">' + usd0.format(l.retailValue || 0) + '</div></div>'
          + '</div>';
      }).join('');
      return ''
        + '<div class="showcase">'
        + '  <div class="bulbs bulbs--top"></div>'
        + "  <div class=\"showcase-title\">Today's Sample Showcase</div>"
        + '  <div class="showcase-total">Retail value so far: <span data-odo>' + usd0.format(0) + '</span></div>'
        + '  <div class="lots">' + lots + '</div>'
        + '  <div class="showcase-final" data-final>'
        + '    <div class="final-label">Actual Retail Value</div>'
        + '    <div class="final-amount">' + usd0.format(t.retailValue || 0) + '</div>'
        + '    <div class="final-kicker">…and at <b>10%</b> resale, that\'s <b>' + usd0.format(t.resaleValue || 0) + '</b> in your pocket.</div>'
        + '  </div>'
        + '  <div class="bulbs bulbs--bottom"></div>'
        + '</div>';
    },

    boring: function (haul) {
      var t = haul.totals || {};
      var cats = haul.byCategory || [];
      var maxCat = cats.reduce(function (m, c) { return Math.max(m, c.retailValue || 0); }, 1);
      var catRows = cats.map(function (c) {
        var pct = Math.round((c.retailValue || 0) / maxCat * 100);
        return '<tr><td class="ct-cat">' + esc(c.emoji || '') + ' ' + esc(c.category) + '</td>'
          + '<td class="ct-count">' + nf.format(c.count || 0) + '</td>'
          + '<td class="ct-bar"><span style="width:' + pct + '%"></span></td>'
          + '<td class="ct-val">' + usd0.format(c.retailValue || 0) + '</td></tr>';
      }).join('');
      var acctRow = (haul.accounts || []).map(function (a) {
        return '<div class="acct-chip"><span class="ac-h">' + esc(a.handle) + '</span>'
          + '<span class="ac-c">' + nf.format(a.count || 0) + ' samples</span>'
          + '<span class="ac-v">' + usd0.format(a.retailValue || 0) + '</span></div>';
      }).join('');
      var samples = haul.samples || [];
      var sampRows = samples.map(function (it) {
        return '<tr><td>' + esc(it.product) + '<span class="brand-tag">' + esc(it.brand) + '</span></td>'
          + '<td>' + esc(it.category) + '</td>'
          + '<td class="acct">' + esc(it.account) + '</td>'
          + '<td class="rv">' + usd2.format(it.retailValue || 0) + '</td></tr>';
      }).join('');
      var stat = function (v, l) { return '<div class="stat"><div class="stat-v">' + v + '</div><div class="stat-l">' + l + '</div></div>'; };
      return ''
        + '<div class="boring">'
        + '  <div class="boring-head">'
        + '    <div class="boring-amount">' + usd0.format(t.retailValue || 0) + '</div>'
        + '    <div class="boring-headsub">in free samples this week · you paid ' + usd0.format(t.pricePaid || 0) + '</div>'
        + '  </div>'
        + '  <div class="stat-grid">'
        + stat(nf.format(t.count || 0), 'Samples')
        + stat(usd0.format(t.avgValue || 0), 'Avg value')
        + stat(usd0.format(t.pricePaid || 0), 'You paid')
        + stat(usd0.format(t.resaleValue || 0), 'Resale @10%')
        + stat(usd0.format(t.monthlyMaintainable || 0) + '/mo', 'Maintainable')
        + stat(nf.format((haul.accounts || []).length), 'Accounts')
        + '  </div>'
        + '  <div class="sec-title"><span>By category</span></div>'
        + '  <table class="cat-table">' + catRows + '</table>'
        + '  <div class="sec-title"><span>Accounts</span></div>'
        + '  <div class="acct-row">' + acctRow + '</div>'
        + '  <div class="sec-title"><span>Recent samples</span><span class="muted">showing ' + nf.format(samples.length) + ' of ' + nf.format(t.count || 0) + '</span></div>'
        + '  <div class="samp-wrap"><table class="samp-table">'
        + '    <thead><tr><th>Product</th><th>Category</th><th>Account</th><th>Retail</th></tr></thead>'
        + '    <tbody>' + sampRows + '</tbody>'
        + '  </table></div>'
        + '</div>';
    }
  };

  // ==========================================================================
  // entry animations (push cancel handles so close()/re-render can stop them)
  // ==========================================================================
  var ANIMATORS = {
    smashtv: function (haul, shadow, reduced) {
      var odo = shadow.querySelector('[data-odo]');
      var to = (haul.totals && haul.totals.retailValue) || 0;
      pushCancel(animateCount(0, to, SMASH_MS, function (v) {
        if (odo) odo.textContent = usd0.format(Math.round(v));
      }, { reduced: reduced }));
    },

    showcase: function (haul, shadow, reduced) {
      var lots = Array.prototype.slice.call(shadow.querySelectorAll('[data-lot]'));
      var odo = shadow.querySelector('[data-odo]');
      var finalEl = shadow.querySelector('[data-final]');
      var grand = (haul.totals && haul.totals.retailValue) || 0;
      if (reduced) {
        lots.forEach(function (l) { l.classList.add('in'); });
        if (odo) odo.textContent = usd0.format(grand);
        if (finalEl) finalEl.classList.add('in');
        return;
      }
      var running = 0;
      lots.forEach(function (lot, idx) {
        schedule(function () {
          lot.classList.add('in');
          var v = Number(lot.getAttribute('data-value')) || 0;
          var from = running; running += v;
          pushCancel(animateCount(from, running, 520, function (val) {
            if (odo) odo.textContent = usd0.format(Math.round(val));
          }));
        }, 240 + idx * SHOWCASE_STEP);
      });
      schedule(function () { if (finalEl) finalEl.classList.add('in'); }, 240 + lots.length * SHOWCASE_STEP + 160);
    },

    boring: null
  };

  // ==========================================================================
  // chrome wiring (header controls, backdrop, escape)
  // ==========================================================================
  function segBtn(style, label) {
    var on = current && current.fancy === style ? ' on' : '';
    return '<button class="segbtn' + on + '" data-style="' + style + '">' + label + '</button>';
  }

  function frameHtml(haul, style, reduced) {
    var p = haul.period || {};
    var range = fmtRange(p);
    var body = (BODY[style] || BODY.boring)(haul, reduced);
    var isBoring = style === 'boring';
    return ''
      + '<div class="overlay" data-backdrop>'
      + '  <div class="panel panel--' + style + '">'
      + '    <div class="bar">'
      + '      <span class="brand">📦 Free Samples</span>'
      + '      <span class="period">' + esc(p.label || '') + (range ? ' · ' + esc(range) : '') + '</span>'
      + '      <span class="spacer"></span>'
      + '      <div class="seg' + (isBoring ? ' is-boring' : '') + '">' + segBtn('smashtv', 'SmashTV') + segBtn('showcase', 'Showcase') + '</div>'
      + '      <label class="btoggle"><input type="checkbox" data-boring' + (isBoring ? ' checked' : '') + '> Just the numbers</label>'
      + '      <button class="close" data-close aria-label="Close">×</button>'
      + '    </div>'
      + '    <div class="body">' + body + '</div>'
      + '  </div>'
      + '</div>';
  }

  function wireChrome() {
    var s = current.shadow;
    var overlay = s.querySelector('[data-backdrop]');
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    var closeBtn = s.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', close);
    Array.prototype.forEach.call(s.querySelectorAll('[data-style]'), function (btn) {
      btn.addEventListener('click', function () {
        var st = btn.getAttribute('data-style');
        current.fancy = st;
        current.style = st;
        setBoringPref(false);
        render();
      });
    });
    var boringBox = s.querySelector('[data-boring]');
    if (boringBox) boringBox.addEventListener('change', function () {
      if (boringBox.checked) { current.style = 'boring'; setBoringPref(true); }
      else { current.style = current.fancy; setBoringPref(false); }
      render();
    });
  }

  function render() {
    if (!current) return;
    clearAnimations();
    var reduced = reducedMotion();
    current.shadow.innerHTML = '<style>' + CSS + '</style>' + frameHtml(current.haul, current.style, reduced);
    wireChrome();
    var animate = ANIMATORS[current.style];
    if (animate) animate(current.haul, current.shadow, reduced);
  }

  // ==========================================================================
  // public API
  // ==========================================================================
  function close() {
    if (!current) return;
    clearAnimations();
    if (current.onKey) document.removeEventListener('keydown', current.onKey, true);
    if (current.host && current.host.parentNode) current.host.parentNode.removeChild(current.host);
    current = null;
  }

  function show(haul, opts) {
    opts = opts || {};
    if (current) close();
    haul = haul || window.TOK_SAMPLES_MOCK || {};

    var style = opts.style;
    if (!style) style = boringPref() ? 'boring' : 'smashtv';
    if (STYLES.indexOf(style) < 0) style = 'smashtv';

    var host = document.createElement('div');
    host.id = 'tok-samples-modal-host';
    host.style.cssText = 'all: initial;';
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    (document.body || document.documentElement).appendChild(host);

    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey, true);

    current = {
      host: host, shadow: shadow, haul: haul,
      style: style, fancy: style === 'boring' ? 'smashtv' : style,
      cancels: [], onKey: onKey
    };
    render();
  }

  function setStyle(style) {
    if (!current || STYLES.indexOf(style) < 0) return;
    current.style = style;
    if (style !== 'boring') current.fancy = style;
    setBoringPref(style === 'boring');
    render();
  }

  function replay() { if (current) render(); }

  window.TOK_SAMPLES_MODAL = { show: show, close: close, replay: replay, setStyle: setStyle };
})();
