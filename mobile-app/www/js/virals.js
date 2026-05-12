/* virals.js — wire up the Virals overlay launched from #menuVirals.
 * Pure vanilla, no deps. Renders content from a static data table.
 */
(function () {
  'use strict';

  var rendered = false;

  // ─── Data ───────────────────────────────────────────────────
  var promos = [
    { cls: 'v-promo--community', badge: 'COMMUNITY', eyebrow: '',           title: 'Join our community for tips, strategy & live drops', cta: 'Open Community' },
    { cls: 'v-promo--payouts',   badge: 'NEW',       eyebrow: 'PAYOUTS',    title: 'Earn faster. Daily payouts on every creator deal.',   cta: 'See payouts' },
    { cls: 'v-promo--learn',     badge: 'FREE',      eyebrow: 'TUTORIALS',  title: 'Learn what makes a viral video, in under 10 minutes.', cta: 'Start course' }
  ];

  var videos = [
    { rank: 1, hue: 200, posted: '5 days ago', views: '24.3M', likes: '142K', comments: '612', viewGained: '+12.1M',
      product: '[clearstem] BumpStop Acne Serum', units: '102K', sales: '+420', salesPct: '+1.2%', creator: '@skinwithjules' },
    { rank: 2, hue: 280, posted: '2 wk. ago',  views: '19.6M', likes: '91.6K',comments: '458', viewGained: '+8.55M',
      product: '[medicube] Zero Pore Pads',     units: '63.6K',sales: '+187', salesPct: '+0.3%', creator: '@dealswithdan' },
    { rank: 3, hue: 30,  posted: '4 days ago', views: '11.2M', likes: '78.4K',comments: '291', viewGained: '+5.8M',
      product: '[anua] Heartleaf Toner 5.5',    units: '45.2K',sales: '+340', salesPct: '+0.8%', creator: '@glowwithmari' },
    { rank: 4, hue: 140, posted: '1 wk. ago',  views: '9.4M',  likes: '56.1K',comments: '198', viewGained: '+4.2M',
      product: '[tarte] Maracuja Juicy Lip',    units: '38.7K',sales: '+260', salesPct: '+0.7%', creator: '@beautybylina' }
  ];

  var prodSets = {
    viral: [
      { hue: 340, gain: '+48K', pct: '+13.4%', title: '[clearstem] BumpStop Serum',     earn: '$4',    price: '$32',   sold: '404K', rate: '15%' },
      { hue: 280, gain: '+1K',  pct: '+39.4%', title: '[anua] Visibly Firming Cream',   earn: '$1,140',price: '$7,599',sold: '4.51K',rate: '15%' },
      { hue: 200, gain: '+22K', pct: '+9.8%',  title: 'tarte Maracuja Lip Plump',       earn: '$5',    price: '$24',   sold: '411K', rate: '20%' },
      { hue: 60,  gain: '+8K',  pct: '+18.2%', title: '[medicube] Collagen Mask 30pk',  earn: '$3',    price: '$28',   sold: '298K', rate: '15%' }
    ],
    top: [
      { hue: 200, gain: '+22K', pct: '+9.8%',  title: 'tarte Maracuja Lip Plump',       earn: '$5',    price: '$24',   sold: '411K', rate: '20%' },
      { hue: 60,  gain: '+8K',  pct: '+18.2%', title: '[medicube] Collagen Mask 30pk',  earn: '$3',    price: '$28',   sold: '298K', rate: '15%' },
      { hue: 340, gain: '+48K', pct: '+13.4%', title: '[clearstem] BumpStop Serum',     earn: '$4',    price: '$32',   sold: '404K', rate: '15%' },
      { hue: 280, gain: '+1K',  pct: '+39.4%', title: '[anua] Visibly Firming Cream',   earn: '$1,140',price: '$7,599',sold: '4.51K',rate: '15%' }
    ],
    comm: [
      { hue: 60,  gain: '+8K',  pct: '+18.2%', title: '[medicube] Collagen Mask 30pk',  earn: '$8',    price: '$28',   sold: '298K', rate: '28%' },
      { hue: 200, gain: '+22K', pct: '+9.8%',  title: 'tarte Maracuja Lip Plump',       earn: '$5',    price: '$24',   sold: '411K', rate: '25%' },
      { hue: 340, gain: '+48K', pct: '+13.4%', title: '[clearstem] BumpStop Serum',     earn: '$7',    price: '$32',   sold: '404K', rate: '22%' },
      { hue: 280, gain: '+1K',  pct: '+39.4%', title: '[anua] Visibly Firming Cream',   earn: '$1,200',price: '$7,599',sold: '4.51K',rate: '18%' }
    ]
  };

  var gems = [
    { hue: 280, gain: '+1K',  pct: '+39.4%',  title: '[anua] Visibly Firming Cream',  earn: '$1,140',price: '$7,599',sold: '4.51K',rate: '15%' },
    { hue: 180, gain: '+6K',  pct: '+257.3%', title: 'LANE LINEN Lightweight Towel',  earn: '$3',    price: '$13',   sold: '8.24K',rate: '20%' },
    { hue: 220, gain: '+3K',  pct: '+88.1%',  title: 'Cata-K Botanical Cleanser',     earn: '$9',    price: '$48',   sold: '11K',  rate: '20%' },
    { hue: 30,  gain: '+2K',  pct: '+142.5%', title: 'Sunray Hair Repair Mist',       earn: '$4',    price: '$19',   sold: '6.2K', rate: '22%' }
  ];

  var creators = [
    { rank: 1, hue: 30,  name: 'cakedfinds',      video: '2.07M', total: '2.07M' },
    { rank: 2, hue: 50,  name: 'jetskcqzy7m',     video: '1.71M', total: '1.71M' },
    { rank: 3, hue: 320, name: 'simplymandys',    video: '208K',  total: '1.44M' },
    { rank: 4, hue: 80,  name: 'una_flor_cubana', video: '1.25M', total: '1.26M' },
    { rank: 5, hue: 200, name: 'shop_shiesty',    video: '1.19M', total: '1.19M' }
  ];

  // ─── Helpers ────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ph(hue, label, h) {
    var bg = 'repeating-linear-gradient(135deg, oklch(0.32 0.05 ' + hue + ') 0 6px, oklch(0.28 0.05 ' + hue + ') 6px 12px)';
    return '<div class="v-ph" style="background:' + bg + (h ? ';height:' + h + 'px' : '') + '">' + esc(label || '') + '</div>';
  }

  function icon(kind) {
    switch (kind) {
      case 'flame': return '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2.5c1 2.8 3 4.4 4.5 6.2 1.6 1.9 2.5 3.9 2.5 6.1A7 7 0 1 1 5 14.8c0-2.2 1.2-3.5 2.2-4.5 1-1 1.7-2 1.7-3.3 1.2.7 1.9 1.9 2.1 3.2 1-1.4 1.4-3.4 1-7.7Z" fill="none" stroke="#f54e00" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 15.5c0-1 .5-1.8 1.2-2.4.4 1 1.2 1.4 2 1.8 1.1.6 1.8 1.5 1.8 2.7a3 3 0 1 1-6 0c0-.8.3-1.4 1-2.1Z" fill="#f54e00" opacity="0.85"/></svg>';
      case 'cam':   return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><rect x="2.5" y="6.5" width="19" height="13" rx="2.5" stroke="#f54e00" stroke-width="1.6"/><path d="M8 6.5l1.2-2h5.6L16 6.5" stroke="#f54e00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" stroke="#f54e00" stroke-width="1.6"/></svg>';
      case 'gem':   return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><rect x="12" y="2" width="14" height="14" rx="2" transform="rotate(45 12 2)" stroke="#f54e00" stroke-width="1.6"/></svg>';
      case 'chevR': return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'arrow': return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="#f54e00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'play':  return '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M10 8l6 4-6 4V8Z" fill="#fff"/></svg>';
      case 'pmini': return '<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 5l12 7-12 7V5Z"/></svg>';
      case 'heart': return '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 21s-7-4.5-9.3-9.2C1 8 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.3 7.8C19 16.5 12 21 12 21Z"/></svg>';
      case 'cmt':   return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H10l-4 4v-4H4V5Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }
    return '';
  }

  // ─── Renderers ──────────────────────────────────────────────
  function promoHTML() {
    var slides = promos.map(function (p) {
      return '<div class="v-promo ' + p.cls + '">' +
        '<div class="v-promo-badge">' + esc(p.badge) + '</div>' +
        (p.eyebrow ? '<div class="v-promo-eyebrow">' + esc(p.eyebrow) + '</div>' : '') +
        '<div class="v-promo-title">' + esc(p.title) + '</div>' +
        '<div class="v-promo-brand">' +
          '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2.5c1 2.8 3 4.4 4.5 6.2 1.6 1.9 2.5 3.9 2.5 6.1A7 7 0 1 1 5 14.8c0-2.2 1.2-3.5 2.2-4.5 1-1 1.7-2 1.7-3.3 1.2.7 1.9 1.9 2.1 3.2 1-1.4 1.4-3.4 1-7.7Z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
          '<span>Virals</span>' +
        '</div>' +
        '<button type="button" class="v-promo-cta">' + esc(p.cta) + '</button>' +
      '</div>';
    }).join('');
    var dots = promos.map(function (_, i) {
      return '<div class="v-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"></div>';
    }).join('');
    return '<div class="v-carousel" id="vCarousel">' + slides + '</div><div class="v-dots" id="vDots">' + dots + '</div>';
  }

  function sectionHead(iconKind, title, info) {
    return '<div class="v-section-h">' +
      '<span class="v-icon">' + icon(iconKind) + '</span>' +
      '<span class="v-title">' + esc(title) + '</span>' +
      (info ? '<span class="v-info">i</span>' : '') +
      '<button type="button" class="v-more">' + icon('chevR') + '</button>' +
    '</div>';
  }

  function videosHTML() {
    var cards = videos.map(function (c) {
      return '<div class="v-vid-card">' +
        '<div class="v-vid-tile">' +
          ph(c.hue, 'creator video #' + c.rank) +
          '<div class="v-vid-tile-shade"></div>' +
          '<div class="v-rank">#' + c.rank + '</div>' +
          '<div class="v-play"><div class="v-play-circle">' + icon('play') + '</div></div>' +
          '<div class="v-ad">Ad</div>' +
        '</div>' +
        '<div class="v-vid-right">' +
          '<div class="v-vid-stats">' +
            '<div class="v-row"><span class="v-dim">Posted: ' + esc(c.posted) + '</span>' + icon('arrow') + '</div>' +
            '<div class="v-stats-counts">' +
              '<span>' + icon('pmini') + esc(c.views) + '</span>' +
              '<span>' + icon('heart') + esc(c.likes) + '</span>' +
              '<span>' + icon('cmt') + esc(c.comments) + '</span>' +
            '</div>' +
            '<div class="v-stats-label">Views gained (7d)</div>' +
            '<div class="v-stats-val">' + esc(c.viewGained) + '</div>' +
          '</div>' +
          '<div class="v-vid-prod">' +
            '<div class="v-prod-head">' +
              '<div class="v-prod-img">' + ph(c.hue + 30, '', 36) + '</div>' +
              '<div class="v-prod-title">' + esc(c.product) + '</div>' +
              '<div class="v-prod-info-btn">i</div>' +
            '</div>' +
            '<div class="v-row"><span class="v-prod-stat-label">Total units sold: ' + esc(c.units) + '</span>' + icon('chevR') + '</div>' +
            '<div class="v-prod-stat-label">Sales gained (24h)</div>' +
            '<div><span class="v-prod-sales-val">' + esc(c.sales) + '</span><span class="v-prod-sales-pct">(' + esc(c.salesPct) + ')</span></div>' +
          '</div>' +
          '<div class="v-creator">' +
            '<div class="v-creator-avatar">' + ph(c.hue - 20, '', 26) + '</div>' +
            '<span class="v-creator-name">' + esc(c.creator) + '</span>' +
            icon('arrow') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="v-rail">' + cards + '</div>';
  }

  function prodCard(p) {
    return '<div class="v-prod">' +
      '<div class="v-prod-imgwrap">' +
        ph(p.hue, 'product shot') +
        '<div class="v-prod-pill">' + esc(p.gain) + ' (' + esc(p.pct) + ') / 7 days</div>' +
      '</div>' +
      '<div class="v-prod-info">' +
        '<div class="v-prod-name">' + esc(p.title) + '</div>' +
        '<div class="v-prod-earn">Earn ' + esc(p.earn) + ' <span class="v-dim">| ' + esc(p.price) + '</span></div>' +
        '<div class="v-prod-sold"><strong>' + esc(p.sold) + '</strong><span class="v-dim"> sold | ' + esc(p.rate) + '</span></div>' +
      '</div>' +
    '</div>';
  }

  function productsHTML() {
    var tabs = [
      { id: 'viral', label: 'Most viral' },
      { id: 'top',   label: 'Top selling' },
      { id: 'comm',  label: 'Higher commission' }
    ];
    var tabHTML = '<div class="v-tabs" id="vTabs">' + tabs.map(function (t, i) {
      return '<button type="button" class="v-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + t.id + '">' + esc(t.label) + '</button>';
    }).join('') + '</div>';
    var grid = '<div class="v-grid" id="vProdGrid">' + prodSets.viral.map(prodCard).join('') + '</div>';
    return tabHTML + grid;
  }

  function gemsHTML() {
    return '<div class="v-grid">' + gems.map(prodCard).join('') + '</div>';
  }

  function creatorsHTML() {
    var head = '<div class="v-board-head">' +
      '<span>Creator</span>' +
      '<span><span class="v-info">i</span> Video GMV</span>' +
      '<span><span class="v-info">i</span> Total GMV</span>' +
    '</div>';
    var rows = creators.map(function (r) {
      var top = r.rank <= 3 ? ' top' : '';
      return '<div class="v-board-row">' +
        '<div class="v-board-rank' + top + '">#' + r.rank + '</div>' +
        '<div class="v-board-creator">' +
          '<div class="v-board-avatar">' + ph(r.hue, '', 32) + '</div>' +
          '<div class="v-board-name">' + esc(r.name) + '</div>' +
        '</div>' +
        '<div class="v-board-num">' + esc(r.video) + '</div>' +
        '<div class="v-board-num">' + esc(r.total) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="v-board">' + head + '<div class="v-board-rows">' + rows + '</div></div>';
  }

  function render(body) {
    body.innerHTML =
      promoHTML() +
      sectionHead('cam',   "Today's viral videos") +
      videosHTML() +
      sectionHead('flame', 'Viral products', true) +
      productsHTML() +
      sectionHead('gem',   'Hidden gems', true) +
      gemsHTML() +
      sectionHead('flame', 'Viral creators', true) +
      creatorsHTML();

    // promo dot tracking
    var car = body.querySelector('#vCarousel');
    var dots = body.querySelectorAll('#vDots .v-dot');
    if (car && dots.length) {
      car.addEventListener('scroll', function () {
        var i = Math.round(car.scrollLeft / (car.clientWidth - 12));
        dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
      }, { passive: true });
    }

    // product tabs
    var tabs = body.querySelector('#vTabs');
    var grid = body.querySelector('#vProdGrid');
    if (tabs && grid) {
      tabs.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.v-tab');
        if (!btn) return;
        tabs.querySelectorAll('.v-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var id = btn.getAttribute('data-tab');
        grid.innerHTML = (prodSets[id] || prodSets.viral).map(prodCard).join('');
      });
    }
  }

  // ─── Open / close ──────────────────────────────────────────
  function open() {
    var view = document.getElementById('viralsView');
    var body = document.getElementById('viralsBody');
    if (!view || !body) return;
    if (!rendered) { render(body); rendered = true; }
    view.classList.remove('hidden');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('virals-open');

    // close the app menu if it's open
    var dd = document.getElementById('appMenuDropdown');
    if (dd) dd.classList.add('hidden');
  }
  function close() {
    var view = document.getElementById('viralsView');
    if (!view) return;
    view.classList.add('hidden');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('virals-open');
  }

  function bind() {
    var menu = document.getElementById('menuVirals');
    if (menu) menu.addEventListener('click', open);
    var closer = document.getElementById('viralsClose');
    if (closer) closer.addEventListener('click', close);
    document.addEventListener('backbutton', function () {
      var view = document.getElementById('viralsView');
      if (view && !view.classList.contains('hidden')) close();
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.Virals = { open: open, close: close };
})();
