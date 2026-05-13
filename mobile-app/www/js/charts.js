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

  // Stable per-creator hue, mirroring the picker's colorFor(id) in app.js so
  // the same creator carries the same dot colour across the topbar selector
  // and the dashboard tables/charts. Inputs are normalised to lower-case
  // (without a leading @) so "@PrettyPlug.X" and "@prettyplug.x" hash the
  // same.
  function colorFor(id) {
    var s = String(id || '').replace(/^@+/, '').toLowerCase();
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ' 70% 55%)';
  }

  // Count distinct non-empty values of `field` (default "creator") across an
  // array of objects. Used to decide whether to render creator chips or
  // collapse the per-creator UI back to single-creator layout.
  function distinctCreators(arr, field) {
    field = field || 'creator';
    var seen = Object.create(null);
    (arr || []).forEach(function (item) {
      var v = item && item[field];
      if (v) seen[v] = true;
    });
    return Object.keys(seen);
  }

  // Inline HTML for a creator label: colored dot + handle, all in one row.
  // Caller is responsible for placing it in a cell that allows whitespace
  // wrapping (or `nowrap`, see CSS).
  function creatorChipHtml(handle) {
    if (!handle) return '';
    return '<span class="creator-chip">' +
      '<span class="creator-dot" style="background:' + colorFor(handle) + '"></span>' +
      '<span class="creator-chip-name">' + escapeHtml(handle) + '</span>' +
    '</span>';
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
      accessibility: { enabled: false },
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
        // Highcharts' pie defaults set dataLabels color to "contrast" with a
        // 1px white text-outline. On our dark theme that turns into white
        // text with a white halo around it — readable in theory, fuzzy in
        // practice (see screenshot from 2026-05). Drop the outline and pin
        // the label color to the foreground so the connectors and text both
        // stay legible against the card background.
        pie: {
          borderColor: 'transparent',
          dataLabels: {
            style: {
              color:       cssVar('--foreground', '#f2f1ed'),
              textOutline: 'none',
              fontWeight:  '600',
              fontSize:    '12px'
            },
            connectorColor: cssVar('--muted-foreground', 'rgba(242,241,237,.6)')
          }
        }
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

  // Build a per-bar category label. When multiple creators are in scope we
  // append "· @creator" so the user can tell whose video is whose; for a
  // single creator the suffix is redundant and would just steal label width.
  function topVideoLabel(v, multi) {
    var base = shorten(v.name, multi ? 24 : 32);
    return multi ? base + ' · ' + (v.creator || '') : base;
  }

  function renderTopGmv(scrapes) {
    var vids = flattenLatestVideos(scrapes)
      .filter(function (v) { return !isNaN(v.gmv); })
      .sort(function (a, b) { return b.gmv - a.gmv; })
      .slice(0, 10);
    var multi = distinctCreators(vids).length > 1;
    Highcharts.chart('chartTopGmv', {
      chart: { type: 'bar', height: Math.max(220, 40 * vids.length + 40) },
      xAxis: { categories: vids.map(function (v) { return topVideoLabel(v, multi); }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Affiliate GMV (USD)' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: {
        pointFormatter: function () {
          var v = vids[this.x];
          var who = (multi && v && v.creator) ? '<br><span style="opacity:.7">' + escapeHtml(v.creator) + '</span>' : '';
          return '<b>$' + this.y.toLocaleString() + '</b>' + who;
        }
      },
      legend: { enabled: false },
      series: [{ name: 'Affiliate GMV', data: vids.map(function (v) { return v.gmv; }), colorByPoint: true }]
    });
  }

  function renderTopViews(scrapes) {
    var vids = flattenLatestVideos(scrapes)
      .filter(function (v) { return !isNaN(v.views); })
      .sort(function (a, b) { return b.views - a.views; })
      .slice(0, 10);
    var multi = distinctCreators(vids).length > 1;
    Highcharts.chart('chartTopViews', {
      chart: { type: 'bar', height: Math.max(220, 40 * vids.length + 40) },
      xAxis: { categories: vids.map(function (v) { return topVideoLabel(v, multi); }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Views' } },
      tooltip: {
        pointFormatter: function () {
          var v = vids[this.x];
          var who = (multi && v && v.creator) ? '<br><span style="opacity:.7">' + escapeHtml(v.creator) + '</span>' : '';
          return '<b>' + this.y.toLocaleString() + '</b>' + who;
        }
      },
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
    var d = new Date(m[3] + 'T' + m[2] + ':00');
    return { title: m[1], time: m[2], date: m[3], duration: m[4], friendly: friendlyDate(d, m[3] + ' ' + m[2]) };
  }

  // "Sun 1:48 PM" for dates in the last week, "5/3 1:48 PM" for older. The
  // fallback is rendered when `d` isn't a valid Date — used by the LIVE
  // table to keep its existing behaviour of echoing the original text.
  function friendlyDate(d, fallback) {
    if (!d || isNaN(d.getTime())) return fallback || '';
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

  // Decorate liveRows with the originating scrape's `creator` so the table
  // and charts can attribute each LIVE back to a handle when several
  // creators are in scope. When multi-creator, take the newest scrape per
  // creator so each handle's livestreams are represented exactly once.
  function decoratedLiveRows(liveScrapes, multi) {
    if (!multi) {
      var latest = liveScrapes[0];
      return liveRows(latest).map(function (r) {
        return { row: r, creator: (latest && latest.creator) || '' };
      });
    }
    var out = [];
    latestPerCreator(liveScrapes).forEach(function (s) {
      liveRows(s).forEach(function (r) {
        out.push({ row: r, creator: s.creator || '' });
      });
    });
    return out;
  }

  function renderLiveChartGmv(rows, multi) {
    // Oldest -> newest along x so the bars read left to right chronologically.
    var data = rows.slice().reverse().map(function (entry) {
      var r = entry.row;
      var label = liveRowLabel(r) + (multi && entry.creator ? ' · ' + entry.creator : '');
      return { name: label, y: num(r[1]), creator: entry.creator };
    }).filter(function (p) { return !isNaN(p.y); });
    Highcharts.chart('liveChartGmv', {
      chart: { type: 'column', height: 280 },
      xAxis: { categories: data.map(function (p) { return p.name; }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'USD' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: {
        pointFormatter: function () {
          var who = (multi && data[this.x] && data[this.x].creator)
            ? '<br><span style="opacity:.7">' + escapeHtml(data[this.x].creator) + '</span>' : '';
          return '<b>$' + this.y.toLocaleString() + '</b>' + who;
        }
      },
      legend: { enabled: false },
      series: [{ name: 'Attributed GMV', data: data.map(function (p) { return p.y; }), colorByPoint: true }]
    });
  }

  function renderLiveChartViews(rows, multi) {
    var data = rows.slice().reverse().map(function (entry) {
      var r = entry.row;
      var label = liveRowLabel(r) + (multi && entry.creator ? ' · ' + entry.creator : '');
      return { name: label, y: num(r[4]), creator: entry.creator };
    }).filter(function (p) { return !isNaN(p.y); });
    Highcharts.chart('liveChartViews', {
      chart: { type: 'column', height: 260 },
      xAxis: { categories: data.map(function (p) { return p.name; }), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'Views' } },
      tooltip: {
        pointFormatter: function () {
          var who = (multi && data[this.x] && data[this.x].creator)
            ? '<br><span style="opacity:.7">' + escapeHtml(data[this.x].creator) + '</span>' : '';
          return '<b>' + this.y.toLocaleString() + '</b>' + who;
        }
      },
      legend: { enabled: false },
      series: [{ name: 'Views', data: data.map(function (p) { return p.y; }), colorByPoint: true }]
    });
  }

  function renderLiveTable(rows, multi) {
    var thead = document.querySelector('#liveStreamsTable thead');
    var tbody = document.querySelector('#liveStreamsTable tbody');

    // Re-render the header so the Creator column appears/disappears with
    // multi. Mirrors the affiliate table.
    thead.innerHTML = '<tr>' +
      (multi ? '<th>Creator</th>' : '') +
      '<th>When</th><th>Attributed GMV</th><th>GMV</th><th>Items</th><th>Views</th><th>CTR</th><th>CTOR</th>' +
      '</tr>';

    var colSpan = multi ? 8 : 7;
    tbody.innerHTML = '';
    rows.forEach(function (entry, i) {
      var r = entry.row;
      var info = parseLiveName(r && r[0]);
      var when = info.friendly + (info.duration ? ' · ' + info.duration : '');

      var tr = document.createElement('tr');
      tr.innerHTML =
        (multi ? '<td>' + creatorChipHtml(entry.creator) + '</td>' : '') +
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
          '<td colspan="' + colSpan + '"><span class="live-title-label">Title</span> ' +
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
    var multi = distinctCreators(liveScrapes).length > 1;
    var rows  = decoratedLiveRows(liveScrapes, multi);

    // KPIs and the table title still come from the single newest scrape — a
    // multi-creator aggregate of CTR / Views / GMV across creators isn't
    // straightforward (the values are pre-formatted strings) so we keep KPIs
    // representative-of-most-recent and let the per-creator info live in the
    // table + chart bars.
    var latest = liveScrapes[0];
    renderLiveKpis(latest);
    renderLiveChartGmv(rows, multi);
    renderLiveChartViews(rows, multi);
    renderLiveTable(rows, multi);

    var titleEl = document.getElementById('liveStreamsTitle');
    var ls = latest && latest.livestreams;
    var dr = ls && ls.dateRange;
    if (titleEl) {
      titleEl.textContent = (ls && ls.name ? ls.name : 'All LIVE streams') +
        (dr && dr.start && dr.end ? ' · ' + dr.start + ' – ' + dr.end : '');
    }
  }


  // ---- Data-overview renderer (Compass "Data Overview" page) ------------

  // The data-overview page exposes ~8 metric tiles. We surface a curated
  // subset by name so the card stays glanceable. The picker order matters —
  // first-match wins when multiple tile names alias to the same KPI.
  // Each entry: [pretty label, [aliases that match metric.name verbatim]].
  var OVERVIEW_TILES = [
    ['Attributed GMV',  ['Attributed GMV', 'attributed_gmv_metric_name_short_ui']],
    ['Video GMV',       ['Video GMV']],
    ['LIVE GMV',        ['LIVE GMV']],
    ['Items sold',      ['Items sold']],
    ['Product views',   ['Product views']],
    ['Product clicks',  ['Product clicks']],
    ['Est. commission', ['Est. commission']]
  ];

  function pickOverviewMetric(metrics, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      for (var j = 0; j < metrics.length; j++) {
        if (metrics[j] && metrics[j].name === aliases[i]) return metrics[j];
      }
    }
    return null;
  }

  // Format the date-range header for a single overview snapshot.
  function overviewRangeText(s) {
    if (!s) return '';
    if (s.dateStart && s.dateEnd) return s.dateStart + ' → ' + s.dateEnd;
    if (s.dateStart) return s.dateStart;
    return s.dateLabel || '';
  }

  // Inclusive day-span between an overview snapshot's dateStart/dateEnd, or
  // -1 if either is missing/unparseable. Parsed as UTC so DST + locale TZ
  // shifts can't bump us by ±1 day.
  function spanDaysInclusive(s) {
    if (!s || !s.dateStart || !s.dateEnd) return -1;
    var a = Date.parse(s.dateStart + 'T00:00:00Z');
    var b = Date.parse(s.dateEnd   + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return -1;
    return Math.round((b - a) / 86400000);
  }

  // Collapse the full snapshot list to one entry per creator (newest first).
  // Input is already newest-first per fetchDataOverview, so taking the first
  // hit for each creator gives us their most recent snapshot.
  function latestPerCreator(scrapes) {
    var seen = Object.create(null);
    var out = [];
    (scrapes || []).forEach(function (s) {
      var c = s && s.creator;
      if (!c || seen[c]) return;
      seen[c] = true;
      out.push(s);
    });
    return out;
  }

  // Build a <div class="kpi-row"> populated with whichever OVERVIEW_TILES
  // resolve to a real metric for this snapshot. Missing tiles are skipped so
  // sources that carry only a subset don't render dead em-dashes.
  function buildOverviewKpiRow(metrics) {
    var row = document.createElement('div');
    row.className = 'kpi-row';
    OVERVIEW_TILES.forEach(function (tile) {
      var label = tile[0];
      var m = pickOverviewMetric(metrics, tile[1]);
      if (!m) return;
      var cell = document.createElement('div');
      cell.className = 'kpi-cell';
      var labelDiv = document.createElement('div');
      labelDiv.className = 'kpi-label';
      labelDiv.textContent = label;
      var valDiv = document.createElement('div');
      valDiv.className = 'kpi-val';
      valDiv.textContent = m.value || '—';
      cell.appendChild(labelDiv);
      cell.appendChild(valDiv);
      row.appendChild(cell);
    });
    return row;
  }

  function renderOverview(scrapes, opts) {
    var card = document.getElementById('overviewCard');
    if (!card) return;
    var requiredSpan = opts && typeof opts.spanDays === 'number' ? opts.spanDays : null;
    var pool = scrapes || [];
    if (requiredSpan !== null) {
      pool = pool.filter(function (s) { return spanDaysInclusive(s) === requiredSpan; });
    }
    var perCreator = latestPerCreator(pool);
    if (!perCreator.length) {
      card.classList.add('hidden');
      card.innerHTML = '';
      return;
    }
    var multi = perCreator.length > 1;

    // Wipe and rebuild the card body. Cheap (≤ a handful of nodes) and keeps
    // the multi/single transitions correct without state-tracking quirks.
    card.innerHTML = '';

    if (multi) {
      // Single overall title; per-creator sub-sections each carry their own
      // creator chip + date range + KPI row.
      var head = document.createElement('div');
      head.className = 'overview-head';
      head.innerHTML = '<span class="overview-title">Data Overview</span>';
      card.appendChild(head);

      perCreator.forEach(function (s) {
        var block = document.createElement('div');
        block.className = 'overview-creator';
        var subhead = document.createElement('div');
        subhead.className = 'overview-creator-head';
        subhead.innerHTML =
          creatorChipHtml(s.creator) +
          '<span class="overview-range">' + escapeHtml(overviewRangeText(s)) + '</span>';
        block.appendChild(subhead);
        block.appendChild(buildOverviewKpiRow(s.metrics || []));
        card.appendChild(block);
      });
    } else {
      var single = perCreator[0];
      var head2 = document.createElement('div');
      head2.className = 'overview-head';
      head2.innerHTML =
        '<span class="overview-title">Data Overview</span>' +
        '<span class="overview-range">' + escapeHtml(overviewRangeText(single)) + '</span>';
      card.appendChild(head2);
      card.appendChild(buildOverviewKpiRow(single.metrics || []));
    }

    // Hide the card if every snapshot's metrics resolved to nothing.
    var hasAnyTile = card.querySelector('.kpi-cell') !== null;
    card.classList.toggle('hidden', !hasAnyTile);
  }

  // ---- Affiliate orders renderer (xlsx upload) -------------------------

  function renderAffiliateKpis(orders) {
    var totalGmv = 0, totalItems = 0, totalCommission = 0;
    orders.forEach(function (o) {
      if (!isNaN(o.gmv))           totalGmv        += o.gmv;
      if (!isNaN(o.itemsSold))     totalItems      += o.itemsSold;
      // Prefer actual commission once it's settled; otherwise fall back to
      // the estimate. This matches what shows up in the affiliate dashboard.
      var c = !isNaN(o.actualCommission) ? o.actualCommission
            : (!isNaN(o.estCommission)   ? o.estCommission   : NaN);
      if (!isNaN(c)) totalCommission += c;
    });
    document.getElementById('affKpiOrders').textContent     = orders.length.toLocaleString();
    document.getElementById('affKpiGmv').textContent        = fmtMoney(totalGmv);
    document.getElementById('affKpiItems').textContent      = fmtInt(totalItems);
    document.getElementById('affKpiCommission').textContent = fmtMoney(totalCommission);
  }

  // Day key derived from the order's local order_date_iso, so two orders on
  // the same calendar day in the seller's TZ stack into one bar regardless of
  // the timestamp Graylog assigned.
  function dayKey(o) {
    var iso = o.orderDateIso || '';
    if (iso.length >= 10) return iso.slice(0, 10);
    if (o.timestamp) {
      var d = new Date(o.timestamp);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
      }
    }
    return '';
  }

  function renderAffiliateGmvByDay(orders) {
    var byDay = {};
    orders.forEach(function (o) {
      var k = dayKey(o);
      if (!k || isNaN(o.gmv)) return;
      byDay[k] = (byDay[k] || 0) + o.gmv;
    });
    var days = Object.keys(byDay).sort();
    var data = days.map(function (k) {
      // UTC noon avoids DST jitter on the x-axis.
      return [Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 12), byDay[k]];
    });
    Highcharts.chart('affChartGmv', {
      chart: { type: 'column', height: 280 },
      xAxis: { type: 'datetime' },
      yAxis: { title: { text: 'GMV (USD)' }, labels: { formatter: function () { return '$' + this.value.toLocaleString(); } } },
      tooltip: { pointFormatter: function () { return '<b>$' + this.y.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</b>'; } },
      legend: { enabled: false },
      series: [{ name: 'GMV', data: data, colorByPoint: false }]
    });
  }

  function renderAffiliateGmvByType(orders) {
    var byType = {};
    orders.forEach(function (o) {
      if (isNaN(o.gmv)) return;
      var t = (o.contentType || '').trim() || 'Unknown';
      byType[t] = (byType[t] || 0) + o.gmv;
    });
    var data = Object.keys(byType).map(function (k) { return { name: k, y: byType[k] }; });
    Highcharts.chart('affChartType', {
      chart: { type: 'pie', height: 260 },
      tooltip: { pointFormatter: function () { return '<b>$' + this.y.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</b> (' + this.percentage.toFixed(1) + '%)'; } },
      series: [{ name: 'GMV', data: data, colorByPoint: true }]
    });
  }

  function renderAffiliateTable(orders) {
    var multi = distinctCreators(orders).length > 1;
    var thead = document.querySelector('#affOrdersTable thead');
    var tbody = document.querySelector('#affOrdersTable tbody');

    // Re-render the header so the Creator column appears/disappears with
    // multi. Doing it here (instead of in HTML) keeps the truth in one place.
    thead.innerHTML = '<tr>' +
      (multi ? '<th>Creator</th>' : '') +
      '<th>Order date</th><th>Type</th><th>Product</th><th>GMV</th><th>Items</th><th>Est. commission</th>' +
      '</tr>';

    tbody.innerHTML = '';
    // Most recent first, capped at 50.
    var sorted = orders.slice().sort(function (a, b) {
      var ta = a.orderDateIso || a.timestamp || '';
      var tb = b.orderDateIso || b.timestamp || '';
      return tb < ta ? -1 : tb > ta ? 1 : 0;
    }).slice(0, 50);
    sorted.forEach(function (o) {
      var commission = !isNaN(o.actualCommission) ? o.actualCommission
                     : (!isNaN(o.estCommission)   ? o.estCommission   : NaN);
      // orderDateIso is the locally-shaped "YYYY-MM-DDTHH:MM:SS" set by the
      // upload pipeline (app.js:affiliateDateToIso). Falling back to the raw
      // "DD/MM/YYYY HH:MM:SS" keeps the cell legible if a row predates that
      // conversion (or comes from a future re-import that drops the field).
      var when = friendlyDate(o.orderDateIso ? new Date(o.orderDateIso) : null, o.orderDate);
      var tr = document.createElement('tr');
      tr.innerHTML =
        (multi ? '<td>' + creatorChipHtml(o.creator) + '</td>' : '') +
        '<td>' + escapeHtml(when) + '</td>' +
        '<td>' + escapeHtml(o.contentType || '') + '</td>' +
        '<td>' + escapeHtml(shorten(o.productName, 60)) + '</td>' +
        '<td>' + (isNaN(o.gmv) ? '\u2014' : fmtMoney(o.gmv)) + '</td>' +
        '<td>' + (isNaN(o.itemsSold) ? '\u2014' : fmtInt(o.itemsSold)) + '</td>' +
        '<td>' + (isNaN(commission) ? '\u2014' : fmtMoney(commission)) +
          (isNaN(o.actualCommission) && !isNaN(o.estCommission) ? ' <span class="aff-est">est</span>' : '') +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderAffiliate(orders) {
    if (!orders || !orders.length) return;
    renderAffiliateKpis(orders);
    renderAffiliateGmvByDay(orders);
    renderAffiliateGmvByType(orders);
    renderAffiliateTable(orders);
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
    renderLive: renderLive,
    renderAffiliate: renderAffiliate,
    renderOverview: renderOverview
  };
})(window);
