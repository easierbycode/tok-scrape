// Dashboard components — React/Babel
// Uses globals from data.js: ACCOUNTS, ALL, STREAK, MONTH_COMPARE, KPI_ALL, KPI_BY_ACCT, PRODUCTS, VIDEOS, POWER_DEAL

const { useState, useMemo, useEffect, useRef } = React;

// ---------- helpers ----------
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return '$' + (n/1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k';
  return '$' + Math.round(n).toLocaleString();
};
const fmtMoneyFull = (n) => '$' + Math.round(n).toLocaleString();
const fmtInt = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1).replace(/\.0$/,'') + 'K';
  return n.toLocaleString();
};
const pct = (n) => (n >= 0 ? '+' : '') + Math.round(n*100) + '%';

const acctById = (id) => ACCOUNTS.find(a => a.id === id);

// ---------- Account badges (the signature multi-account indicator) ----------
function AccountBadges({ accountIds, mode='initials', max=4, size=24, title }) {
  const ids = accountIds || [];
  const shown = ids.slice(0, max);
  const overflow = ids.length - shown.length;
  const names = ids.map(id => acctById(id)?.name).filter(Boolean).join(', ');
  return (
    <span className={'badges ' + (mode === 'symbol' ? 'sym' : '')} style={{ ['--sz']: size+'px' }}>
      {shown.map(id => {
        const a = acctById(id); if (!a) return null;
        return (
          <span key={id}
            className="badge"
            style={{ '--bc': a.color, background: a.color, width: size, height: size }}
            aria-label={a.name}>
            {mode === 'symbol' ? a.symbol : a.initials}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="badge badge-overflow" style={{ width: size, height: size }}>+{overflow}</span>
      )}
      <span className="badge-tip">{title || names}</span>
    </span>
  );
}

// ---------- Topbar ----------
function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-main">
        <span className="dot-brand" />
        <div>
          <div className="brand-text">Tok<span className="brand-text-accent">Scrape</span></div>
          <h1 className="title">Dashboard</h1>
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-icon" title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
        </button>
        <button className="btn btn-icon" title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>
        </button>
        <button className="btn btn-icon" title="Profile" aria-label="Profile">
          <span className="avatar">DN</span>
        </button>
      </div>
    </header>
  );
}

