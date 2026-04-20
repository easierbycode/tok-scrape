// Highcharts dashboard rendering. All chart instances are recreated on every
// data refresh to keep state simple.

(function (global) {
  'use strict';

  // ---- Helpers ----------------------------------------------------------

  // "$43,029.64" -> 43029.64    "1,586" -> 1586    "" -> NaN
  function num(s) {
    if (s == null) return NaN;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? NaN : n;
  }

  function tsMs(scrape) {
    if (scrape.timestamp) {
      var d = new Date(scrape.timestamp);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    if (scrape.scrapedAt) {
      var d2 = new Date(scrape.scrapedAt);
      if (!isNaN(d2.getTime())) return d2.getTime();
    }
    return Date.now();
  }

  function findMetric(scrape, name) {
    if (!scrape || !scrape.metrics) return null;
    for (var i = 0; i < scrape.metrics.length; i++) {
      if (scrape.metrics[i] && scrape.metrics[i].name === name) return scrape.metrics[i];
    }
    return null;
  }

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function fmtInt(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString();
  }

  // ---- Highcharts global theme ----------------------------------------

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return value ? value.trim() : fallback;
  }

  function applyTheme() {
    if (!global.Highcharts) return;
    Highcharts.setOptions({
      colors: [
        cssVar('--primary', '#f54e00'),
        cssVar('--secondary', '#24243a'),
        cssVar('--success', '#39a561'),
        cssVar('--warning', '#fbbf24'),
        cssVar('--destructive', '#ef4444'),
        cssVar('--accent', '#aeadad')
      ],
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: cssVar('--font-sans', '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif') },
        spacing: [10, 8, 10, 8]
      },
      title: { text: '' },
      credits: { enabled: false },
      legend: {
        itemStyle: { color: cssVar('--foreground', '#f2f1ed') },
        itemHoverStyle: { color: cssVar('--foreground', '#ffffff') }
      },
      xAxis: {
        labels: { style: { color: cssVar('--muted-foreground', 'rgba(242,241,237,.6)') } },
        lineColor: cssVar('--border', 'rgba(242,241,237,.1)'),
        tickColor: cssVar('--border', 'rgba(242,241,237,.1)'),
        gridLineColor: cssVar('--border', 'rgba(242,241,237,.1)')
      },
      yAxis: {
        labels: { style: { color: cssVar('--muted-foreground', 'rgba(242,241,237,.6)') } },
        gridLineColor: cssVar('--border', 'rgba(242,241,237,.1)'),
        title: { style: { color: cssVar('--muted-foreground', 'rgba(242,241,237,.6)') } }
      },
      tooltip: {
        backgroundColor: cssVar('--card', '#232220'),
        style: { color: cssVar('--foreground', '#f2f1ed') },
        borderColor: cssVar('--border', 'rgba(242,241,237,.1)')
      },
      plotOptions: {
        series: { animation: { duration: 300 } },
        line:   { marker: { enabled: false }, lineWidth: 2 },
        area:   { marker: { enabled: false }, lineWidth: 2, fillOpacity: 0.15 },
        column: { borderRadius: 3, borderWidth: 0 },
        pie:    { borderColor: 'transparent' }
      }
    });
  }

  // ---- Renderers --------------------------------------------------------

  function renderKpis(scrapes) {
    document.getElementById('kpiScrapes').textContent = scrapes.length.toLocaleString();

    var creatorSet = {};
    var videoSet   = {};
    scrapes.forEach(function (s) {
      if (s.creator) creatorSet[s.creator] = true;
      (s.videos || []).forEach(function (v) {
        var id = v && v['Video ID'];
        if (id) videoSet[id] = true;
      });
    });
    document.getElementById('kpiCreators').textContent = Object.keys(creatorSet).length.toLocaleString();
    document.getElementById('kpiVideos').textContent   = Object.keys(videoSet).length.toLocaleString();

    var latest = scrapes[0]; // already sorted desc by API
    var gmv = latest && findMetric(latest, 'Affiliate GMV');
    document.getElementById('kpiGMV').textContent = gmv ? gmv.value : '—';
  }

  function timeSeriesByMetric(scrapes, metricName, parseFn) {
    // One point per scrape, grouped per creator.
    var bySeries = {};
    scrapes.slice().reverse().forEach(function (s) {
      var creator = s.creator || '(unknown)';
      var m = findMetric(s, metricName);
      if (!m) return;
      var v = parseFn(m.value);
      if (isNaN(v)) return;
      if (!bySeries[creator]) bySeries[creator] = [];
      bySeries[creator].push([tsMs(s), v]);
    });
    return Object.keys(bySeries).map(function (k) {
      return { name: k, data: bySeries[k] };
    });
  }

  function renderTimeseriesGmv(scrapes) {
    var series = timeSeriesByMetric(scrapes, 'Affiliate GMV', num);
    Highcharts.chart('chartGmv', {
      chart: { type: 'area', height: 280 },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'USD' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: { shared: true, valuePrefix: '$' },
      series: series
    });
  }

  function renderTimeseriesItems(scrapes) {
    var series = timeSeriesByMetric(scrapes, 'Items sold', num);
    Highcharts.chart('chartItems', {
      chart: { type: 'line', height: 260 },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'Items' } },
      tooltip: { shared: true },
      series: series
    });
  }

  function flattenLatestVideos(scrapes) {
    // Dedupe by Video ID, keeping the most recent scrape's values.
    var seen = {};
    scrapes.forEach(function (s) {
      (s.videos || []).forEach(function (v) {
        var id = v && v['Video ID'];
        if (!id || seen[id]) return;
        seen[id] = {
          id:      id,
          name:    v['Name'] || id,
          link:    v['Link'] || '',
          gmv:     num(v['Affiliate GMV']),
          views:   num(v['Views']),
          items:   num(v['Items sold']),
          rpm:     num(v['RPM']),
          creator: s.creator || ''
        };
      });
    });
    return Object.keys(seen).map(function (k) { return seen[k]; });
  }

  function renderTopGmv(scrapes) {
    var vids = flattenLatestVideos(scrapes)
      .filter(function (v) { return !isNaN(v.gmv); })
      .sort(function (a, b) { return b.gmv - a.gmv; })
      .slice(0, 10);
    Highcharts.chart('chartTopGmv', {
      chart: { type: 'bar', height: Math.max(220, 40 * vids.length + 40) },
      xAxis: { categories: vids.map(function (v) { return shorten(v.name, 32); }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Affiliate GMV (USD)' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: { pointFormatter: function () { return '<b>$' + this.y.toLocaleString() + '</b>'; } },
      legend: { enabled: false },
      series: [{ name: 'Affiliate GMV', data: vids.map(function (v) { return v.gmv; }), colorByPoint: true }]
    });
  }

  function renderTopViews(scrapes) {
    var vids = flattenLatestVideos(scrapes)
      .filter(function (v) { return !isNaN(v.views); })
      .sort(function (a, b) { return b.views - a.views; })
      .slice(0, 10);
    Highcharts.chart('chartTopViews', {
      chart: { type: 'bar', height: Math.max(220, 40 * vids.length + 40) },
      xAxis: { categories: vids.map(function (v) { return shorten(v.name, 32); }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Views' } },
      legend: { enabled: false },
      series: [{ name: 'Views', data: vids.map(function (v) { return v.views; }), colorByPoint: true }]
    });
  }

  function renderCreators(scrapes, opts) {
    // Admin (aggregate) view: donut of scrape counts per creator.
    // Member or Login-As view: single creator — donut would be meaningless,
    //   so plot scrapes over time as a column chart instead.
    var scopedToOne = opts && opts.effectiveUser;

    if (!scopedToOne) {
      var counts = {};
      scrapes.forEach(function (s) {
        var k = s.creator || '(unknown)';
        counts[k] = (counts[k] || 0) + 1;
      });
      var data = Object.keys(counts).map(function (k) { return { name: k, y: counts[k] }; });
      Highcharts.chart('chartCreators', {
        chart: { type: 'pie', height: 280 },
        series: [{
          name: 'Scrapes',
          innerSize: '55%',
          data: data,
          dataLabels: {
            style: {
              color: cssVar('--foreground', '#f2f1ed'),
              textOutline: 'none'
            }
          }
        }]
      });
      return;
    }

    // Single-creator timeline: bucket by day (UTC) to keep the bars readable.
    var buckets = {};
    scrapes.forEach(function (s) {
      var d = new Date(tsMs(s));
      var key = d.toISOString().slice(0, 10);          // "YYYY-MM-DD"
      buckets[key] = (buckets[key] || 0) + 1;
    });
    var keys = Object.keys(buckets).sort();
    var series = keys.map(function (k) {
      return [Date.UTC(
        parseInt(k.slice(0,4),10),
        parseInt(k.slice(5,7),10) - 1,
        parseInt(k.slice(8,10),10)
      ), buckets[k]];
    });
    Highcharts.chart('chartCreators', {
      chart: { type: 'column', height: 260 },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'Scrapes' }, allowDecimals: false },
      legend: { enabled: false },
      series: [{ name: 'Scrapes', data: series }]
    });
  }

  function renderTable(scrapes) {
    var tbody = document.querySelector('#scrapesTable tbody');
    tbody.innerHTML = '';
    scrapes.slice(0, 25).forEach(function (s) {
      var tr  = document.createElement('tr');
      var gmv = findMetric(s, 'Affiliate GMV');
      var itm = findMetric(s, 'Items sold');
      var range = (s.dateStart || '?') + ' &rarr; ' + (s.dateEnd || '?');
      tr.innerHTML =
        '<td>' + new Date(tsMs(s)).toLocaleString() + '</td>' +
        '<td>' + escapeHtml(s.creator || '') + '</td>' +
        '<td>' + range + '</td>' +
        '<td>' + (s.videosCount || 0) + '</td>' +
        '<td>' + (gmv ? escapeHtml(gmv.value) : '—') + '</td>' +
        '<td>' + (itm ? escapeHtml(itm.value) : '—') + '</td>';
      tbody.appendChild(tr);
    });
  }

  function shorten(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  }); }

  // ---- Public API -----------------------------------------------------

  global.Dashboard = {
    applyTheme: applyTheme,
    // opts.effectiveUser: when set, the dashboard is scoped to a single
    //   creator (either a logged-in member or an admin's "Login As..."
    //   target). When null/undefined, it's the admin aggregate view.
    render: function (scrapes, opts) {
      renderKpis(scrapes);
      renderTimeseriesGmv(scrapes);
      renderTimeseriesItems(scrapes);
      renderTopGmv(scrapes);
      renderTopViews(scrapes);
      renderCreators(scrapes, opts);
      renderTable(scrapes);
    }
  };
})(window);
