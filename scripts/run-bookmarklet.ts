/**
 * run-bookmarklet.ts — headless/Antigravity fallback for the Claude skill
 * "run-partner-center-bookmarklet".
 *
 * Loads a TikTok Shop page and evaluates one of the extension scrapers against
 * it. This repo (tok-scrape-main) is the Chrome-extension layout: the scrapers
 * live in `extension-seller/` and `extension-agency/` as content scripts that
 * read `globalThis.TOK_CONFIG` (from each extension's `config.js`) and POST via
 * `chrome.runtime.sendMessage` relayed by the extension's `background.js`.
 *
 * Neither `TOK_CONFIG` nor the `chrome.runtime` relay exists in a plain page, so
 * before injecting a scraper this runner evaluates, in order:
 *   1. a small `chrome.runtime.sendMessage` shim that does the POST with `fetch`
 *      (mirrors background.js), so GELF/Sheets requests actually fire;
 *   2. the extension's `config.js` body (sets `globalThis.TOK_CONFIG`);
 *   3. the scraper file(s).
 *
 * Two toggles:
 *   --target=creator|sellers|live|streamer|orders|orders-list   (default: creator)
 *   --env=dev|prod                                              (default: dev)
 *
 * Targets (extension dir / scraper / dev fixture):
 *   creator      extension-agency/scrape-creator.js   — (no local fixture; prod only)
 *   sellers      extension-agency/scrape-sellers.js   — (no local fixture; prod only)
 *   live         extension-seller/scrape-live.js      — fixtures/live_overview.html
 *   streamer     extension-seller/scrape-streamer.js  — fixtures/video-analysis_view.html
 *   orders       extension-seller/scrape-order.js     — fixtures/order.html
 *   orders-list  extension-seller/scrape-order-list.js— fixtures/orders.html
 *
 * `orders` is the only two-page flow: it scrapes the buyer-side order DETAIL page
 * (the "Default" variant price). In `dev` it injects directly against the saved
 * detail fixture. In `prod` it loads the Orders list, finds the order whose
 * product image alt matches `--product=<name>`, clicks "View order details",
 * waits for the detail page, then injects. `orders-list` enumerates the Orders
 * list (product names only — no prices/IDs exist there).
 *
 * Prod URL resolution:
 *   creator + prod      → partner.us.tiktokshop.com/compass/video-analysis
 *   sellers + prod      → partner-collabs/agency/detail?campaign_id=<id>  (--campaign-id required)
 *   live + prod         → shop.tiktok.com/workbench/live/overview?room_id=<id>  (--room-id required)
 *   streamer + prod     → shop.tiktok.com/streamer/compass/video-analysis/view
 *   orders + prod       → www.tiktok.com/shop/order_list  (--product=<name> required; navigates to order_detail)
 *   orders-list + prod  → www.tiktok.com/shop/order_list
 *
 * Usage:
 *   npx tsx scripts/run-bookmarklet.ts                                       # creator + dev
 *   npx tsx scripts/run-bookmarklet.ts --target=live                         # live + dev
 *   npx tsx scripts/run-bookmarklet.ts --target=orders                       # orders + dev (detail fixture)
 *   npx tsx scripts/run-bookmarklet.ts --target=orders-list                  # orders-list + dev
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --target=orders \
 *       --product="VEVOR Softbox Lighting Kit"                               # orders + prod (find + navigate)
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --login-only               # capture cookies
 *
 * Why a persistent context? The live TikTok Shop requires a logged-in session
 * with MFA/device checks. We launch Chromium with a persistent user-data-dir so
 * a one-time manual login sticks.
 *
 * Reads the scraper + config source fresh on every run, so the ngrok GELF URL +
 * Graylog token that `scripts/sync-bookmarklet.py` writes on `docker compose up`
 * are always current. No docker preflight is performed — if the endpoints are
 * stale the script warns.
 */

import { chromium, type BrowserContext, type Page, type Request } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

type Env = 'dev' | 'prod';
type Target = 'creator' | 'sellers' | 'live' | 'streamer' | 'orders' | 'orders-list';

interface Args {
  env: Env;
  target: Target;
  profile: string;
  loginOnly: boolean;
  timeoutMs: number;
  campaignId: string | null;
  roomId: string | null;
  product: string | null;
}