// ---------- Account selector ----------
function AccountSelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const current = selected === '__all' ? ALL : acctById(selected);

  return (
    <div className={'acct-select' + (open ? ' open' : '')} ref={ref}>
      <button className="acct-trigger" onClick={() => setOpen(v=>!v)}>
        <span className="acct-dot" style={{ background: current.color }} />
        <span className="acct-trigger-label">
          <span className="acct-trigger-k">Viewing</span>
          <span className="acct-trigger-v">
            {current.name}
            {selected === '__all' && <span style={{ color:'var(--muted-foreground)', fontWeight:500, fontSize:12 }}>· {ACCOUNTS.length} accounts</span>}
          </span>
        </span>
        <span className="acct-caret">▾</span>
      </button>
      {open && (
        <div className="acct-panel" onClick={e=>e.stopPropagation()}>
          <h4>Aggregate</h4>
          <button className={'acct-row' + (selected === '__all' ? ' active' : '')} onClick={() => { onSelect('__all'); setOpen(false); }}>
            <span className="acct-dot" style={{ background: ALL.color }} />
            <span className="acct-row-name">All Accounts</span>
            <span className="acct-row-handle">{ACCOUNTS.length} creators</span>
            <span className="acct-check">{selected === '__all' ? '✓' : ''}</span>
          </button>
          <h4>Accounts</h4>
          {ACCOUNTS.map(a => (
            <button key={a.id} className={'acct-row' + (selected === a.id ? ' active' : '')} onClick={() => { onSelect(a.id); setOpen(false); }}>
              <span className="acct-dot" style={{ background: a.color }} />
              <span className="acct-row-name">{a.name}</span>
              <span className="acct-row-handle">{a.handle}</span>
              <span className="acct-check">{selected === a.id ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Streak + month compare ----------
function StreakRow() {
  const up = MONTH_COMPARE.thisMonth > MONTH_COMPARE.prevMonth;
  return (
    <div className="streak">
      <div className="streak-card">
        <div className="streak-num">{STREAK.days}</div>
        <div className="streak-meta">
          <span className="streak-meta-k">Daily posting streak</span>
          <span className="streak-meta-v">{STREAK.days} days · best {STREAK.bestDays}</span>
        </div>
        <span className="streak-flame" role="img" aria-label="streak">🔥</span>
      </div>
      <div className="trend-card" title="Videos posted this month vs last month">
        <span className="trend-num">{MONTH_COMPARE.thisMonth}</span>
        <span className={'trend-arrow' + (up ? '' : ' down')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {up ? <path d="M6 15l6-6 6 6"/> : <path d="M6 9l6 6 6-6"/>}
          </svg>
        </span>
        <span className="trend-num" style={{ opacity: 0.5 }}>{MONTH_COMPARE.prevMonth}</span>
        <span className="trend-label"><strong>This month</strong><br/>vs last month</span>
      </div>
    </div>
  );
}

// ---------- Sparkline ----------
function Sparkline({ data, color='var(--primary)' }) {
  const w = 120, h = 34, pad = 2;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const step = (w - pad*2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i*step, h - pad - ((v - min) / span) * (h - pad*2)]);
  const line = pts.map(([x,y], i) => (i===0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length-1][0].toFixed(1)} ${h-pad} L${pts[0][0].toFixed(1)} ${h-pad} Z`;
  const gradId = 'sg-' + Math.random().toString(36).slice(2, 7);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ---------- KPIs ----------
function KpiTiles({ kpi, scopeColor }) {
  const tiles = [
    { key: 'gmv',        label: 'GMV',        icon: '$', val: fmtMoneyFull(kpi.gmv.value),       delta: kpi.gmv.delta,        spark: kpi.gmv.spark },
    { key: 'videos',     label: '# Videos',   icon: '▶', val: fmtInt(kpi.videos.value),          delta: kpi.videos.delta,     spark: kpi.videos.spark },
    { key: 'commission', label: 'Commission', icon: '%', val: fmtMoneyFull(kpi.commission.value),delta: kpi.commission.delta, spark: kpi.commission.spark },
  ];
  return (
    <div className="kpis">
      {tiles.map(t => (
        <div className="kpi" key={t.key}>
          <div className="kpi-label"><span className="kpi-label-icon">{t.icon}</span>{t.label}</div>
          <div className="kpi-val">{t.val}</div>
          <div className="kpi-delta">
            <span className={t.delta >= 0 ? 'up' : 'down'}>{pct(t.delta)}</span> vs prev period
          </div>
          <div className="kpi-spark"><Sparkline data={t.spark} color={scopeColor} /></div>
        </div>
      ))}
    </div>
  );
}

// ---------- Products ----------
function ProductsTable({ products, scope, badgeMode, onBrandClick }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Products <span className="pill">by brand</span></h2>
        <div className="section-actions">
          <ScopePill scope={scope} />
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Brand</th>
              <th style={{ width: 120 }}>Accounts</th>
              <th className="num">GMV</th>
              <th className="num"># Units</th>
              <th className="num">Commission</th>
              <th className="num" style={{ width: 70 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id}>
                <td><span className={'rank' + (i < 3 ? ' gold' : '')}>{i+1}</span></td>
                <td>
                  <div className="brand">{p.brand}</div>
                  <div className="sub">{p.category}</div>
                </td>
                <td>
                  <AccountBadges accountIds={p.accounts} mode={badgeMode} />
                </td>
                <td className="num money">{fmtMoneyFull(p.gmv)}</td>
                <td className="num">{p.units}</td>
                <td className="num money">{fmtMoneyFull(p.commission)}</td>
                <td className="num">
                  <span className={p.trend >= 0 ? 'kpi-delta' : 'kpi-delta'} style={{ color: p.trend >=0 ? 'var(--success)' : 'var(--destructive)', fontWeight: 700 }}>
                    {pct(p.trend)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Videos ----------
function VideosGrid({ videos, badgeMode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Videos <span className="pill">top performing</span></h2>
        <div className="section-actions">
          <button className="btn" style={{ fontSize: 12 }}>View all →</button>
        </div>
      </div>
      <div className="videos">
        {videos.map(v => (
          <article className="video" key={v.id}>
            <div className="video-thumb">
              <div className="video-thumb-stripes" />
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <div className="video-badges">
                <AccountBadges accountIds={v.accounts} mode={badgeMode} size={20} max={3} />
              </div>
            </div>
            <div className="video-body">
              <div className="video-brand">{v.brand}{v.hot && <span style={{ marginLeft: 8, color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' }}>🔥 HOT</span>}</div>
              <div className="video-caption">{v.caption}</div>
              <div className="video-stats">
                <div>
                  <div className="video-stat-k">GMV</div>
                  <div className="video-stat-v">{fmtMoney(v.gmv)}</div>
                </div>
                <div>
                  <div className="video-stat-k">Views</div>
                  <div className="video-stat-v">{fmtInt(v.views)}</div>
                </div>
                <div>
                  <div className="video-stat-k">Com.</div>
                  <div className="video-stat-v">{fmtMoney(v.commission)}</div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- Scope pill ----------
function ScopePill({ scope }) {
  const s = scope === '__all' ? ALL : acctById(scope);
  return (
    <span className="scope-pill">
      <span className="acct-dot" style={{ background: s.color }} />
      {s.name}
    </span>
  );
}

// ---------- Power deal ----------
function PowerDeal({ badgeMode }) {
  return (
    <div className="power-deal">
      <AccountBadges accountIds={['blackfridaybrian','betterb46','better9']} mode={badgeMode} size={30} />
      <div>
        <div className="power-deal-k">Today's Power Deal</div>
        <div className="power-deal-title">{POWER_DEAL.title}</div>
        <div className="power-deal-sub">{POWER_DEAL.sub}</div>
      </div>
      <div className="power-deal-badge">View →</div>
    </div>
  );
}

// ---------- Bottom nav ----------
function BottomNav({ active, onChange }) {
  const items = [
    { id:'home',      label:'Home',      icon: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.9V21h14V9.9"/></> },
    { id:'campaigns', label:'Campaigns', icon: <><path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-3"/></> },
    { id:'goals',     label:'Goals',     icon: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></> },
    { id:'profile',   label:'Profile',   icon: <><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></> },
  ];
  return (
    <nav className="bottomnav">
      <div className="bottomnav-inner">
        {items.map(it => (
          <button key={it.id} className={'item' + (active === it.id ? ' active' : '')} onClick={() => onChange(it.id)}>
            <span className="nav-chip">
              <svg viewBox="0 0 24 24">{it.icon}</svg>
            </span>
            <span className="nav-label">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

Object.assign(window, {
  AccountBadges, Topbar, AccountSelector, StreakRow, Sparkline, KpiTiles,
  ProductsTable, VideosGrid, ScopePill, PowerDeal, BottomNav,
  fmtMoney, fmtMoneyFull, fmtInt, pct, acctById,
});
