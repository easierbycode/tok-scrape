# extension-creator-demo — Lifepreneur "Sample Value"

A self-contained Chrome (MV3) demo that tells the **Lifepreneur** story over the
orders fixture: most of your TikTok Shop orders are **$0 free samples**, and
this overlay corroborates them against their **retail value**.

Supported order-list URLs:

- `http://localhost:8741/fixtures/orders.html`
- `http://localhost:5173/orders/`
- `https://easierbycode.com/tok-scrape/fixtures/orders.html`
- `https://www.tiktok.com/shop/order_list`

## What it does

Click the toolbar icon and it:

1. **Uses the active order-list tab** when it is already on local
   `orders.html`, local `/orders/`, the deployed fixture, or TikTok's live
   buyer order list at `https://www.tiktok.com/shop/order_list`. From any other tab, it navigates to
   `https://easierbycode.com/tok-scrape/fixtures/orders.html`.
2. **Loops every order.** For each one it flashes the *View order details* button
   and opens a detail **template** — the real `fixtures/order.html` from the
   current fixture host when available, otherwise the deployed detail fixture,
   rendered in an iframe (its scripts stripped so its React bundle can't hydrate
   over the fills) with the **shop icon/name, product description, purchase date
   and price** filled in.
3. **Marks ~9 of every 10 orders as samples:** their price is swapped to **$0.00**
   and the struck-through "original" price is removed.
4. **Looks up each sample's retail value** by its description — the background
   service worker searches `https://shop.tiktok.com/us/s?q=<description>` and pulls
   the first price out of the results. TikTok renders its grid client-side and
   gates bots, so when a price can't be parsed the demo falls back to a
   deterministic estimate (logged), and the tally always completes.
5. **Persists priced samples to the Thirsty kiosk.** Samples the kiosk does not
   already have a price for (checked by product id and name against
   `/api/unpriced-samples` + `/api/products`) are saved before the results
   overlay: first via the kiosk's `POST /api/sample-products`, and — when the
   kiosk is unreachable, older than this feature, or could not reach Graylog —
   as a GELF message written straight to Graylog (`core_data_json` +
   `sample_edit_json`), exactly like the seller/agency scrapers. Either way the
   product is searchable at `thirsty-store-kiosk.easierbycode.deno.net`
   afterwards. The Graylog endpoint/token at the top of `background.js` are
   rewritten by the `bookmarklet-sync` sidecar on `docker compose up`.
6. **Shows the valuation overlay** — a vanilla-JS + Shadow-DOM port of the Claude
   Design handoff *Lifepreneur Sample Value.html* (accent `#e8650a`): a top
   **Scanning** HUD while it loops, then the **Results** state with the hero total,
   avg/sample, resale-at-10%, monthly pace, a category breakdown and the itemized
   sample list. (The design's **Queued / 24h** state is ported too — `showQueued`.)

## Files

| file | role |
|------|------|
| `manifest.json` | MV3; host perms for localhost, `easierbycode.com`, `www.tiktok.com` + `shop.tiktok.com` |
| `background.js` | toolbar click → use current supported order list or navigate + inject; TikTok price-lookup relay |
| `demo.js` | orchestrator: snapshot orders → loop templates → tally → overlay |
| `template.js` | renders same-host `order.html` in an iframe and fills each order's fields |
| `lifepreneur.js` | the Shadow-DOM overlay (Scanning HUD + Results + Queued) |
| `icons/` | identical to `extension-seller/icons/` |

## Load it

`chrome://extensions` → Developer mode → **Load unpacked** → pick this folder.
Then click the toolbar icon on any tab (it will navigate to the fixture itself).
If you are already on `http://localhost:8741/fixtures/orders.html`,
`http://localhost:5173/orders/`, or `https://www.tiktok.com/shop/order_list`,
the demo will run there without navigating away.

## Notes / scope

- The dollar figures are scoped entirely to this feature — the club's own
  initiative — and are not real prices unless a live TikTok lookup resolves.
- The sample/paid split is deterministic (~9/10) so a run is reproducible.
- Built from the design handoff bundle `sample-value-summary/` (README + chat +
  `Lifepreneur Sample Value.html` and its `app.jsx`/`states.jsx`/`components.jsx`).