interface ProdUrlArgs {
  campaignId: string | null;
  roomId: string | null;
}

interface ProbeResult {
  ready: boolean;
  detail: Record<string, unknown>;
}

interface TargetConfig {
  /** Extension dir holding config.js + the scraper file(s). */
  extensionDir: string;
  /** Scraper file names within extensionDir, injected in order after config.js. */
  scraperFiles: string[];
  /** Absolute path to the local dev fixture, or null if none exists in this repo. */
  fixturePath: string | null;
  prodUrl: (args: ProdUrlArgs) => string;
  /** Returns ready=true once the page is scrape-able. */
  readinessProbe: () => ProbeResult;
}

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(REPO_ROOT, 'fixtures');
const ORDER_LIST_URL = 'https://www.tiktok.com/shop/order_list';

const TARGETS: Record<Target, TargetConfig> = {
  creator: {
    extensionDir: 'extension-agency',
    scraperFiles: ['scrape-creator.js'],
    fixturePath: null, // partner-center.html is not checked into this repo
    prodUrl: () => 'https://partner.us.tiktokshop.com/compass/video-analysis',
    readinessProbe: () => {
      const spaces = document.querySelectorAll('.arco-space-item').length;
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr');
      return { ready: spaces >= 3 && hasRow, detail: { spaces, hasRow } };
    },
  },
  sellers: {
    extensionDir: 'extension-agency',
    scraperFiles: ['scrape-sellers.js'],
    fixturePath: null, // partner-center2.html is not checked into this repo
    prodUrl: ({ campaignId }) => {
      if (!campaignId) {
        throw new Error(
          '--target=sellers --env=prod requires --campaign-id=<id>; ' +
            'sellers prod has no canonical landing URL because each campaign is unique.',
        );
      }
      return (
        'https://partner.us.tiktokshop.com/affiliate-campaign/partner-collabs/agency/detail' +
        `?campaign_id=${encodeURIComponent(campaignId)}&tab=info&cur_page=1&page_size=20`
      );
    },
    readinessProbe: () => {
      const tabs = document.querySelectorAll('.arco-tabs-header-title-text').length;
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr input[type="checkbox"]');
      return { ready: tabs >= 5 && hasRow, detail: { tabs, hasRow } };
    },
  },
  live: {
    extensionDir: 'extension-seller',
    scraperFiles: ['scrape-live.js'],
    fixturePath: path.join(FIXTURES, 'live_overview.html'),
    prodUrl: ({ roomId }) => {
      if (!roomId) {
        throw new Error(
          '--target=live --env=prod requires --room-id=<id>; each live session has its own room.',
        );
      }
      return (
        'https://shop.tiktok.com/workbench/live/overview' +
        `?room_id=${encodeURIComponent(roomId)}&region=us`
      );
    },
    readinessProbe: () => {
      const hasShop = !!document.querySelector('.flex.items-center.ml-7 img[alt="avatar"]');
      const hasGmv = !!document.querySelector('.ecom-screen-animated-number-container .odometer-value');
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr a[href*="/view/product/"]');
      return { ready: hasShop && hasGmv && hasRow, detail: { hasShop, hasGmv, hasRow } };
    },
  },
  streamer: {
    extensionDir: 'extension-seller',
    scraperFiles: ['scrape-streamer.js'],
    fixturePath: path.join(FIXTURES, 'video-analysis_view.html'),
    prodUrl: () => 'https://shop.tiktok.com/streamer/compass/video-analysis/view',
    readinessProbe: () => {
      const grid = document.querySelector('.grid.grid-cols-3');
      const cards = grid ? grid.querySelectorAll(':scope > div').length : 0;
      const hasThumb = !!document.querySelector('img[alt="video thumbnail"]');
      return { ready: cards >= 5 && hasThumb, detail: { cards, hasThumb } };
    },
  },
  orders: {
    extensionDir: 'extension-seller',
    scraperFiles: ['scrape-order.js'],
    // dev injects against the saved order DETAIL fixture (the price lives there).
    fixturePath: path.join(FIXTURES, 'order.html'),
    // prod lands on the Orders list, then navigates to the matched order_detail.
    prodUrl: () => ORDER_LIST_URL,
    // Detail-page readiness (no URL check — the dev fixture is a file:// URL).
    readinessProbe: () => {
      const hasItem = !!document.querySelector('img.w-90.h-90.object-cover.rounded-4[alt]');
      const hasPrice = !!document.querySelector('.flex.justify-between.items-center .H4-Semibold.text-color-UIText1');
      return { ready: hasItem && hasPrice, detail: { hasItem, hasPrice } };
    },
  },
  'orders-list': {
    extensionDir: 'extension-seller',
    scraperFiles: ['scrape-order-list.js'],
    fixturePath: path.join(FIXTURES, 'orders.html'),
    prodUrl: () => ORDER_LIST_URL,
    readinessProbe: () => {
      const cards = document.querySelectorAll(
        'div.flex.flex-col.gap-12.background-color-UIPageFlat1.p-16.rounded-6.cursor-pointer.shadow',
      ).length;
      const hasBtn = !!document.querySelector('button[data-testid="tux-web-button"]');
      return { ready: cards >= 1 && hasBtn, detail: { cards, hasBtn } };
    },
  },
};

