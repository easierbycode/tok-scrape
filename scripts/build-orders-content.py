#!/usr/bin/env python3
"""
Correlate $0/sample orders to the content (videos + LIVEs) made for them.

Pipeline (the "orders -> content" correlation process):
  1. order_list scrape  (extension-seller/scrape-order-list.js)  -> the sample
     products a creator received and needs to make content for. Here we read the
     captured fixture fixtures/orders-wizard.html.
  2. content analytics   (extension-seller affiliate export, source
     `tiktok-affiliate-export`) -> one row per affiliate order, each carrying the
     content_id + content_type (Video/LIVE) that drove the sale AND the
     product_id/product_name it sold. This is the bridge from CONTENT to PRODUCT.
  3. correlate by product name: for each sample product, find the content pieces
     whose sold-product matches it. Empty list => "still needs content".

Data source for step 2 is the live Graylog OpenSearch (recovered) at :9200,
creator:@wizardofdealz. Falls back to the throwaway probe at :9201.

Outputs fixtures/orders-wizard-content.html (self-contained; data embedded).
"""
import re, json, html, unicodedata, collections, urllib.request, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDERS_HTML = os.path.join(ROOT, "fixtures", "orders-wizard.html")
OUT_HTML = os.path.join(ROOT, "fixtures", "orders-wizard-content.html")
CREATOR = "@wizardofdealz"

# ---------------------------------------------------------------- data sources
def os_search(port, body):
    r = urllib.request.Request(f"http://localhost:{port}/graylog_*/_search",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=30))

def fetch_affiliate():
    body = {"size": 1000, "query": {"bool": {"must": [
        {"term": {"creator": CREATOR}},
        {"term": {"source": "tiktok-affiliate-export"}}]}},
        "sort": [{"order_date_iso": "asc"}]}
    for port in ("9200", "9201"):
        try:
            d = os_search(port, body)
            docs = [h["_source"] for h in d["hits"]["hits"]]
            if docs:
                print(f"  affiliate rows from graylog OS :{port}: {len(docs)}", file=sys.stderr)
                return docs
        except Exception as e:
            print(f"  :{port} unavailable ({e})", file=sys.stderr)
    raise SystemExit("no affiliate data found on :9200 or :9201")

# ---------------------------------------------------------------- orders parse
def parse_samples():
    s = open(ORDERS_HTML, encoding="utf-8", errors="replace").read()
    img_re = re.compile(r'<img class="imdcf-base-img"\s+src="([^"]+)"')
    name_re = re.compile(r'font-weight:\s*600[^>]*>\s*<span>([^<]+)</span>', re.S)
    price_re = re.compile(r'<span>(\d+)\s+items?:\s*USD\s*([\d.,]+)</span>')
    status_re = re.compile(r'<span>(Completed|Canceled|Refunded)</span>')
    ms = list(img_re.finditer(s))
    rows = []
    for i, m in enumerate(ms):
        seg = s[m.start():(ms[i+1].start() if i+1 < len(ms) else m.start()+4000)]
        nm, pr = name_re.search(seg), price_re.search(seg)
        if not (nm and pr):
            continue  # store-logo segment, no price
        st = status_re.search(seg)
        clean_name = re.sub(r"\s+", " ", html.unescape(nm.group(1))).strip()
        rows.append({"name": clean_name,
                     "img": html.unescape(m.group(1)),
                     "qty": int(pr.group(1)),
                     "price": float(pr.group(2).replace(",", "")),
                     "status": st.group(1) if st else "Completed"})
    # dedup by product name -> keep image, count orders, min/total price
    by = collections.OrderedDict()
    for r in rows:
        e = by.get(r["name"])
        if not e:
            by[r["name"]] = {"name": r["name"], "img": r["img"], "orders": 1,
                             "price": r["price"], "qty": r["qty"], "status": r["status"]}
        else:
            e["orders"] += 1
            e["price"] = min(e["price"], r["price"])
            e["qty"] += r["qty"]
    return list(by.values()), len(rows)

# ---------------------------------------------------------------- matching
STOP = set(("the a an and or for with of to in on no added your daily use is "
            "by pcs pack packs piece pieces set kit new").split())
