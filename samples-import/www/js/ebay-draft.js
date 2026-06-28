// eBay draft listing — a literal snapshot of the eBay "Create your listing"
// page, pre-filled with a sample's data, with "tap to autofill" chips hovering
// over each form field. Clicking "Open in eBay & autofill" opens the real eBay
// listing page (window.open) and asks the host/Claude-in-Chrome browser skill to
// autofill it (logging in first if needed) — see the data-pimp `ebay-listing`
// skill for the autofill workflow.
//
//   window.EbayDraft.show(product)   product = {productId, name, price, image, seller, description?}
//   window.EbayDraft.hide()
(function () {
  "use strict";
  if (window.EbayDraft) return;

  var EBAY_SELL_URL = "https://www.ebay.com/sl/sell";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    return isFinite(v) && v > 0 ? "$" + v.toFixed(2) : "—";
  }
  function draftDescription(p) {
    if (p.description) return p.description;
    return "Brand-new, sealed TikTok Shop sample" +
      (p.seller ? " from " + p.seller : "") +
      ". Ships same-day from a smoke-free home. See item specifics for details.";
  }

  function injectStyle() {
    if (document.getElementById("ebd-style")) return;
    var css =
      "#ebd-ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(6,8,12,.62);backdrop-filter:blur(2px);padding:24px;animation:ebdIn .2s ease;}" +
      "#ebd-ov *{box-sizing:border-box;}" +
      "@keyframes ebdIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes ebdPulse{0%,100%{opacity:.55}50%{opacity:1}}" +
      ".ebd-page{position:relative;width:min(560px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#111;" +
      "border-radius:14px;box-shadow:0 40px 90px -30px rgba(0,0,0,.7);font-family:system-ui,sans-serif;}" +
      ".ebd-top{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;}" +
      ".ebd-logo{font-weight:700;font-size:21px;letter-spacing:-.5px;}" +
      ".ebd-logo .a{color:#e53238}.ebd-logo .b{color:#0064d2}.ebd-logo .c{color:#f5af02}.ebd-logo .d{color:#86b817}" +
      ".ebd-h{font-size:15px;color:#555;}" +
      ".ebd-x{margin-left:auto;border:none;background:#f3f4f6;color:#444;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;}" +
      ".ebd-body{padding:16px;display:flex;flex-direction:column;gap:15px;}" +
      ".ebd-fld{position:relative;}" +
      ".ebd-fld>label{display:block;font-size:12px;color:#6b7280;margin-bottom:5px;font-weight:600;}" +
      ".ebd-box{border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:14px;min-height:20px;}" +
      ".ebd-photo{display:flex;gap:10px;align-items:center;}" +
      ".ebd-ph{width:74px;height:74px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb;background:#eef2ff;}" +
      ".ebd-phx{width:74px;height:74px;border-radius:8px;border:1px dashed #c7cdd6;color:#9aa3af;display:flex;align-items:center;justify-content:center;font-size:26px;}" +
      ".ebd-row{display:flex;gap:12px;}.ebd-row .ebd-fld{flex:1;}" +
      ".ebd-pill{display:inline-block;background:#e7f5e9;color:#1b7a2e;font-size:12px;padding:2px 10px;border-radius:99px;}" +
      ".ebd-chip{position:absolute;top:-9px;right:8px;display:inline-flex;align-items:center;gap:5px;background:#fff3e6;color:#b3560a;" +
      "border:1px solid #f3c08a;font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;animation:ebdPulse 1.8s ease-in-out infinite;cursor:default;}" +
      ".ebd-banner{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#b3560a;background:#fff3e6;border:1px solid #f3c08a;border-radius:8px;padding:8px 11px;margin:0 16px;margin-top:14px;}" +
      ".ebd-foot{position:sticky;bottom:0;background:#fff;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:13px 16px;border-top:1px solid #e5e7eb;}" +
      ".ebd-meta{font-size:12px;color:#9aa3af;}" +
      ".ebd-open{background:#0064d2;color:#fff;border:none;border-radius:99px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer;}" +
      ".ebd-open:active{transform:scale(.98);}" +
      ".ebd-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#14181f;color:#f5f7f9;border:1px solid #2a313d;" +
      "border-radius:10px;padding:10px 14px;font-size:13px;z-index:2147483601;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.5);}";
    var el = document.createElement("style");
    el.id = "ebd-style";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function chip(label) {
    return '<span class="ebd-chip">☝ ' + esc(label) + "</span>";
  }

  function show(product) {
    injectStyle();
    hide();
    var p = product || {};
    var img = p.image
      ? '<img class="ebd-ph" alt="" src="' + esc(p.image) + '" onerror="this.style.display=\'none\'" />'
      : '<div class="ebd-phx">+</div>';

    var ov = document.createElement("div");
    ov.id = "ebd-ov";
    ov.innerHTML =
      '<div class="ebd-page" role="dialog" aria-label="eBay draft listing">' +
        '<div class="ebd-top">' +
          '<span class="ebd-logo"><span class="a">e</span><span class="b">b</span><span class="c">a</span><span class="d">y</span></span>' +
          '<span class="ebd-h">Create your listing</span>' +
          '<button class="ebd-x" aria-label="Close" id="ebd-close">×</button>' +
        "</div>" +
        '<div class="ebd-banner">✎ Draft from sample “' + esc(p.name || p.productId || "sample") +
          '” — tap a field to autofill, or open it in eBay.</div>' +
        '<div class="ebd-body">' +
          '<div class="ebd-fld"><label>Photos</label><div class="ebd-photo">' + img +
            '<div class="ebd-phx">+</div></div>' + chip("autofill photo") + "</div>" +
          '<div class="ebd-fld"><label>Listing title</label><div class="ebd-box">' +
            esc(p.name || p.productId || "") + "</div>" + chip("autofill title") + "</div>" +
          '<div class="ebd-row">' +
            '<div class="ebd-fld"><label>Condition</label><div class="ebd-box"><span class="ebd-pill">New</span></div>' +
              chip("autofill") + "</div>" +
            '<div class="ebd-fld"><label>Price · Buy It Now</label><div class="ebd-box">' +
              money(p.price) + "</div>" + chip("autofill price") + "</div>" +
          "</div>" +
          '<div class="ebd-fld"><label>Description</label><div class="ebd-box" style="color:#444;line-height:1.55;">' +
            esc(draftDescription(p)) + "</div>" + chip("autofill description") + "</div>" +
        "</div>" +
        '<div class="ebd-foot">' +
          '<span class="ebd-meta">' + (p.image ? "1 photo · " : "") + money(p.price) +
            " · productId " + esc(p.productId || "?") + "</span>" +
          '<button class="ebd-open" id="ebd-open">Open in eBay &amp; autofill ↗</button>' +
        "</div>" +
      "</div>";

    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) hide(); });
    document.getElementById("ebd-close").addEventListener("click", hide);
    document.getElementById("ebd-open").addEventListener("click", function () {
      openInEbay(p);
    });
  }

  function openInEbay(p) {
    // Open the real eBay create-listing page. The Claude-in-Chrome browser skill
    // (data-pimp `ebay-listing`) autofills it from the draft; if the host (Thirsty
    // OS) is listening, hand it the draft so it can drive the autofill directly.
    try {
      window.parent && window.parent.postMessage(
        { type: "ebay-autofill", product: p, url: EBAY_SELL_URL }, "*",
      );
    } catch (e) {}
    try { window.open(EBAY_SELL_URL, "_blank", "noopener"); } catch (e) {}
    toast("Opened eBay — ask Claude to “autofill this eBay listing” to populate it from the sample.");
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.getElementById("ebd-toast");
    if (old) old.remove();
    var t = document.createElement("div");
    t.id = "ebd-toast";
    t.className = "ebd-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (t.parentNode) t.remove(); }, 5200);
  }

  function hide() {
    var ov = document.getElementById("ebd-ov");
    if (ov) ov.remove();
  }

  window.EbayDraft = { show: show, hide: hide };
})();
