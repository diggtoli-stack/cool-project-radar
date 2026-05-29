#!/usr/bin/env node

// Cool Project Radar — Best-effort screenshots
// Reads prepare-digest.js output and captures landing-page screenshots for a few
// candidates using a locally installed Chrome/Chromium browser.

const { readFile, mkdir, mkdtemp, rm, writeFile } = require("fs/promises");
const { existsSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { spawn } = require("child_process");

const SKIP_HOSTS = new Set([
  "apps.apple.com",
  "github.com",
  "producthunt.com",
  "www.producthunt.com",
  "chromewebstore.google.com",
  "addons.mozilla.org",
  "reddit.com",
  "www.reddit.com",
  "news.ycombinator.com",
  "hn.algolia.com",
  "v2ex.com",
  "www.v2ex.com",
  "lobste.rs",
  "bsky.app"
]);

const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|pdf)(\?.*)?$/i;

function parseArgs(argv) {
  const args = {
    input: null,
    outputDir: "/tmp/cool-project-radar-shots",
    limit: 8,
    width: 1365,
    height: 900,
    timeoutMs: 25000
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) args.input = argv[++i];
    else if (arg === "--output-dir" && argv[i + 1]) args.outputDir = argv[++i];
    else if (arg === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
    else if (arg === "--width" && argv[i + 1]) args.width = Number(argv[++i]);
    else if (arg === "--height" && argv[i + 1]) args.height = Number(argv[++i]);
    else if (arg === "--timeout-ms" && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
  }
  return args;
}

function browserCandidates() {
  const env = process.env.BROWSER_PATH ? [process.env.BROWSER_PATH] : [];
  return [
    ...env,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
}

function findBrowser() {
  return browserCandidates().find(path => existsSync(path)) || null;
}

function safeURL(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function shouldSkip(url) {
  const parsed = safeURL(url);
  if (!parsed) return "invalid_url";
  const host = parsed.hostname.replace(/^www\./, "");
  if (SKIP_HOSTS.has(host) || SKIP_HOSTS.has(parsed.hostname)) return "platform_or_store_page";
  if (SKIP_EXTENSIONS.test(parsed.pathname)) return "non_page_asset";
  return null;
}

function slugify(text) {
  return String(text || "app")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}

function runChrome(browser, args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(browser, args, { stdio: "ignore" });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);
    child.on("exit", code => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, error: code === 0 ? null : `exit_${code}` });
    });
    child.on("error", err => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
  });
}

async function capture(browser, item, outPath, width, height, timeoutMs) {
  const userDataDir = await mkdtemp(join(tmpdir(), "cool-project-radar-chrome-"));
  try {
    const result = await runChrome(browser, [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${userDataDir}`,
      `--window-size=${width},${height}`,
      "--hide-scrollbars",
      "--disable-notifications",
      "--disable-popup-blocking",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=8000",
      `--screenshot=${outPath}`,
      item.appUrl
    ], timeoutMs);
    return result;
  } finally {
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    throw new Error("Missing --input /path/to/digest.json");
  }

  const browser = findBrowser();
  const input = JSON.parse(await readFile(args.input, "utf-8"));
  await mkdir(args.outputDir, { recursive: true });

  const results = [];
  const candidates = input.candidates || [];
  let attempted = 0;

  for (const candidate of candidates) {
    const appUrl = candidate.appUrl;
    const skipReason = shouldSkip(appUrl);
    if (skipReason) {
      results.push({
        id: candidate.id,
        appName: candidate.appName,
        appUrl,
        status: "skipped",
        reason: skipReason
      });
      continue;
    }

    if (!browser) {
      results.push({
        id: candidate.id,
        appName: candidate.appName,
        appUrl,
        status: "skipped",
        reason: "no_chrome_or_chromium_found"
      });
      continue;
    }

    if (attempted >= args.limit) {
      results.push({
        id: candidate.id,
        appName: candidate.appName,
        appUrl,
        status: "skipped",
        reason: "limit_reached"
      });
      continue;
    }

    attempted += 1;
    const filename = `${String(attempted).padStart(2, "0")}-${slugify(candidate.appName)}.png`;
    const screenshotPath = join(args.outputDir, filename);
    const captureResult = await capture(browser, candidate, screenshotPath, args.width, args.height, args.timeoutMs);

    results.push({
      id: candidate.id,
      appName: candidate.appName,
      appUrl,
      status: captureResult.ok && existsSync(screenshotPath) ? "ok" : "failed",
      reason: captureResult.error,
      screenshotPath: captureResult.ok && existsSync(screenshotPath) ? screenshotPath : undefined
    });
  }

  const output = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    browser,
    input: args.input,
    outputDir: args.outputDir,
    results
  };
  const manifestPath = join(args.outputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ status: "error", message: err.message }, null, 2));
  process.exit(1);
});