const VALID_TARGETS = Object.keys(TARGETS) as Target[];

function parseArgs(argv: string[]): Args {
  const args: Args = {
    env: 'dev',
    target: 'creator',
    profile: path.join(REPO_ROOT, '.pw-profile'),
    loginOnly: false,
    timeoutMs: 30_000,
    campaignId: null,
    roomId: null,
    product: null,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--env=')) {
      const v = arg.slice('--env='.length);
      if (v !== 'dev' && v !== 'prod') throw new Error(`--env must be dev or prod, got ${v}`);
      args.env = v;
    } else if (arg.startsWith('--target=')) {
      const v = arg.slice('--target='.length) as Target;
      if (!VALID_TARGETS.includes(v)) {
        throw new Error(`--target must be one of ${VALID_TARGETS.join(', ')}, got ${v}`);
      }
      args.target = v;
    } else if (arg.startsWith('--campaign-id=')) {
      args.campaignId = arg.slice('--campaign-id='.length);
    } else if (arg.startsWith('--room-id=')) {
      args.roomId = arg.slice('--room-id='.length);
    } else if (arg.startsWith('--product=')) {
      args.product = arg.slice('--product='.length);
    } else if (arg.startsWith('--profile=')) {
      args.profile = path.resolve(arg.slice('--profile='.length));
    } else if (arg === '--login-only') {
      args.loginOnly = true;
    } else if (arg.startsWith('--timeout=')) {
      args.timeoutMs = Number(arg.slice('--timeout='.length));
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${arg}`);
    }
  }
  return args;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: npx tsx scripts/run-bookmarklet.ts [flags]

  --target=creator|sellers|live|streamer|orders|orders-list
                                 Which scraper to run. Default: creator.
  --env=dev|prod                 Target. dev = local fixture (default).
  --campaign-id=ID               Required for --target=sellers --env=prod.
  --room-id=ID                   Required for --target=live --env=prod.
  --product="NAME"               Required for --target=orders --env=prod (matched against order product image alt).
  --profile=PATH                 Playwright persistent-context dir. Default: ./.pw-profile
  --login-only                   Open headed browser so you can log into TikTok. No injection.
  --timeout=MS                   Readiness-probe timeout in ms. Default: 30000.
  -h, --help                     Show this help.
`);
}

interface Sources {
  configSource: string;
  scraperSources: string[];
  graylogEndpoint: string;
  /** May be `null` for extensions whose config defines no Sheets endpoint. */
  sheetEndpoint: string | null;
}

function readSources(target: Target): Sources {
  const cfg = TARGETS[target];
  const dir = path.join(REPO_ROOT, cfg.extensionDir);
  const configPath = path.join(dir, 'config.js');
  if (!fs.existsSync(configPath)) throw new Error(`config.js not found at ${configPath}`);
  const configSource = fs.readFileSync(configPath, 'utf8');
  const graylogMatch = configSource.match(/GRAYLOG_ENDPOINT\s*=\s*'([^']+)'/);
  if (!graylogMatch) throw new Error(`failed to parse GRAYLOG_ENDPOINT from ${configPath}`);
  const sheetMatch = configSource.match(/SHEET_ENDPOINT\s*:\s*'([^']+)'/);
  const scraperSources = cfg.scraperFiles.map((f) => {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) throw new Error(`scraper source not found at ${p}`);
    return fs.readFileSync(p, 'utf8');
  });
  return {
    configSource,
    scraperSources,
    graylogEndpoint: graylogMatch[1],
    sheetEndpoint: sheetMatch ? sheetMatch[1] : null,
  };
}

