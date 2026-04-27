/**
 * run-bookmarklet.ts — headless/Antigravity fallback for the Claude skill
 * "run-partner-center-bookmarklet".
 *
 * Loads a TikTok Shop page and evaluates one of the bookmarklets against it.
 * Two toggles:
 *
 *   --target=creator|sellers|live|streamer   Which bookmarklet to run
 *                                            (default: creator)
 *   --env=dev|prod                           Where to load it (default: dev)
 *
 * Targets:
 *   creator  → bookmarklet-src.js, scrapes a creator's video-analysis
 *              dashboard on the Partner Center.
 *   sellers  → bookmarklet-sellers.js, scrapes a Partner Collabs Agency
 *              Detail page (campaign products + their seller/shop info).
 *   live     → bookmarklet-live.js, scrapes the seller-side LIVE Dashboard
 *              on shop.tiktok.com (per-session GMV, items sold, viewers,
 *              traffic source breakdown, product list).
 *   streamer → bookmarklet-streamer.js, scrapes the seller's own Streamer
 *              Compass video-analysis view (KPIs + per-video metrics).
 *
 * URL resolution:
 *   creator + dev  → file://.../partner-center.html (local fixture)
 *   creator + prod → https://partner.us.tiktokshop.com/compass/video-analysis
 *   sellers + dev  → file://.../partner-center2.html (local fixture)
 *   sellers + prod → partner-collabs/agency/detail?campaign_id=<id>
 *                    --campaign-id=<id> required (each campaign is unique).
 *   live + dev     → file://.../seller-center.html (local fixture)
 *   live + prod    → shop.tiktok.com/workbench/live/overview?room_id=<id>
 *                    --room-id=<id> required (each live session is unique).
 *   streamer + dev  → file://.../seller-center2.html (local fixture)
 *   streamer + prod → shop.tiktok.com/streamer/compass/video-analysis/view
 *                     (single canonical URL — no extra flag needed)
 *
 * Usage:
 *   npx tsx scripts/run-bookmarklet.ts                                       # creator + dev
 *   npx tsx scripts/run-bookmarklet.ts --target=sellers                      # sellers + dev
 *   npx tsx scripts/run-bookmarklet.ts --target=live                         # live + dev
 *   npx tsx scripts/run-bookmarklet.ts --env=prod                            # creator + prod
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --target=sellers \
 *       --campaign-id=7602081624227088159                                    # sellers + prod
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --target=live \
 *       --room-id=7630167109884611358                                        # live + prod
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --login-only               # capture cookies
 *
 * Why a persistent context? The live Partner Center requires a logged-in TikTok
 * Shop session with MFA/device checks. We launch Chromium with a persistent
 * user-data-dir so your one-time manual login sticks.
 *
 * Reads the bookmarklet source fresh on every run, so the ngrok GELF URL +
 * Graylog token that `scripts/sync-bookmarklet.py` writes on `docker compose
 * up` are always current. No docker preflight is performed — if the endpoints
 * are stale the script warns and exits non-zero.
 */

import { chromium, type BrowserContext, type Page, type Request } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Env = 'dev' | 'prod';
type Target = 'creator' | 'sellers' | 'live' | 'streamer';

interface Args {
  env: Env;
  target: Target;
  profile: string;
  loginOnly: boolean;
  timeoutMs: number;
  campaignId: string | null;
  roomId: string | null;
}

interface ProdUrlArgs {
  campaignId: string | null;
  roomId: string | null;
}

interface TargetConfig {
  bookmarkletPath: string;
  fixturePath: string;
  prodUrl: (args: ProdUrlArgs) => string;
  /** Returns null when ready, otherwise an object describing what's missing. */
  readinessProbe: () => { ready: boolean; detail: Record<string, unknown> };
}

const REPO_ROOT = path.resolve(__dirname, '..');

