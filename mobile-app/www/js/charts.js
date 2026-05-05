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
    var videoSet = {};
    scrapes.forEach(function (s) {
      (s.videos || []).forEach(function (v) {
        var id = v && v['Video ID'];
        if (id) videoSet[id] = true;
      });
    });
    document.getElementById('kpiVideos').textContent = Object.keys(videoSet).length.toLocaleString();

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

  // ---- Live mode renderers --------------------------------------------

  function findGroupMetric(coreData, metricName) {
    if (!coreData || !coreData.groups) return null;
    for (var i = 0; i < coreData.groups.length; i++) {
      var g = coreData.groups[i];
      if (!g || !g.metrics) continue;
      for (var j = 0; j < g.metrics.length; j++) {
        if (g.metrics[j] && g.metrics[j].name === metricName) return g.metrics[j];
      }
    }
    return null;
  }

  function liveCellValue(coreData, name) {
    var m = findGroupMetric(coreData, name);
    return m ? m.value : '—';
  }

  function renderLiveKpis(latest) {
    var core = latest && latest.coreData;
    document.getElementById('liveKpiGmv').textContent   = liveCellValue(core, 'Attributed GMV');
    document.getElementById('liveKpiItems').textContent = liveCellValue(core, 'Items sold');
    document.getElementById('liveKpiCtr').textContent   = liveCellValue(core, 'LIVE CTR');
    document.getElementById('liveKpiViews').textContent = liveCellValue(core, 'Views');
  }

  // livestreams.table.rows shape:
  //   [name, "Attributed GMV", "GMV", "Items sold", "Views", "CTR", "CTOR", "More"]
  // Column 0 is e.g. "Tik Tok Shop Mother's Day 13:48 2026-05-03 2h11min"
  // (i.e. <title> <HH:MM> <YYYY-MM-DD> <duration>). For the table we want
  // a friendly "Sun 1:48 PM · 2h11min" with the title hidden behind a
  // toggleable info icon; for the chart x-axis we just use date + time.
  var LIVE_NAME_RX = /^(.*?)\s+(\d{1,2}:\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s*$/;
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parseLiveName(raw) {
    var m = LIVE_NAME_RX.exec(String(raw || ''));
    if (!m) return { title: '', time: '', date: '', duration: '', friendly: String(raw || '') };
    return { title: m[1], time: m[2], date: m[3], duration: m[4], friendly: friendlyTime(m[3], m[2]) };
  }

  function friendlyTime(dateStr, timeStr) {
    var d = new Date(dateStr + 'T' + timeStr + ':00');
    if (isNaN(d.getTime())) return dateStr + ' ' + timeStr;
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    var h12 = hours % 12 || 12;
    var ageDays = (Date.now() - d.getTime()) / 86400000;
    var prefix = ageDays >= 7
      ? (d.getMonth() + 1) + '/' + d.getDate()
      : WEEKDAYS[d.getDay()];
    return prefix + ' ' + h12 + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + ampm;
  }

  function liveRowLabel(row) {
    var info = parseLiveName(row && row[0]);
    return info.date ? (info.date + ' ' + info.time) : shorten(info.friendly, 22);
  }

  function liveRows(latest) {
    var t = latest && latest.livestreams && latest.livestreams.table;
    return (t && t.rows) || [];
  }

  function renderLiveChartGmv(rows) {
    // Oldest -> newest along x so the bars read left to right chronologically.
    var data = rows.slice().reverse().map(function (r) {
      return { name: liveRowLabel(r), y: num(r[1]) };
    }).filter(function (p) { return !isNaN(p.y); });
    Highcharts.chart('liveChartGmv', {
      chart: { type: 'column', height: 280 },
      xAxis: { categories: data.map(function (p) { return p.name; }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'USD' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: { pointFormatter: function () { return '<b>$' + this.y.toLocaleString() + '</b>'; } },
      legend: { enabled: false },
      series: [{ name: 'Attributed GMV', data: data.map(function (p) { return p.y; }), colorByPoint: true }]
    });
  }

  function renderLiveChartViews(rows) {
    var data = rows.slice().reverse().map(function (r) {
      return { name: liveRowLabel(r), y: num(r[4]) };
    }).filter(function (p) { return !isNaN(p.y); });
    Highcharts.chart('liveChartViews', {
      chart: { type: 'column', height: 260 },
      xAxis: { categories: data.map(function (p) { return p.name; }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Views' } },
      legend: { enabled: false },
      series: [{ name: 'Views', data: data.map(function (p) { return p.y; }), colorByPoint: true }]
    });
  }

  function renderLiveTable(rows) {
    var tbody = document.querySelector('#liveStreamsTable tbody');
    tbody.innerHTML = '';
    rows.forEach(function (r, i) {
      var info = parseLiveName(r && r[0]);
      var when = info.friendly + (info.duration ? ' · ' + info.duration : '');

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="live-when-cell">' +
          (info.title
            ? '<button type="button" class="live-info-btn" data-row="' + i + '" aria-label="Show LIVE title" aria-expanded="false">i</button>'
            : '') +
          '<span class="live-when">' + escapeHtml(when) + '</span>' +
        '</td>' +
        '<td>' + escapeHtml(r[1] || '—') + '</td>' +
        '<td>' + escapeHtml(r[2] || '—') + '</td>' +
        '<td>' + escapeHtml(r[3] || '—') + '</td>' +
        '<td>' + escapeHtml(r[4] || '—') + '</td>' +
        '<td>' + escapeHtml(r[5] || '—') + '</td>' +
        '<td>' + escapeHtml(r[6] || '—') + '</td>';
      tbody.appendChild(tr);

      if (info.title) {
        var details = document.createElement('tr');
        details.className = 'live-info-row hidden';
        details.setAttribute('data-row', String(i));
        details.innerHTML =
          '<td colspan="7"><span class="live-title-label">Title</span> ' +
          escapeHtml(info.title) + '</td>';
        tbody.appendChild(details);
      }
    });

    tbody.querySelectorAll('.live-info-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = btn.getAttribute('data-row');
        var detail = tbody.querySelector('.live-info-row[data-row="' + idx + '"]');
        if (!detail) return;
        detail.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', detail.classList.contains('hidden') ? 'false' : 'true');
      });
    });
  }

  function renderLive(liveScrapes) {
    var latest = liveScrapes[0]; // sorted desc by API
    var rows   = liveRows(latest);

    renderLiveKpis(latest);
    renderLiveChartGmv(rows);
    renderLiveChartViews(rows);
    renderLiveTable(rows);

    var titleEl = document.getElementById('liveStreamsTitle');
    var ls = latest && latest.livestreams;
    var dr = ls && ls.dateRange;
    if (titleEl) {
      titleEl.textContent = (ls && ls.name ? ls.name : 'All LIVE streams') +
        (dr && dr.start && dr.end ? ' · ' + dr.start + ' – ' + dr.end : '');
    }
  }


  function shorten(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  }); }

  // ---- Public API -----------------------------------------------------

  global.Dashboard = {
    applyTheme: applyTheme,
    renderVideos: function (scrapes) {
      renderKpis(scrapes);
      renderTimeseriesGmv(scrapes);
      renderTimeseriesItems(scrapes);
      renderTopGmv(scrapes);
      renderTopViews(scrapes);
    },
    renderLive: renderLive
  };
})(window);
