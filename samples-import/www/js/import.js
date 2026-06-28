// Samples-Import orchestrator.
//
// Replaces the orders-demo scraper (ext/demo.js): instead of snapshotting a fake
// order page, it reads a pasted/uploaded list of TikTok product IDs, hydrates
// each via data-pimp, shows it in the shared (flicker-free) order modal, and adds
// it to inventory ASSIGNED TO A CREATOR via the live import API. Optionally
// records a scheduled (stub) marketplace listing after N days.
//
// All persistence is real calls to thirsty.store (CORS-enabled):
//   GET  /api/product-lookup/:id     -> hydrate {name, price, image, seller}
//   GET  /api/product-creators?...   -> derived creator suggestions
//   POST /api/sample-import          -> create row + assign to creator + note
(function () {
  "use strict";

  var API = (new URLSearchParams(location.search).get("api") ||
    "https://thirsty.store").replace(/\/+$/, "");

  var $ = function (id) { return document.getElementById(id); };
  var idsEl = $("ids"), fileEl = $("file"), countEl = $("count");
  var creatorEl = $("creator"), suggestEl = $("suggest"), suggestNote = $("suggest-note");
  var creatorList = $("creator-list");
  var autolistEl = $("autolist"), autoPanel = $("autolist-panel");
  var videosEl = $("videos"), goalEl = $("goal"), marketplaceEl = $("marketplace"), daysNote = $("days-note");
  var startEl = $("start"), logEl = $("log"), summaryEl = $("summary");

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };

  // TikTok product IDs are long digit runs; tolerate JSON arrays, CSV, or lines.
  function parseIds(text) {
    var out = [], seen = {};
    var m = String(text || "").match(/\d{6,}/g) || [];
    for (var i = 0; i < m.length; i++) {
      if (!seen[m[i]]) { seen[m[i]] = 1; out.push(m[i]); }
    }
    return out;
  }
  function currentIds() { return parseIds(idsEl.value); }
  function normCreator(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    return s.charAt(0) === "@" ? s : "@" + s.replace(/^@+/, "");
  }
  function refreshCount() {
    var n = currentIds().length;
    countEl.textContent = n + " product ID" + (n === 1 ? "" : "s");
  }
  function daysNeeded() {
    return Math.max(1, Math.ceil(num(videosEl.value) / Math.max(1, num(goalEl.value))));
  }
  function refreshDaysNote() {
    var d = daysNeeded();
    daysNote.textContent = num(videosEl.value) + " videos @ " + num(goalEl.value) +
      "/day → auto-list in ~" + d + " day" + (d === 1 ? "" : "s") + ".";
  }

  idsEl.addEventListener("input", refreshCount);
  fileEl.addEventListener("change", function () {
    var f = fileEl.files && fileEl.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var ids = parseIds(reader.result);
      idsEl.value = (idsEl.value ? idsEl.value.trim() + "\n" : "") + ids.join("\n");
      refreshCount();
    };
    reader.readAsText(f);
  });
  autolistEl.addEventListener("change", function () {
    autoPanel.hidden = !autolistEl.checked;
    if (autolistEl.checked) refreshDaysNote();
  });
  [videosEl, goalEl].forEach(function (el) { el.addEventListener("input", refreshDaysNote); });

  suggestEl.addEventListener("click", function () {
    var ids = currentIds();
    if (!ids.length) { suggestNote.textContent = "Paste a product ID first."; return; }
    suggestNote.textContent = "Deriving creators who ordered " + ids[0] + "…";
    fetch(API + "/api/product-creators?all=1&productId=" + encodeURIComponent(ids[0]))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var ordered = (d && d.orderedCreators) || [];
        var all = (d && (d.allKnown || d.creators)) || [];
        var list = ordered.concat(all.filter(function (c) { return ordered.indexOf(c) < 0; }));
        creatorList.innerHTML = "";
        list.forEach(function (c) {
          var o = document.createElement("option"); o.value = c; creatorList.appendChild(o);
        });
        suggestNote.textContent = ordered.length
          ? (ordered.length + " ordered this product: " + ordered.join(", ") + " (agency-derived labels)")
          : (list.length ? "No one ordered it yet — showing all known creators." : "No creators found.");
      })
      .catch(function () { suggestNote.textContent = "Could not reach the creator list."; });
  });

  function hydrate(id) {
    return fetch(API + "/api/product-lookup/" + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && !d.error && (d.name || d.price)) {
          return { productId: id, name: d.name || id, price: d.price || 0, image: d.image || null, seller: d.seller || null };
        }
        return { productId: id, name: id, price: 0, image: null, seller: null };
      })
      .catch(function () { return { productId: id, name: id, price: 0, image: null, seller: null }; });
  }

  function showModal(h) {
    try {
      window.LifeTemplate.show({
        shopName: h.seller || "TikTok Shop",
        shopIconSrc: "",
        description: h.name || h.productId,
        productImgSrc: h.image || "",
        dateText: "Imported",
        statusText: "Importing…",
        isSample: true,
        priceText: h.price ? ("$" + Number(h.price).toFixed(2)) : "",
        strikeText: null,
        retailText: null,
      });
    } catch (e) { /* modal is a flourish; import proceeds regardless */ }
  }

  function importOne(h, creator, days, marketplace) {
    var body = {
      productId: h.productId, name: h.name, price: h.price,
      image: h.image, seller: h.seller, creator: creator,
    };
    if (days > 0) { body.autoListAfterDays = days; body.marketplace = marketplace; }
    return fetch(API + "/api/sample-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: String((e && e.message) || e) }; });
  }

  function line(cls, ico, name, meta, enrichment) {
    var el = document.createElement("div");
    el.className = "line " + cls;
    var enr = (enrichment && enrichment.length)
      ? '<span class="enr">' + enrichment.map(esc).join(" ") + "</span>" : "";
    el.innerHTML = '<span class="ico">' + ico + '</span><span><span class="name">' +
      esc(name) + '</span> <span class="meta">' + esc(meta || "") + "</span>" + enr + "</span>";
    logEl.appendChild(el);
    el.scrollIntoView({ block: "nearest" });
    return el;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // A "eBay draft" action on an imported line → the eBay listing snapshot.
  function addDraftButton(el, product) {
    if (!el || !window.EbayDraft) return;
    var btn = document.createElement("button");
    btn.className = "draft-btn";
    btn.type = "button";
    btn.textContent = "eBay draft";
    btn.addEventListener("click", function () { window.EbayDraft.show(product); });
    el.appendChild(btn);
  }

  async function run() {
    var ids = currentIds();
    var creator = normCreator(creatorEl.value);
    if (!ids.length) { line("bad", "✕", "Nothing to import", "paste or upload product IDs first"); return; }
    if (!creator) { line("bad", "✕", "No creator", "enter a creator @handle to assign to"); return; }

    var days = autolistEl.checked ? daysNeeded() : 0;
    var marketplace = (marketplaceEl.value || "ebay").trim() || "ebay";

    startEl.disabled = true;
    logEl.innerHTML = "";
    summaryEl.hidden = true;
    try { await window.LifeTemplate.ensure(); } catch (e) { /* modal optional */ }

    var ok = 0, fail = 0, scheduled = 0;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var pending = line("pending", "○", id, "hydrating…");
      var h = await hydrate(id);
      pending.querySelector(".name").textContent = h.name;
      pending.querySelector(".meta").textContent = "assigning to " + creator + "…";
      showModal(h);
      var res = await importOne(h, creator, days, marketplace);
      pending.remove();
      if (res && res.ok) {
        ok++;
        if (res.scheduledListing) scheduled++;
        var okLine = line("ok", "✓", res.name || h.name, "→ " + creator +
          (res.campaign ? ' · campaign "' + res.campaign + '"' : ""), res.enrichment || []);
        addDraftButton(okLine, {
          productId: h.productId, name: res.name || h.name,
          price: h.price, image: h.image, seller: h.seller,
        });
      } else {
        fail++;
        line("bad", "✕", h.name, (res && res.error) || "import failed");
      }
      await sleep(380);
    }

    try { window.LifeTemplate.hide(); } catch (e) {}
    summaryEl.hidden = false;
    summaryEl.innerHTML = "Imported <b>" + ok + "</b> of " + ids.length +
      " sample" + (ids.length === 1 ? "" : "s") + " → assigned to <b>" + esc(creator) + "</b>" +
      (fail ? " · <b>" + fail + "</b> failed" : "") +
      (scheduled ? " · <b>" + scheduled + "</b> auto-list scheduled (~" + days + "d, draft stub)" : "") + ".";
    startEl.disabled = false;
  }

  startEl.addEventListener("click", run);
  refreshCount();
})();