const TARGETS: Record<Target, TargetConfig> = {
  creator: {
    bookmarkletPath: path.join(REPO_ROOT, 'bookmarklet-src.js'),
    fixturePath: path.join(REPO_ROOT, 'partner-center.html'),
    prodUrl: () => 'https://partner.us.tiktokshop.com/compass/video-analysis',
    // Probe matches the SKILL: ≥3 .arco-space-item (date / creator / metrics)
    // plus at least one data row in tbody.
    readinessProbe: () => {
      const spaces = document.querySelectorAll('.arco-space-item').length;
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr');
      return { ready: spaces >= 3 && hasRow, detail: { spaces, hasRow } };
    },
  },
  sellers: {
    bookmarkletPath: path.join(REPO_ROOT, 'bookmarklet-sellers.js'),
    fixturePath: path.join(REPO_ROOT, 'partner-center2.html'),
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
    // Probe: enough status tabs visible (Pending, Approved, Rejected, etc.)
    // and at least one data row with a checkbox (proves a real product, not
    // an empty-state row).
    readinessProbe: () => {
      const tabs = document.querySelectorAll('.arco-tabs-header-title-text').length;
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr input[type="checkbox"]');
      return { ready: tabs >= 5 && hasRow, detail: { tabs, hasRow } };
    },
  },
  live: {
    bookmarkletPath: path.join(REPO_ROOT, 'bookmarklet-live.js'),
    fixturePath: path.join(REPO_ROOT, 'seller-center.html'),
    prodUrl: ({ roomId }) => {
      if (!roomId) {
        throw new Error(
          '--target=live --env=prod requires --room-id=<id>; ' +
            'each live session has its own room.',
        );
      }
      return (
        'https://shop.tiktok.com/workbench/live/overview' +
        `?room_id=${encodeURIComponent(roomId)}&region=us`
      );
    },
    // Probe: shop name + GMV odometer block + at least one product row.
    readinessProbe: () => {
      const hasShop = !!document.querySelector('.flex.items-center.ml-7 img[alt="avatar"]');
      const hasGmv = !!document.querySelector('.ecom-screen-animated-number-container .odometer-value');
      const hasRow = !!document.querySelector('tbody tr.arco-table-tr a[href*="/view/product/"]');
      return {
        ready: hasShop && hasGmv && hasRow,
        detail: { hasShop, hasGmv, hasRow },
      };
    },
  },
  streamer: {
    bookmarkletPath: path.join(REPO_ROOT, 'bookmarklet-streamer.js'),
    fixturePath: path.join(REPO_ROOT, 'seller-center2.html'),
    // The streamer page has no campaign / room id — it's the seller's own
    // dashboard, so a single canonical URL works for prod.
    prodUrl: () =>
      'https://shop.tiktok.com/streamer/compass/video-analysis/view',
    // Probe: KPI grid mounted (5 cards in a 3-col grid) + at least one
    // video card thumbnail rendered.
    readinessProbe: () => {
      const grid = document.querySelector('.grid.grid-cols-3');
      const cards = grid ? grid.querySelectorAll(':scope > div').length : 0;
      const hasThumb = !!document.querySelector('img[alt="video thumbnail"]');
      return { ready: cards >= 5 && hasThumb, detail: { cards, hasThumb } };
    },
  },
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    env: 'dev',
    target: 'creator',
    profile: path.join(REPO_ROOT, '.pw-profile'),
    loginOnly: false,
    timeoutMs: 30_000,
    campaignId: null,
    roomId: null,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--env=')) {
      const v = arg.slice('--env='.length);
      if (v !== 'dev' && v !== 'prod') throw new Error(`--env must be dev or prod, got ${v}`);
      args.env = v;
    } else if (arg.startsWith('--target=')) {
      const v = arg.slice('--target='.length);
      if (v !== 'creator' && v !== 'sellers' && v !== 'live' && v !== 'streamer') {
        throw new Error(
          `--target must be creator, sellers, live, or streamer, got ${v}`,
        );
      }
      args.target = v;
    } else if (arg.startsWith('--campaign-id=')) {
      args.campaignId = arg.slice('--campaign-id='.length);
    } else if (arg.startsWith('--room-id=')) {
      args.roomId = arg.slice('--room-id='.length);
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

  --target=creator|sellers|live|streamer
                                 Which bookmarklet to run. Default: creator.
  --env=dev|prod                 Target. dev = local fixture (default).
  --campaign-id=ID               Required for --target=sellers --env=prod.
  --room-id=ID                   Required for --target=live --env=prod.
  --profile=PATH                 Playwright persistent-context dir. Default: ./.pw-profile
  --login-only                   Open headed browser so you can log into TikTok. No injection.
  --timeout=MS                   Readiness-probe timeout in ms. Default: 30000.
  -h, --help                     Show this help.
`);
}

function readBookmarklet(target: Target): {
  source: string;
  graylogEndpoint: string;
  /** May be `null` for bookmarklets that intentionally skip the Sheets POST. */
  sheetEndpoint: string | null;
} {
  const cfg = TARGETS[target];
  if (!fs.existsSync(cfg.bookmarkletPath)) {
    throw new Error(`bookmarklet source not found at ${cfg.bookmarkletPath}`);
  }
  const source = fs.readFileSync(cfg.bookmarkletPath, 'utf8');
  const graylogMatch = source.match(/GRAYLOG_ENDPOINT\s*=\s*'([^']+)'/);
  if (!graylogMatch) {
    throw new Error(`failed to parse GRAYLOG_ENDPOINT from ${cfg.bookmarkletPath}`);
  }
  // ENDPOINT (Sheets) is optional — sellers is Graylog-only by design.
  const sheetMatch = source.match(/^\s*var\s+ENDPOINT\s*=\s*'([^']+)'/m);
  return {
    source,
    graylogEndpoint: graylogMatch[1],
    sheetEndpoint: sheetMatch ? sheetMatch[1] : null,
  };
}

function resolveTargetUrl(env: Env, target: Target, urlArgs: ProdUrlArgs): string {
  const cfg = TARGETS[target];
  if (env === 'prod') return cfg.prodUrl(urlArgs);
  return `file://${cfg.fixturePath}`;
}