function resolveTargetUrl(env: Env, target: Target, urlArgs: ProdUrlArgs): string {
  const cfg = TARGETS[target];
  if (env === 'prod') return cfg.prodUrl(urlArgs);
  if (!cfg.fixturePath) {
    throw new Error(
      `no local dev fixture for --target=${target} in this repo; run it with --env=prod instead.`,
    );
  }
  if (!fs.existsSync(cfg.fixturePath)) {
    throw new Error(`dev fixture not found at ${cfg.fixturePath}`);
  }
  return pathToFileURL(cfg.fixturePath).href; // encodes spaces in fixture filenames
}

// Mirror of background.js's relay: turn chrome.runtime.sendMessage({type:'gelf'|'sheet'})
// into a real fetch so the scraper's POST fires. Injected before config + scraper.
const RELAY_SHIM = `
  globalThis.chrome = globalThis.chrome || {};
  globalThis.chrome.runtime = globalThis.chrome.runtime || {};
  globalThis.chrome.runtime.lastError = undefined;
  globalThis.chrome.runtime.sendMessage = function (msg, cb) {
    try {
      if (msg && (msg.type === 'gelf' || msg.type === 'sheet')) {
        var headers = msg.type === 'sheet'
          ? { 'Content-Type': 'text/plain;charset=utf-8' }
          : { 'Content-Type': 'application/json' };
        fetch(msg.endpoint, { method: 'POST', headers: headers, body: JSON.stringify(msg.payload) })
          .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, body: t }; }); })
          .then(function (res) { if (cb) cb(res); })
          .catch(function (e) { if (cb) cb({ ok: false, error: String((e && e.message) || e) }); });
      } else if (cb) {
        cb({ ok: false, error: 'unknown message' });
      }
    } catch (e) { if (cb) cb({ ok: false, error: String(e) }); }
    return true;
  };
`;

// Evaluate a source blob in the page's main world as an expression (CDP
// Runtime.evaluate, so page CSP does not block it — unlike new Function/eval).
async function injectSource(page: Page, src: string): Promise<void> {
  await page.evaluate(`(function () {\n${src}\n})()`);
}

async function waitForProbe(
  page: Page,
  probe: () => ProbeResult,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: ProbeResult = { ready: false, detail: {} };
  while (Date.now() < deadline) {
    last = await page.evaluate(probe);
    if (last.ready) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`not ready after ${timeoutMs}ms (${label}): ${JSON.stringify(last.detail)}`);
}