def norm(t):
    t = unicodedata.normalize("NFKD", t or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()
def toks(t):
    return set(w for w in norm(t).split() if w not in STOP and len(w) > 2)

def jaccard(a, b):
    if not a or not b: return 0.0
    return len(a & b) / len(a | b)

MATCH_THRESHOLD = 0.50

# ---------------------------------------------------------------- aggregate
def num(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

def video_url(content_id, content_type):
    if content_type and content_type.lower() == "video":
        return f"https://www.tiktok.com/@{CREATOR.lstrip('@')}/video/{content_id}"
    return f"https://www.tiktok.com/@{CREATOR.lstrip('@')}"

def build():
    aff = fetch_affiliate()
    samples, total_sample_orders = parse_samples()

    # content pieces keyed by content_id
    pieces = collections.OrderedDict()
    for r in aff:
        cid = r.get("content_id")
        p = pieces.get(cid)
        if not p:
            p = pieces[cid] = {"content_id": cid, "type": r.get("content_type", ""),
                               "url": video_url(cid, r.get("content_type", "")),
                               "orders": 0, "gmv": 0.0, "commission": 0.0, "items": 0,
                               "date_min": r.get("order_date_iso", ""), "date_max": r.get("order_date_iso", ""),
                               "products": set()}
        p["orders"] += 1
        p["gmv"] += num(r.get("gmv_num"))
        p["commission"] += num(r.get("est_commission_num"))
        p["items"] += int(num(r.get("items_sold_num")))
        d = r.get("order_date_iso", "")
        if d:
            p["date_min"] = min(p["date_min"] or d, d); p["date_max"] = max(p["date_max"] or d, d)
        p["products"].add(r.get("product_name", ""))

    # content-products keyed by product_name
    cprods = collections.OrderedDict()
    for r in aff:
        pn = r.get("product_name", "")
        cp = cprods.get(pn)
        if not cp:
            cp = cprods[pn] = {"name": pn, "product_id": r.get("product_id", ""),
                               "shop": r.get("shop_name", ""), "orders": 0,
                               "gmv": 0.0, "commission": 0.0, "items": 0,
                               "content_ids": set(), "video": 0, "live": 0,
                               "tokens": toks(pn)}
        cp["orders"] += 1
        cp["gmv"] += num(r.get("gmv_num"))
        cp["commission"] += num(r.get("est_commission_num"))
        cp["items"] += int(num(r.get("items_sold_num")))
        cp["content_ids"].add(r.get("content_id"))

    # count video/live per content-product
    for cp in cprods.values():
        for cid in cp["content_ids"]:
            t = pieces[cid]["type"].lower()
            if t == "video": cp["video"] += 1
            elif t == "live": cp["live"] += 1

    # match samples -> content-products
    matched_cp_names = set()
    for s in samples:
        st = toks(s["name"])
        best, score = None, 0.0
        for cp in cprods.values():
            j = jaccard(st, cp["tokens"])
            if j > score:
                best, score = cp, j
        s["match_score"] = round(score, 3)
        if best and score >= MATCH_THRESHOLD:
            s["content_product"] = best["name"]
            matched_cp_names.add(best["name"])
        else:
            s["content_product"] = None

    # mark which content-products were sampled
    for cp in cprods.values():
        cp["sampled"] = cp["name"] in matched_cp_names

    # serialize content-products (with their content pieces)
    def cp_out(cp):
        cps = sorted((pieces[c] for c in cp["content_ids"]),
                     key=lambda p: (-p["gmv"]))
        return {"name": cp["name"], "product_id": cp["product_id"], "shop": cp["shop"],
                "orders": cp["orders"], "gmv": round(cp["gmv"], 2),
                "commission": round(cp["commission"], 2), "items": cp["items"],
                "video": cp["video"], "live": cp["live"], "sampled": cp["sampled"],
                "content": [{"content_id": p["content_id"], "type": p["type"], "url": p["url"],
                             "orders": p["orders"], "gmv": round(p["gmv"], 2),
                             "commission": round(p["commission"], 2), "items": p["items"],
                             "date_min": p["date_min"][:10], "date_max": p["date_max"][:10]} for p in cps]}

    content_products = [cp_out(cp) for cp in sorted(cprods.values(), key=lambda c: -c["gmv"])]
    cp_by_name = {c["name"]: c for c in content_products}

    # attach content to samples
    for s in samples:
        s.pop("qty", None)
        cp = cp_by_name.get(s["content_product"]) if s["content_product"] else None
        s["content"] = cp["content"] if cp else []
        s["content_gmv"] = cp["gmv"] if cp else 0.0
        s["video"] = cp["video"] if cp else 0
        s["live"] = cp["live"] if cp else 0
        s["price"] = round(s["price"], 2)

    total_gmv = round(sum(p["gmv"] for p in content_products), 2)
    total_comm = round(sum(p["commission"] for p in content_products), 2)
    dates = [r.get("order_date_iso", "")[:10] for r in aff if r.get("order_date_iso")]
    data = {
        "creator": CREATOR,
        "generated_from": "Graylog (tiktok-affiliate-export) + order_list scrape fixture",
        "kpis": {
            "sample_products": len(samples),
            "sample_orders": total_sample_orders,
            "samples_with_content": sum(1 for s in samples if s["content"]),
            "content_pieces": len(pieces),
            "videos": sum(1 for p in pieces.values() if p["type"].lower() == "video"),
            "lives": sum(1 for p in pieces.values() if p["type"].lower() == "live"),
            "content_products": len(content_products),
            "content_products_sampled": sum(1 for c in content_products if c["sampled"]),
            "affiliate_orders": len(aff),
            "gmv": total_gmv, "commission": total_comm,
            "date_min": min(dates) if dates else "", "date_max": max(dates) if dates else "",
        },
        "samples": samples,
        "content_products": content_products,
    }
    return data

def render_html(data):
    tpl = open(os.path.join(ROOT, "fixtures", "orders-wizard-content.template.html"),
               encoding="utf-8").read()
    return tpl.replace("/*__DATA_JSON__*/null", json.dumps(data, separators=(",", ":")))

if __name__ == "__main__":
    data = build()
    k = data["kpis"]
    print(json.dumps(k, indent=2), file=sys.stderr)
    out_json = os.path.join(ROOT, "fixtures", "orders-wizard-content.json")
    json.dump(data, open(out_json, "w"), indent=2)
    print("wrote", out_json, file=sys.stderr)
    out_html = render_html(data)
    open(OUT_HTML, "w", encoding="utf-8").write(out_html)
    print("wrote", OUT_HTML, f"({len(out_html)//1024} KB)", file=sys.stderr)