async function waitForArcoReady(
  page: Page,
  target: Target,
  timeoutMs: number,
): Promise<void> {
  const probe = TARGETS[target].readinessProbe;
  const deadline = Date.now() + timeoutMs;
  let last: { ready: boolean; detail: Record<string, unknown> } = { ready: false, detail: {} };
  while (Date.now() < deadline) {
    last = await page.evaluate(probe);
    if (last.ready) return;
    await page.waitForTimeout(500);
  }
  throw new Error(
    `arco dashboard not ready after ${timeoutMs}ms (target=${target}): ` +
      JSON.stringify(last.detail),
  );
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);
  const bookmarklet = readBookmarklet(args.target);
  const targetUrl = resolveTargetUrl(args.env, args.target, {
    campaignId: args.campaignId,
    roomId: args.roomId,
  });

  if (!bookmarklet.graylogEndpoint.includes('ngrok')) {
    // eslint-disable-next-line no-console
    console.warn(
      `[warn] GRAYLOG_ENDPOINT=${bookmarklet.graylogEndpoint} does not look like an ngrok URL; ` +
        `if you haven't run 'docker compose up' lately it is probably stale.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[info] target=${args.target} env=${args.env} url=${targetUrl} profile=${args.profile}`,
  );

  const context: BrowserContext = await chromium.launchPersistentContext(args.profile, {
    headless: args.loginOnly ? false : args.env === 'dev',
    // Prod headless still works once cookies are captured, but some TikTok flows
    // dislike headless; override via PLAYWRIGHT_HEADED=1 env var if needed.
    ...(process.env.PLAYWRIGHT_HEADED === '1' ? { headless: false } : {}),
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = context.pages()[0] ?? (await context.newPage());

  // Collect requests to the endpoints we care about. The sheet host may be
  // absent for Graylog-only bookmarklets (sellers).
  const sheetHost = bookmarklet.sheetEndpoint
    ? new URL(bookmarklet.sheetEndpoint).host
    : null;
  const graylogHost = new URL(bookmarklet.graylogEndpoint).host;
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
    if (args.env !== 'prod') {
      throw new Error('--login-only only makes sense with --env=prod');
    }
    // eslint-disable-next-line no-console
    console.log(
      '[info] headed browser open. Log into TikTok Shop Partner Center, then close the window ' +
        'to persist cookies into ' + args.profile,
    );
    await new Promise<void>((resolve) => context.once('close', () => resolve()));
    return;
  }

  if (args.env === 'prod' && /login|accounts\.tiktok/i.test(page.url())) {
    throw new Error(
      `redirected to login (${page.url()}). Run with --env=prod --login-only first to capture cookies.`,
    );
  }

  await waitForArcoReady(page, args.target, args.timeoutMs);

  // Inject the bookmarklet. The file already wraps itself as an IIFE.
  await page.evaluate(bookmarklet.source);

  // Give the POSTs time to fire (keepalive + no-cors makes them fire-and-forget).
  await page.waitForTimeout(3_000);

  // eslint-disable-next-line no-console
  console.log(
    `[result] sheet requests=${sheetHost ? sheetHits.length : 'n/a'} ` +
      `graylog requests=${graylogHits.length}`,
  );

  await context.close();

  // Graylog is the universal success signal — every bookmarklet ships there.
  // Sheets is optional (sellers skips it), so we don't gate on it.
  if (graylogHits.length === 0) {
    throw new Error('bookmarklet did not fire a Graylog request');
  }
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
