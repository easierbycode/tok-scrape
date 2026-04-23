/**
 * run-bookmarklet.ts — headless/Antigravity fallback for the Claude skill
 * "run-partner-center-bookmarklet".
 *
 * Loads the Partner Center dashboard and evaluates bookmarklet-src.js against it.
 * Supports the same dev/prod toggle as the Claude skill:
 *   --env=dev  (default) → file://.../partner-center.html (the local fixture)
 *   --env=prod           → https://partner.us.tiktokshop.com/compass/video-analysis
 *
 * Usage:
 *   npx tsx scripts/run-bookmarklet.ts                 # dev, headless
 *   npx tsx scripts/run-bookmarklet.ts --env=prod      # prod, headless (needs cookies)
 *   npx tsx scripts/run-bookmarklet.ts --env=prod --login-only
 *       # Opens a headed browser so you can log into TikTok Shop once.
 *       # Cookies persist to ./.pw-profile for future prod runs.
 *
 * Why a persistent context? The live Partner Center requires a logged-in TikTok
 * Shop session with MFA/device checks. We launch Chromium with a persistent
 * user-data-dir so your one-time manual login sticks.
 *
 * Reads bookmarklet-src.js fresh on every run, so the ngrok GELF URL + Graylog
 * token that `scripts/sync-bookmarklet.py` writes on `docker compose up` are
 * always current. No docker preflight is performed — if the endpoints are
 * stale the script warns and exits non-zero.
 */

import { chromium, type BrowserContext, type Page, type Request } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Env = 'dev' | 'prod';

interface Args {
  env: Env;
  profile: string;
  loginOnly: boolean;
  timeoutMs: number;
}

const REPO_ROOT = path.resolve(__dirname, '..');
const BOOKMARKLET_PATH = path.join(REPO_ROOT, 'bookmarklet-src.js');
const FIXTURE_PATH = path.join(REPO_ROOT, 'partner-center.html');
const PROD_URL = 'https://partner.us.tiktokshop.com/compass/video-analysis';

function parseArgs(argv: string[]): Args {
  const args: Args = {
    env: 'dev',
    profile: path.join(REPO_ROOT, '.pw-profile'),
    loginOnly: false,
    timeoutMs: 30_000,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--env=')) {
      const v = arg.slice('--env='.length);
      if (v !== 'dev' && v !== 'prod') throw new Error(`--env must be dev or prod, got ${v}`);
      args.env = v;
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

  --env=dev|prod      Target. dev = local partner-center.html fixture (default).
  --profile=PATH      Playwright persistent-context dir. Default: ./.pw-profile
  --login-only        Open headed browser so you can log into TikTok. No injection.
  --timeout=MS        Readiness-probe timeout in ms. Default: 30000.
  -h, --help          Show this help.
`);
}

function readBookmarklet(): { source: string; graylogEndpoint: string; sheetEndpoint: string } {
  if (!fs.existsSync(BOOKMARKLET_PATH)) {
    throw new Error(`bookmarklet-src.js not found at ${BOOKMARKLET_PATH}`);
  }
  const source = fs.readFileSync(BOOKMARKLET_PATH, 'utf8');
  const graylogMatch = source.match(/GRAYLOG_ENDPOINT\s*=\s*'([^']+)'/);
  const sheetMatch = source.match(/ENDPOINT\s*=\s*'([^']+)'/);
  if (!graylogMatch || !sheetMatch) {
    throw new Error('failed to parse GRAYLOG_ENDPOINT / ENDPOINT from bookmarklet-src.js');
  }
  return {
    source,
    graylogEndpoint: graylogMatch[1],
    sheetEndpoint: sheetMatch[1],
  };
}

function resolveTargetUrl(env: Env): string {
  if (env === 'prod') return PROD_URL;
  // file:// URL for the local fixture. path.resolve already gives an absolute path.
  return `file://${FIXTURE_PATH}`;
}

async function waitForArcoReady(page: Page, timeoutMs: number): Promise<void> {
  // Poll the same probe as the Claude skill.
  const deadline = Date.now() + timeoutMs;
  let last: { spaces: number; hasRow: boolean } = { spaces: 0, hasRow: false };
  while (Date.now() < deadline) {
    last = await page.evaluate(() => ({
      spaces: document.querySelectorAll('.arco-space-item').length,
      hasRow: !!document.querySelector('tbody tr.arco-table-tr'),
    }));
    if (last.spaces >= 3 && last.hasRow) return;
    await page.waitForTimeout(500);
  }
  throw new Error(
    `arco dashboard not ready after ${timeoutMs}ms: spaces=${last.spaces} hasRow=${last.hasRow}`,
  );
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);
  const bookmarklet = readBookmarklet();
  const target = resolveTargetUrl(args.env);

  if (!bookmarklet.graylogEndpoint.includes('ngrok')) {
    // eslint-disable-next-line no-console
    console.warn(
      `[warn] GRAYLOG_ENDPOINT=${bookmarklet.graylogEndpoint} does not look like an ngrok URL; ` +
        `if you haven't run 'docker compose up' lately it is probably stale.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[info] env=${args.env} target=${target} profile=${args.profile}`);

  const context: BrowserContext = await chromium.launchPersistentContext(args.profile, {
    headless: args.loginOnly ? false : args.env === 'dev',
    // Prod headless still works once cookies are captured, but some TikTok flows
    // dislike headless; override via PLAYWRIGHT_HEADED=1 env var if needed.
    ...(process.env.PLAYWRIGHT_HEADED === '1' ? { headless: false } : {}),
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = context.pages()[0] ?? (await context.newPage());

  // Collect requests to the two endpoints we care about.
  const sheetHost = new URL(bookmarklet.sheetEndpoint).host;
  // Graylog is only http(s); for file:// dev mode the URL is still absolute.
  const graylogHost = new URL(bookmarklet.graylogEndpoint).host;
  const sheetHits: Request[] = [];
  const graylogHits: Request[] = [];

  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (host === sheetHost) sheetHits.push(req);
    if (host === graylogHost) graylogHits.push(req);
  });
  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log(`[page.${msg.type()}] ${msg.text()}`);
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });

  if (args.loginOnly) {
    if (args.env !== 'prod') {
      throw new Error('--login-only only makes sense with --env=prod');
    }
    // eslint-disable-next-line no-console
    console.log(
      '[info] headed browser open. Log into TikTok Shop Partner Center, then close the window ' +
        'to persist cookies into ' + args.profile,
    );
    // Wait until the user closes the browser.
    await new Promise<void>((resolve) => context.once('close', () => resolve()));
    return;
  }

  if (args.env === 'prod' && /login|accounts\.tiktok/i.test(page.url())) {
    throw new Error(
      `redirected to login (${page.url()}). Run with --env=prod --login-only first to capture cookies.`,
    );
  }

  await waitForArcoReady(page, args.timeoutMs);

  // Inject the bookmarklet. The file already wraps itself as an IIFE.
  await page.evaluate(bookmarklet.source);

  // Give the POSTs time to fire (keepalive + no-cors makes them fire-and-forget).
  await page.waitForTimeout(3_000);

  // eslint-disable-next-line no-console
  console.log(`[result] sheet requests=${sheetHits.length} graylog requests=${graylogHits.length}`);

  await context.close();

  if (sheetHits.length === 0 && graylogHits.length === 0) {
    throw new Error('bookmarklet fired neither a Sheets nor a Graylog request');
  }
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