// orders + prod: from the Orders list, find the card whose product image alt
// matches `product`, click its "View order details" button, and wait for the
// order_detail page to mount.
async function navigateOrdersListToDetail(
  page: Page,
  product: string,
  timeoutMs: number,
): Promise<void> {
  await waitForProbe(page, TARGETS['orders-list'].readinessProbe, timeoutMs, 'orders list');

  const res = await page.evaluate((needle: string) => {
    const norm = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(needle);
    const cards = Array.from(
      document.querySelectorAll(
        'div.flex.flex-col.gap-12.background-color-UIPageFlat1.p-16.rounded-6.cursor-pointer.shadow',
      ),
    );
    for (const card of cards) {
      const imgs = Array.from(card.querySelectorAll('div.relative.flex-shrink-0.w-80.h-80 img[alt]'));
      const alts = imgs.map((i) => i.getAttribute('alt'));
      if (!alts.some((a) => norm(a).includes(want))) continue;
      const buttons = Array.from(card.querySelectorAll('button[data-testid="tux-web-button"]'));
      let btn = buttons.find((b) => {
        const c = b.querySelector('.tux-button__content-naVKgq');
        return !!c && norm(c.textContent) === 'view order details';
      });
      if (!btn) btn = card.querySelector('button[data-testid="tux-web-button"]') || undefined;
      if (btn) {
        (btn as HTMLElement).click();
        return { clicked: true, alt: alts, reason: '', seen: [] as (string | null)[] };
      }
      return { clicked: false, alt: alts, reason: 'matched card but no details button', seen: [] as (string | null)[] };
    }
    const seen = cards.flatMap((c) =>
      Array.from(c.querySelectorAll('img[alt]')).map((i) => i.getAttribute('alt')),
    );
    return { clicked: false, alt: [] as (string | null)[], reason: 'no order card matched', seen };
  }, product);

  if (!res.clicked) {
    throw new Error(
      `could not navigate to an order for --product="${product}" (${res.reason}). ` +
        `Seen products: ${JSON.stringify(res.seen)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[info] clicked into order for product matching "${product}"`);

  await waitForProbe(
    page,
    () => {
      const onDetail = /\/shop\/order_detail(?:[/?#]|$)/.test(location.href);
      const hasItem = !!document.querySelector('img.w-90.h-90.object-cover.rounded-4[alt]');
      const hasPrice = !!document.querySelector('.flex.justify-between.items-center .H4-Semibold.text-color-UIText1');
      return { ready: onDetail && hasItem && hasPrice, detail: { onDetail, hasItem, hasPrice, url: location.href } };
    },
    timeoutMs,
    'orders detail (post-navigation)',
  );
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);
  const sources = readSources(args.target);
  const targetUrl = resolveTargetUrl(args.env, args.target, {
    campaignId: args.campaignId,
    roomId: args.roomId,
  });

  if (args.target === 'orders' && args.env === 'prod' && !args.product) {
    throw new Error('--target=orders --env=prod requires --product="<product name>" to find the order.');
  }

  if (!sources.graylogEndpoint.includes('ngrok')) {
    // eslint-disable-next-line no-console
    console.warn(
      `[warn] GRAYLOG_ENDPOINT=${sources.graylogEndpoint} does not look like an ngrok URL; ` +
        `if you haven't run 'docker compose up' lately it is probably stale.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[info] target=${args.target} env=${args.env} url=${targetUrl} profile=${args.profile}`,
  );

  const context: BrowserContext = await chromium.launchPersistentContext(args.profile, {
    headless: args.loginOnly ? false : args.env === 'dev',
    ...(process.env.PLAYWRIGHT_HEADED === '1' ? { headless: false } : {}),
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = context.pages()[0] ?? (await context.newPage());

  const sheetHost = sources.sheetEndpoint ? new URL(sources.sheetEndpoint).host : null;
  const graylogHost = new URL(sources.graylogEndpoint).host;
  const sheetHits: Request[] = [];
  const graylogHits: Request[] = [];

  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (sheetHost && host === sheetHost) sheetHits.push(req);
    if (host === graylogHost) graylogHits.push(req);
  });
  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log(`[page.${msg.type()}] ${msg.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  if (args.loginOnly) {
    if (args.env !== 'prod') throw new Error('--login-only only makes sense with --env=prod');
    // eslint-disable-next-line no-console
    console.log(
      '[info] headed browser open. Log into TikTok Shop, then close the window to persist cookies into ' +
        args.profile,
    );
    await new Promise<void>((resolve) => context.once('close', () => resolve()));
    return;
  }

  if (args.env === 'prod' && /login|accounts\.tiktok/i.test(page.url())) {
    throw new Error(
      `redirected to login (${page.url()}). Run with --env=prod --login-only first to capture cookies.`,
    );
  }

  // orders + prod is the only two-page flow; everything else scrapes the page
  // we just landed on.
  if (args.target === 'orders' && args.env === 'prod') {
    await navigateOrdersListToDetail(page, args.product as string, args.timeoutMs);
  } else {
    await waitForProbe(page, TARGETS[args.target].readinessProbe, args.timeoutMs, args.target);
  }

  // Inject relay shim → config (TOK_CONFIG) → scraper(s). All run in the same
  // main world, so later injections see the globals the earlier ones set.
  await injectSource(page, RELAY_SHIM);
  await injectSource(page, sources.configSource);
  for (const scraper of sources.scraperSources) {
    await injectSource(page, scraper);
  }

  // Give the POSTs time to fire.
  await page.waitForTimeout(3_000);

  // eslint-disable-next-line no-console
  console.log(
    `[result] sheet requests=${sheetHost ? sheetHits.length : 'n/a'} ` +
      `graylog requests=${graylogHits.length}`,
  );

  await context.close();

  // Graylog is the universal success signal — every scraper ships there.
  if (graylogHits.length === 0) {
    throw new Error('scraper did not fire a Graylog request');
  }
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
