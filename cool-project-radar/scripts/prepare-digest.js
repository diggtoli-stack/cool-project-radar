#!/usr/bin/env node

// Cool Project Radar — Prepare
// Fetches stable/free public sources and outputs normalized project candidates as JSON.

const { readFile } = require("fs/promises");
const { existsSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");
const dns = require("dns/promises");

const SCRIPT_DIR = __dirname;
const SKILL_DIR = join(SCRIPT_DIR, "..");
const DEFAULT_SOURCES_PATH = join(SKILL_DIR, "config", "default-sources.json");
const DEFAULT_PROMPT_PATH = join(SKILL_DIR, "prompts", "project-radar-digest.md");
const USER_DIR = join(homedir(), ".cool-project-radar");
const USER_CONFIG_PATH = join(USER_DIR, "config.json");
const USER_PROMPT_PATH = join(USER_DIR, "prompts", "project-radar-digest.md");

const FETCH_TIMEOUT_MS = 8000;
const FETCH_RETRIES = 1;
const USER_AGENT = "cool-project-radar/0.1 (local Codex skill; read-only public discovery)";
const PREFLIGHT_HOSTS = ["hn.algolia.com", "api.github.com", "www.producthunt.com"];

const PLATFORM_DOMAINS = [
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "news.ycombinator.com",
  "hn.algolia.com",
  "v2ex.com",
  "www.v2ex.com",
  "lobste.rs",
  "bsky.app",
  "public.api.bsky.app",
  "producthunt.com",
  "www.producthunt.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
  "api.twitterapi.io",
  "xiaoyuzhoufm.com",
  "www.xiaoyuzhoufm.com"
];

const NON_APP_DOMAINS = [
  "i.redd.it",
  "preview.redd.it",
  "external-preview.redd.it",
  "v.redd.it",
  "redditmedia.com",
  "i.imgur.com",
  "imgur.com",
  "giphy.com",
  "tenor.com"
];

const NON_APP_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|pdf)(\?.*)?$/i;

function parseArgs(argv) {
  const args = { preflight: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--lookback" && argv[i + 1]) args.lookbackHours = Number(argv[++i]);
    else if (arg === "--limit" && argv[i + 1]) args.maxCandidates = Number(argv[++i]);
    else if (arg === "--sources" && argv[i + 1]) args.enabledSources = argv[++i].split(",").map(s => s.trim()).filter(Boolean);
    else if (arg === "--language" && argv[i + 1]) args.language = argv[++i];
    else if (arg === "--formats" && argv[i + 1]) args.projectFormats = normalizedList(argv[++i]);
    else if (arg === "--domains" && argv[i + 1]) args.domains = normalizedList(argv[++i]);
    else if (arg === "--style" && argv[i + 1]) args.curationStyle = argv[++i];
    else if (arg === "--focus" && argv[i + 1]) args.focusKeywords = normalizedList(argv[++i]);
    else if (arg === "--blocked-domains" && argv[i + 1]) args.blockedDomains = normalizedList(argv[++i]);
    else if (arg === "--skip-preflight") args.preflight = false;
  }
  return args;
}

async function loadJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return fallback;
  }
}

async function loadText(path, fallbackPath) {
  if (existsSync(path)) return readFile(path, "utf-8");
  return readFile(fallbackPath, "utf-8");
}

async function checkDNS(host) {
  try {
    await dns.lookup(host);
    return { host, ok: true };
  } catch (err) {
    return { host, ok: false, error: err.code || err.message };
  }
}

async function runPreflight() {
  const checks = await Promise.all(PREFLIGHT_HOSTS.map(checkDNS));
  return {
    ok: checks.some(check => check.ok),
    checks
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function describeFetchError(err) {
  const cause = err.cause;
  if (cause && cause.code) return `${err.message} (${cause.code})`;
  return err.message;
}

async function fetchJSON(url, label, errors, headers = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json,text/plain,*/*",
          ...headers
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!res.ok) {
        errors.push(`${label}: HTTP ${res.status} from ${url}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES) await sleep(500 * attempt);
    }
  }
  errors.push(`${label}: failed after ${FETCH_RETRIES} attempts: ${describeFetchError(lastErr)}`);
  return null;
}

async function fetchText(url, label, errors, headers = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/atom+xml,application/rss+xml,text/html,text/plain,*/*",
          ...headers
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!res.ok) {
        errors.push(`${label}: HTTP ${res.status} from ${url}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES) await sleep(500 * attempt);
    }
  }
  errors.push(`${label}: failed after ${FETCH_RETRIES} attempts: ${describeFetchError(lastErr)}`);
  return null;
}

function toISOFromSeconds(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function stripHTML(html) {
  if (!html) return "";
  return decodeHTMLEntities(String(html))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHTMLEntities(text) {
  if (!text) return "";
  return String(text)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractXmlTag(block, tag) {
  const match = String(block || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return null;
  return decodeHTMLEntities(match[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim();
}

function extractXmlAttr(block, tag, attr) {
  const match = String(block || "").match(new RegExp(`<${tag}\\b[^>]*\\s${attr}="([^"]+)"[^>]*>`, "i"));
  if (!match) return null;
  return decodeHTMLEntities(match[1]).trim();
}

function parseXmlEntries(xml) {
  const text = String(xml || "");
  const rssItems = [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => match[0]);
  const atomEntries = [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(match => match[0]);
  return rssItems.length ? rssItems : atomEntries;
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function includesAny(text, keywords) {
  const haystack = lower(text);
  return keywords.some(keyword => haystack.includes(lower(keyword)));
}

function matchedKeywords(text, keywords) {
  const haystack = lower(text);
  return keywords.filter(keyword => haystack.includes(lower(keyword))).slice(0, 8);
}

function normalizedList(value) {
  if (Array.isArray(value)) return value.map(item => cleanText(item)).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(item => cleanText(item)).filter(Boolean);
  return [];
}

function curationStyleKeywords(style) {
  const styles = {
    innovation: [
      "new interaction", "novel interaction", "playful", "weird", "tiny", "ritual",
      "local-first", "private", "gesture", "notch", "side panel", "canvas",
      "新交互", "新玩法", "小而美", "仪式感", "本地优先"
    ],
    popular: [
      "trending", "viral", "launch", "product hunt", "users", "downloads",
      "stars", "upvotes", "排行榜", "热门", "爆了", "用户", "下载"
    ],
    practical: [
      "workflow", "one click", "zero setup", "no account", "automation",
      "productivity", "save time", "template", "工作流", "一键", "无需注册", "自动化", "效率"
    ],
    weird: [
      "weird", "playful", "toy", "experiment", "micro app", "ambient",
      "game", "strange", "好玩", "有趣", "实验", "小游戏", "脑洞"
    ],
    balanced: []
  };
  return styles[style] || styles.balanced;
}

function buildFocusKeywords(config) {
  return [
    ...normalizedList(config.focusKeywords),
    ...normalizedList(config.projectFormats),
    ...normalizedList(config.domains),
    ...curationStyleKeywords(config.curationStyle || "balanced")
  ];
}

function extractUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s)>\]"}]+/g) || [];
  return matches.map(url => url.replace(/[.,;!?]+$/, ""));
}

function safeURL(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isPlatformUrl(url) {
  const parsed = safeURL(url);
  if (!parsed) return true;
  return PLATFORM_DOMAINS.includes(parsed.hostname.replace(/^www\./, "")) ||
    PLATFORM_DOMAINS.includes(parsed.hostname);
}

function canonicalUrl(url) {
  const parsed = safeURL(url);
  if (!parsed) return null;
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|ref$|ref_src$|fbclid$|gclid$|igshid$)/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }
  let out = parsed.toString();
  if (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

function pickExternalUrl(candidates, blockedDomains = []) {
  for (const candidate of candidates.filter(Boolean)) {
    const parsed = safeURL(candidate);
    if (!parsed) continue;
    const host = parsed.hostname.replace(/^www\./, "");
    if (blockedDomains.includes(host)) continue;
    if (NON_APP_DOMAINS.includes(host)) continue;
    if (NON_APP_EXTENSIONS.test(parsed.pathname)) continue;
    if (!isPlatformUrl(candidate)) return canonicalUrl(candidate);
  }
  return null;
}

function slugify(text) {
  return lower(text)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleNameCandidate(item) {
  let title = cleanText(item.title);
  title = title
    .replace(/^show hn:\s*/i, "")
    .replace(/^i (built|made|created)\s+(an?|the)?\s*/i, "")
    .replace(/^just launched\s+(an?|the)?\s*/i, "")
    .replace(/^我(做了|开发了|上线了)(一个|个)?/i, "")
    .trim();

  const split = title.split(/\s[-:|–—]\s/)[0];
  return split.slice(0, 80) || "Unnamed app";
}

function nameFromUrl(url) {
  const parsed = safeURL(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "");
  const pathParts = parsed.pathname.split("/").filter(Boolean);

  if (host === "apps.apple.com") {
    const appIndex = pathParts.indexOf("app");
    if (appIndex !== -1 && pathParts[appIndex + 1]) {
      const namePart = pathParts[appIndex + 1];
      if (/^id\d+$/i.test(namePart)) return null;
      return decodeURIComponent(namePart).replace(/-/g, " ");
    }
  }

  if (host === "play.google.com") {
    const id = parsed.searchParams.get("id");
    if (id) return id.split(".").pop().replace(/[-_]/g, " ");
  }

  if (host === "chromewebstore.google.com") {
    const detailIndex = pathParts.indexOf("detail");
    if (detailIndex !== -1 && pathParts[detailIndex + 1]) {
      return pathParts[detailIndex + 1].replace(/-/g, " ");
    }
  }

  if (host === "addons.mozilla.org") {
    const addonIndex = pathParts.indexOf("addon");
    if (addonIndex !== -1 && pathParts[addonIndex + 1]) {
      return pathParts[addonIndex + 1].replace(/-/g, " ");
    }
  }

  if (host === "producthunt.com" && pathParts[0] === "products" && pathParts[1]) {
    return pathParts[1].replace(/-/g, " ");
  }

  if (host === "replit.com" && pathParts[1]) return pathParts[1].replace(/[-_]/g, " ");

  if (host === "github.com" && pathParts[1]) return pathParts[1].replace(/[-_]/g, " ");

  const parts = host.split(".");
  if (parts.length > 1) return parts[0].replace(/-/g, " ");
  return null;
}

function inferName(item) {
  if (item.platform === "producthunt") return titleNameCandidate(item);
  if (item.appUrl) {
    const fromUrl = nameFromUrl(item.appUrl);
    if (fromUrl) return fromUrl;
  }
  return titleNameCandidate(item);
}

function sourceBoost(sourceId) {
  if (sourceId === "hn_show") return 10;
  if (sourceId === "product_hunt_rss") return 10;
  if (sourceId === "twitterapi_io_search") return 9;
  if (sourceId === "reddit_sideproject") return 8;
  if (sourceId === "v2ex_create") return 8;
  if (sourceId === "wewe_rss") return 8;
  if (sourceId === "bluesky_app_search") return 7;
  if (sourceId === "firefox_addons") return 7;
  if (sourceId === "xiaoyuzhou_podcasts") return 6;
  if (sourceId === "youtube_channel_rss") return 6;
  if (sourceId === "apple_itunes_search") return 6;
  if (sourceId === "tech_media_rss") return 5;
  if (sourceId === "github_app_search") return 5;
  if (sourceId === "lobsters_show") return 4;
  return 3;
}

function scoreItem(item, keywords, focusKeywords = []) {
  const text = `${item.title}\n${item.text}\n${item.appUrl || ""}`;
  const launchMatches = matchedKeywords(text, keywords.launch || []);
  const vibeMatches = matchedKeywords(text, keywords.vibe || []);
  const consumerMatches = matchedKeywords(text, keywords.consumer || []);
  const pmMatches = matchedKeywords(text, keywords.pmInspiration || []);
  const noveltyMatches = matchedKeywords(text, keywords.novelty || []);
  const sceneMatches = matchedKeywords(text, keywords.sceneInnovation || []);
  const audienceMatches = matchedKeywords(text, keywords.audience || []);
  const verticalMatches = matchedKeywords(text, keywords.verticalProfessional || []);
  const devMatches = matchedKeywords(text, keywords.developerHeavy || []);
  const focusMatches = matchedKeywords(text, focusKeywords);

  const ageHours = item.createdAt ? Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 36e5) : 999;
  const recency = Math.max(0, 18 - Math.min(18, ageHours / 8));
  const metricScore = Math.min(16, Math.log1p(
    (item.metrics.score || 0) +
    (item.metrics.comments || 0) * 2 +
    (item.metrics.likes || 0) +
    (item.metrics.downloads || 0) * 0.2 +
    (item.metrics.users || 0) * 0.1
  ) * 4);

  let score = sourceBoost(item.sourceId) + recency + metricScore;
  if (item.appUrl) score += 14;
  if (item.sourceId === "product_hunt_rss" && item.sourceUrl) score += 10;
  if (launchMatches.length) score += 12;
  if (consumerMatches.length) score += 10;
  if (pmMatches.length) score += 14;
  if (noveltyMatches.length) score += 22;
  if (sceneMatches.length) score += 14;
  if (audienceMatches.length) score += 8;
  if (noveltyMatches.length && consumerMatches.length) score += 10;
  if (vibeMatches.length) score += 12;
  if (focusMatches.length) score += 8;
  if (verticalMatches.length) score -= 18;
  if (devMatches.length) score -= noveltyMatches.length && consumerMatches.length ? 6 : 12;
  if (!consumerMatches.length && !noveltyMatches.length && !sceneMatches.length) score -= 10;
  if (!pmMatches.length && verticalMatches.length) score -= 8;
  if (!consumerMatches.length && devMatches.length) score -= 8;

  const signals = {
    hasAppUrl: Boolean(item.appUrl),
    launchLikely: launchMatches.length > 0 ||
      item.sourceId === "hn_show" ||
      item.sourceId === "product_hunt_rss" ||
      item.sourceId === "github_app_search" ||
      item.sourceId === "firefox_addons" ||
      item.sourceId === "apple_itunes_search",
    vibeCodedLikely: vibeMatches.length > 0,
    consumerAppLikely: consumerMatches.length > 0 &&
      !(devMatches.length > consumerMatches.length) &&
      !(verticalMatches.length > consumerMatches.length),
    pmInspirationLikely: pmMatches.length > 0,
    novelInteractionLikely: noveltyMatches.length > 0,
    sceneInnovationLikely: sceneMatches.length > 0 || audienceMatches.length > 0,
    coolPotentialLikely: !verticalMatches.length && (
      noveltyMatches.length > 0 ||
      sceneMatches.length > 0 ||
      audienceMatches.length > 0 ||
      pmMatches.length > 0
    ),
    verticalProfessional: verticalMatches.length > 0,
    developerHeavy: devMatches.length > 0,
    matched: {
      launch: launchMatches,
      vibe: vibeMatches,
      consumer: consumerMatches,
      pmInspiration: pmMatches,
      novelty: noveltyMatches,
      sceneInnovation: sceneMatches,
      audience: audienceMatches,
      verticalProfessional: verticalMatches,
      developerHeavy: devMatches,
      focus: focusMatches
    }
  };

  const reasons = [];
  if (signals.launchLikely) reasons.push("launch/demo wording");
  if (signals.vibeCodedLikely) reasons.push("mentions vibe-coding or AI coding tools");
  if (signals.consumerAppLikely) reasons.push("project-format keywords");
  if (signals.pmInspirationLikely) reasons.push("PM inspiration signals");
  if (signals.novelInteractionLikely) reasons.push("novel interaction/taste signals");
  if (signals.sceneInnovationLikely) reasons.push("scenario or audience innovation signals");
  if (signals.coolPotentialLikely) reasons.push("project-radar candidate");
  if (signals.verticalProfessional) reasons.push("vertical/professional terms present");
  if (signals.hasAppUrl) reasons.push("has external app/demo URL");
  if (signals.developerHeavy) reasons.push("developer-heavy terms present");

  return { score: Math.round(score * 10) / 10, signals, reasons };
}

function normalizeHNHit(hit, source, blockedDomains) {
  const title = cleanText(hit.title || hit.story_title);
  const text = stripHTML(hit.story_text || hit.comment_text || "");
  const appUrl = pickExternalUrl([hit.url, ...extractUrls(text), ...extractUrls(title)], blockedDomains);
  return {
    id: `hn:${hit.objectID}`,
    sourceId: source.id,
    sourceName: source.name,
    platform: "hackernews",
    title,
    text,
    appUrl,
    sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author || null,
    createdAt: hit.created_at || null,
    metrics: {
      score: hit.points || 0,
      comments: hit.num_comments || 0
    }
  };
}

async function fetchHN(source, ctx) {
  const items = [];
  const cutoff = Math.floor((Date.now() - ctx.lookbackHours * 36e5) / 1000);
  const base = source.endpoint;

  if (source.type === "hn_algolia") {
    const url = new URL(base);
    url.searchParams.set("tags", source.tags || "show_hn");
    url.searchParams.set("hitsPerPage", String(source.limit || 80));
    url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
    const json = await fetchJSON(url.toString(), source.name, ctx.errors);
    for (const hit of json?.hits || []) items.push(normalizeHNHit(hit, source, ctx.blockedDomains));
  }

  if (source.type === "hn_algolia_queries") {
    const batches = await Promise.all((source.queries || []).map(async query => {
      const url = new URL(base);
      url.searchParams.set("query", query);
      url.searchParams.set("tags", source.tags || "story");
      url.searchParams.set("hitsPerPage", String(source.limit || 25));
      url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
      const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors);
      return (json?.hits || []).map(hit => normalizeHNHit(hit, source, ctx.blockedDomains));
    }));
    for (const batch of batches) items.push(...batch);
  }

  return items;
}

function normalizeRedditPost(post, source, subreddit, blockedDomains) {
  const title = cleanText(post.title);
  const text = cleanText(post.selftext || "");
  const sourceUrl = `https://www.reddit.com${post.permalink}`;
  const urls = [
    post.url_overridden_by_dest,
    post.url,
    ...extractUrls(text),
    ...extractUrls(title)
  ];
  const appUrl = pickExternalUrl(urls, blockedDomains);
  return {
    id: `reddit:${post.id}`,
    sourceId: source.id,
    sourceName: `${source.name} / r/${subreddit}`,
    platform: "reddit",
    title,
    text,
    appUrl,
    sourceUrl,
    author: post.author || null,
    createdAt: toISOFromSeconds(post.created_utc),
    metrics: {
      score: post.score || 0,
      comments: post.num_comments || 0,
      likes: post.ups || 0
    }
  };
}

async function fetchReddit(source, ctx) {
  const batches = await Promise.all((source.subreddits || []).map(async subreddit => {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${source.listing || "new"}.json?limit=${source.limit || 40}`;
    const json = await fetchJSON(url, `${source.name}: r/${subreddit}`, ctx.errors);
    const items = [];
    for (const child of json?.data?.children || []) {
      const post = child.data;
      if (!post || post.over_18) continue;
      items.push(normalizeRedditPost(post, source, subreddit, ctx.blockedDomains));
    }
    return items;
  }));
  return batches.flat();
}

function normalizeProductHuntEntry(entry, source, blockedDomains) {
  const rawContent = extractXmlTag(entry, "content") || "";
  const content = decodeHTMLEntities(rawContent);
  const title = cleanText(extractXmlTag(entry, "title"));
  const published = cleanText(extractXmlTag(entry, "published"));
  const updated = cleanText(extractXmlTag(entry, "updated"));
  const author = cleanText(extractXmlTag(entry, "name"));
  const linkMatch = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i) ||
    entry.match(/<link[^>]+href="([^"]+)"/i);
  const sourceUrl = decodeHTMLEntities(linkMatch?.[1] || "");
  const phRedirectMatch = content.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Link\s*<\/a>/i);
  const taglineMatch = content.match(/<p>\s*([\s\S]*?)\s*<\/p>/i);
  const tagline = stripHTML(taglineMatch?.[1] || content);
  const appUrl = pickExternalUrl([decodeHTMLEntities(phRedirectMatch?.[1] || "")], blockedDomains) || sourceUrl;

  return {
    id: `producthunt:${sourceUrl || title}:${published || updated}`,
    sourceId: source.id,
    sourceName: source.name,
    platform: "producthunt",
    title,
    text: tagline,
    appUrl,
    sourceUrl,
    author: author || null,
    createdAt: published || updated || null,
    metrics: {
      score: 0,
      comments: 0
    }
  };
}

async function fetchProductHuntRSS(source, ctx) {
  const xml = await fetchText(source.endpoint, source.name, ctx.errors);
  if (!xml) return [];
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]
    .slice(0, source.limit || 60)
    .map(match => normalizeProductHuntEntry(match[1], source, ctx.blockedDomains))
    .filter(item => item.title && item.sourceUrl);
}

function normalizeGenericRSSEntry(entry, source, feed, index, blockedDomains) {
  const title = cleanText(extractXmlTag(entry, "title"));
  const description = stripHTML(
    extractXmlTag(entry, "description") ||
    extractXmlTag(entry, "summary") ||
    extractXmlTag(entry, "content") ||
    extractXmlTag(entry, "content:encoded") ||
    ""
  );
  const link = extractXmlTag(entry, "link") ||
    extractXmlAttr(entry, "link", "href") ||
    extractXmlTag(entry, "guid") ||
    feed.homepage ||
    feed.url;
  const published = parseMaybeDate(
    extractXmlTag(entry, "pubDate") ||
    extractXmlTag(entry, "published") ||
    extractXmlTag(entry, "updated") ||
    extractXmlTag(entry, "dc:date")
  );
  const author = cleanText(
    extractXmlTag(entry, "author") ||
    extractXmlTag(entry, "name") ||
    extractXmlTag(entry, "dc:creator") ||
    feed.name ||
    source.name
  );
  const sourceUrl = canonicalUrl(link) || link;
  const appUrl = pickExternalUrl(
    [...extractUrls(description), ...extractUrls(title)].filter(url => canonicalUrl(url) !== sourceUrl),
    blockedDomains
  );

  return {
    id: `rss:${source.id}:${sourceUrl || title}:${published || index}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${feed.name || feed.url}`,
    platform: "rss",
    title,
    text: description,
    appUrl,
    sourceUrl,
    author: author || null,
    createdAt: published,
    metrics: {
      score: 0,
      comments: 0
    }
  };
}

async function fetchGenericRSS(source, ctx) {
  const feeds = (source.feeds && source.feeds.length)
    ? source.feeds
    : [{ name: source.name, url: source.endpoint }];
  const batches = await Promise.all(feeds.filter(feed => feed.url).map(async feed => {
    const xml = await fetchText(feed.url, `${source.name}: ${feed.name || feed.url}`, ctx.errors);
    if (!xml) return [];
    return parseXmlEntries(xml)
      .slice(0, feed.limit || source.limit || 30)
      .map((entry, index) => normalizeGenericRSSEntry(entry, source, feed, index, ctx.blockedDomains))
      .filter(item => item.title && item.sourceUrl);
  }));
  return batches.flat();
}

function normalizeYouTubeEntry(entry, source, channel, index) {
  const videoId = cleanText(extractXmlTag(entry, "yt:videoId"));
  const title = cleanText(extractXmlTag(entry, "title"));
  const author = cleanText(extractXmlTag(entry, "name") || channel.name);
  const published = parseMaybeDate(extractXmlTag(entry, "published") || extractXmlTag(entry, "updated"));
  const link = extractXmlAttr(entry, "link", "href") ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : channel.url);
  const description = stripHTML(
    extractXmlTag(entry, "media:description") ||
    extractXmlTag(entry, "summary") ||
    ""
  );

  return {
    id: `youtube:${videoId || link || title}:${published || index}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${channel.name || channel.channelId}`,
    platform: "youtube",
    title,
    text: [description, "YouTube video signal"].filter(Boolean).join("\n"),
    appUrl: null,
    sourceUrl: canonicalUrl(link) || link,
    author: author || null,
    createdAt: published,
    metrics: {
      score: 0,
      comments: 0
    }
  };
}

async function fetchYouTubeChannelRSS(source, ctx) {
  const batches = await Promise.all((source.channels || []).map(async channel => {
    const feedUrl = channel.feedUrl ||
      (channel.channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}` : null);
    if (!feedUrl) return [];
    const xml = await fetchText(feedUrl, `${source.name}: ${channel.name || channel.channelId}`, ctx.errors);
    if (!xml) return [];
    return parseXmlEntries(xml)
      .slice(0, channel.limit || source.limit || 12)
      .map((entry, index) => normalizeYouTubeEntry(entry, source, channel, index))
      .filter(item => item.title && item.sourceUrl);
  }));
  return batches.flat();
}

function normalizeTwitterPost(tweet, source, query, blockedDomains) {
  const id = tweet.id || tweet.tweet_id || tweet.rest_id || tweet.url || tweet.text;
  const text = cleanText(tweet.text || tweet.full_text || tweet.content || "");
  const title = text.slice(0, 140) || "(X post)";
  const authorHandle = tweet.author?.userName || tweet.author?.username || tweet.user?.screen_name || tweet.user?.username || tweet.username;
  const sourceUrl = tweet.url ||
    (authorHandle && id ? `https://x.com/${authorHandle}/status/${id}` : null);
  const createdAt = parseMaybeDate(tweet.createdAt || tweet.created_at || tweet.created_time || tweet.date);
  const appUrl = pickExternalUrl([
    tweet.entities?.urls?.[0]?.expanded_url,
    tweet.card?.url,
    ...extractUrls(text)
  ], blockedDomains);

  return {
    id: `x:${id}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${query}`,
    platform: "x",
    title,
    text,
    appUrl,
    sourceUrl,
    author: authorHandle || tweet.author?.name || null,
    createdAt,
    metrics: {
      score: tweet.likeCount || tweet.like_count || tweet.favorite_count || 0,
      comments: tweet.replyCount || tweet.reply_count || 0,
      reposts: tweet.retweetCount || tweet.retweet_count || 0
    }
  };
}

async function fetchTwitterApiIo(source, ctx) {
  const apiKey = process.env[source.apiKeyEnv || "TWITTERAPI_IO_KEY"] || source.apiKey;
  if (!apiKey) {
    ctx.errors.push(`${source.name}: missing ${source.apiKeyEnv || "TWITTERAPI_IO_KEY"}`);
    return [];
  }
  const headers = { "x-api-key": apiKey };
  const batches = await Promise.all((source.queries || []).map(async query => {
    const url = new URL(source.endpoint);
    url.searchParams.set("query", query);
    url.searchParams.set("queryType", source.queryType || "Latest");
    if (source.limit) url.searchParams.set("limit", String(source.limit));
    const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors, headers);
    const tweets = json?.tweets || json?.data?.tweets || json?.data || json?.results || [];
    return (Array.isArray(tweets) ? tweets : []).map(tweet =>
      normalizeTwitterPost(tweet, source, query, ctx.blockedDomains)
    );
  }));
  return batches.flat().filter(item => item.sourceUrl || item.text);
}

function extractNextData(html) {
  const match = String(html || "").match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(decodeHTMLEntities(match[1]));
  } catch {
    return null;
  }
}

function normalizeXiaoyuzhouEpisode(episode, source, podcast) {
  const title = cleanText(episode.title);
  const text = stripHTML(episode.shownotes || episode.description || "");
  const sourceUrl = `https://www.xiaoyuzhoufm.com/episode/${episode.eid}`;
  return {
    id: `xiaoyuzhou:${episode.eid}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${podcast.title || podcast.pid}`,
    platform: "xiaoyuzhou",
    title,
    text: [
      podcast.title ? `podcast: ${podcast.title}` : "",
      podcast.author ? `author: ${podcast.author}` : "",
      text
    ].filter(Boolean).join("\n"),
    appUrl: pickExternalUrl([...extractUrls(text), ...extractUrls(title)], []),
    sourceUrl,
    author: podcast.author || null,
    createdAt: parseMaybeDate(episode.pubDate),
    metrics: {
      score: episode.playCount || 0,
      comments: episode.commentCount || 0,
      likes: (episode.clapCount || 0) + (episode.favoriteCount || 0)
    }
  };
}

async function fetchXiaoyuzhouPodcasts(source, ctx) {
  const batches = await Promise.all((source.podcasts || []).map(async podcastConfig => {
    const id = podcastConfig.id || podcastConfig.pid;
    if (!id) return [];
    const url = `https://www.xiaoyuzhoufm.com/podcast/${encodeURIComponent(id)}`;
    const html = await fetchText(url, `${source.name}: ${podcastConfig.name || id}`, ctx.errors, {
      "User-Agent": "Mozilla/5.0 (compatible; cool-project-radar/0.1)"
    });
    const nextData = extractNextData(html);
    const podcast = nextData?.props?.pageProps?.podcast;
    const episodes = podcast?.episodes || [];
    return episodes
      .slice(0, podcastConfig.limit || source.limit || 12)
      .map(episode => normalizeXiaoyuzhouEpisode(episode, source, podcast))
      .filter(item => item.title && item.sourceUrl);
  }));
  return batches.flat();
}

function normalizeWeWeItem(raw, source, feedName, index, blockedDomains) {
  const title = cleanText(raw.title || raw.name || "");
  const text = stripHTML(raw.description || raw.content || raw.summary || raw.digest || "");
  const sourceUrl = raw.link || raw.url || raw.original_url || raw.sourceUrl || raw.mp_url || null;
  const createdAt = parseMaybeDate(raw.pubDate || raw.pub_date || raw.published || raw.createdAt || raw.updatedAt || raw.date);
  return {
    id: `wewe:${raw.id || raw.guid || sourceUrl || title}:${createdAt || index}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${feedName || "all"}`,
    platform: "wechat",
    title,
    text,
    appUrl: pickExternalUrl([...extractUrls(text), ...extractUrls(title)], blockedDomains),
    sourceUrl,
    author: raw.author || raw.feed?.title || raw.mp_name || feedName || null,
    createdAt,
    metrics: {
      score: 0,
      comments: 0
    }
  };
}

function collectWeWeItems(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.items)) return json.data.items;
  if (Array.isArray(json?.result)) return json.result;
  return [];
}

async function fetchWeWeRSS(source, ctx) {
  const baseUrl = (source.baseUrl || process.env[source.baseUrlEnv || "WEWE_RSS_BASE_URL"] || "").replace(/\/$/, "");
  if (!baseUrl) {
    ctx.errors.push(`${source.name}: missing ${source.baseUrlEnv || "WEWE_RSS_BASE_URL"} or sourceOptions.${source.id}.baseUrl`);
    return [];
  }

  const feeds = (source.feeds && source.feeds.length) ? source.feeds : [{ id: "all", name: "all" }];
  const batches = await Promise.all(feeds.map(async feed => {
    const feedId = feed.id || "all";
    const url = new URL(`${baseUrl}/feeds/${encodeURIComponent(feedId)}.json`);
    url.searchParams.set("limit", String(feed.limit || source.limit || 30));
    if (feed.titleInclude || source.titleInclude) url.searchParams.set("title_include", feed.titleInclude || source.titleInclude);
    if (feed.titleExclude || source.titleExclude) url.searchParams.set("title_exclude", feed.titleExclude || source.titleExclude);
    const json = await fetchJSON(url.toString(), `${source.name}: ${feed.name || feedId}`, ctx.errors);
    return collectWeWeItems(json)
      .map((item, index) => normalizeWeWeItem(item, source, feed.name || feedId, index, ctx.blockedDomains))
      .filter(item => item.title && item.sourceUrl);
  }));
  return batches.flat();
}

function sinceDateString(lookbackHours) {
  return new Date(Date.now() - lookbackHours * 36e5).toISOString().slice(0, 10);
}

function normalizeGitHubRepo(repo, source, query, blockedDomains) {
  const title = repo.full_name || repo.name;
  const text = [
    repo.description,
    (repo.topics || []).length ? `topics: ${(repo.topics || []).join(", ")}` : "",
    repo.language ? `language: ${repo.language}` : ""
  ].filter(Boolean).join("\n");
  const appUrl = pickExternalUrl([repo.homepage, repo.html_url], blockedDomains);
  return {
    id: `github:${repo.id}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${query}`,
    platform: "github",
    title,
    text,
    appUrl,
    sourceUrl: repo.html_url,
    author: repo.owner?.login || null,
    createdAt: repo.created_at || null,
    metrics: {
      score: repo.stargazers_count || 0,
      comments: 0,
      forks: repo.forks_count || 0
    }
  };
}

async function fetchGitHubRepoSearch(source, ctx) {
  const since = sinceDateString(ctx.lookbackHours);
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const items = [];
  for (const template of source.queries || []) {
    const query = template.replaceAll("{since}", since);
    const url = new URL(source.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("sort", source.sort || "stars");
    url.searchParams.set("order", source.order || "desc");
    url.searchParams.set("per_page", String(source.limit || 8));
    const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors, headers);
    for (const repo of json?.items || []) {
      if (repo.fork) continue;
      items.push(normalizeGitHubRepo(repo, source, query, ctx.blockedDomains));
    }
  }
  return items;
}

function localizedValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value["en-US"]) return value["en-US"];
  const first = Object.values(value)[0];
  return typeof first === "string" ? first : "";
}

function normalizeFirefoxAddon(addon, source, query) {
  const title = cleanText(localizedValue(addon.name));
  const text = cleanText(localizedValue(addon.summary) || localizedValue(addon.description));
  return {
    id: `firefox:${addon.id || addon.guid || addon.slug}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${query}`,
    platform: "firefox-addons",
    title,
    text,
    appUrl: addon.url || null,
    sourceUrl: addon.url || null,
    author: addon.authors?.[0]?.name || addon.authors?.[0]?.username || null,
    createdAt: addon.created || null,
    metrics: {
      score: addon.ratings?.average || 0,
      comments: addon.ratings?.count || 0,
      downloads: addon.weekly_downloads || 0,
      users: addon.average_daily_users || 0
    }
  };
}

async function fetchFirefoxAddons(source, ctx) {
  const since = sinceDateString(ctx.lookbackHours);
  const batches = await Promise.all((source.queries || []).map(async query => {
    const url = new URL(source.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "extension");
    url.searchParams.set("sort", "created");
    url.searchParams.set("page_size", String(source.limit || 12));
    url.searchParams.set("created__gte", since);
    const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors);
    return (json?.results || []).map(addon => normalizeFirefoxAddon(addon, source, query));
  }));
  return batches.flat();
}

function normalizeITunesApp(app, source, query) {
  const title = cleanText(app.trackName);
  const text = [
    app.description,
    app.primaryGenreName ? `genre: ${app.primaryGenreName}` : "",
    app.sellerName ? `seller: ${app.sellerName}` : ""
  ].filter(Boolean).join("\n");
  return {
    id: `itunes:${app.trackId}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${query}`,
    platform: "app-store",
    title,
    text,
    appUrl: app.trackViewUrl || null,
    sourceUrl: app.trackViewUrl || null,
    author: app.sellerName || app.artistName || null,
    createdAt: app.releaseDate || null,
    metrics: {
      score: app.averageUserRating || 0,
      comments: app.userRatingCount || 0
    }
  };
}

async function fetchITunesApps(source, ctx) {
  const batches = await Promise.all((source.queries || []).map(async query => {
    const url = new URL(source.endpoint);
    url.searchParams.set("term", query);
    url.searchParams.set("country", source.country || "us");
    url.searchParams.set("entity", "software");
    url.searchParams.set("limit", String(source.limit || 20));
    const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors);
    return (json?.results || []).map(app => normalizeITunesApp(app, source, query));
  }));
  return batches.flat();
}

function normalizeV2EXTopic(topic, source, node, blockedDomains) {
  const title = cleanText(topic.title);
  const text = stripHTML(topic.content_rendered || topic.content || "");
  const sourceUrl = topic.url || `https://www.v2ex.com/t/${topic.id}`;
  const appUrl = pickExternalUrl([...extractUrls(text), ...extractUrls(title)], blockedDomains);
  return {
    id: `v2ex:${topic.id}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${node}`,
    platform: "v2ex",
    title,
    text,
    appUrl,
    sourceUrl,
    author: topic.member?.username || null,
    createdAt: toISOFromSeconds(topic.created),
    metrics: {
      score: 0,
      comments: topic.replies || 0
    }
  };
}

async function fetchV2EX(source, ctx) {
  const batches = await Promise.all((source.nodes || []).map(async node => {
    const url = source.endpoint.replace("{node}", encodeURIComponent(node));
    const json = await fetchJSON(url, `${source.name}: ${node}`, ctx.errors);
    return (Array.isArray(json) ? json : []).map(topic =>
      normalizeV2EXTopic(topic, source, node, ctx.blockedDomains)
    );
  }));
  return batches.flat();
}

function normalizeLobstersStory(story, source, blockedDomains) {
  const title = cleanText(story.title);
  const text = cleanText(story.description || "");
  const appUrl = pickExternalUrl([story.url, ...extractUrls(text), ...extractUrls(title)], blockedDomains);
  return {
    id: `lobsters:${story.short_id}`,
    sourceId: source.id,
    sourceName: source.name,
    platform: "lobsters",
    title,
    text,
    appUrl,
    sourceUrl: story.comments_url || `https://lobste.rs/s/${story.short_id}`,
    author: story.submitter_user || null,
    createdAt: story.created_at || null,
    metrics: {
      score: story.score || 0,
      comments: story.comment_count || 0
    }
  };
}

async function fetchLobsters(source, ctx) {
  const json = await fetchJSON(source.endpoint, source.name, ctx.errors);
  return (Array.isArray(json) ? json : [])
    .slice(0, source.limit || 50)
    .map(story => normalizeLobstersStory(story, source, ctx.blockedDomains));
}

function bskyPostUrl(post) {
  const handle = post.author?.handle;
  const uri = post.uri || "";
  const rkey = uri.split("/").pop();
  if (!handle || !rkey) return null;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function normalizeBlueskyPost(post, source, query, blockedDomains) {
  const title = cleanText(post.record?.text || "").slice(0, 120);
  const text = cleanText(post.record?.text || "");
  const embedUrl = post.embed?.external?.uri || post.record?.embed?.external?.uri;
  const appUrl = pickExternalUrl([embedUrl, ...extractUrls(text)], blockedDomains);
  return {
    id: `bsky:${post.uri || post.cid}`,
    sourceId: source.id,
    sourceName: `${source.name} / ${query}`,
    platform: "bluesky",
    title: title || "(Bluesky post)",
    text,
    appUrl,
    sourceUrl: bskyPostUrl(post),
    author: post.author?.handle || null,
    createdAt: post.record?.createdAt || post.indexedAt || null,
    metrics: {
      score: 0,
      comments: post.replyCount || 0,
      likes: post.likeCount || 0,
      reposts: post.repostCount || 0
    }
  };
}

async function fetchBluesky(source, ctx) {
  const batches = await Promise.all((source.queries || []).map(async query => {
    const url = new URL(source.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "latest");
    url.searchParams.set("limit", String(source.limit || 25));
    const json = await fetchJSON(url.toString(), `${source.name}: ${query}`, ctx.errors);
    return (json?.posts || []).map(post =>
      normalizeBlueskyPost(post, source, query, ctx.blockedDomains)
    );
  }));
  return batches.flat();
}

function withinLookback(item, lookbackHours) {
  if (!item.createdAt) return true;
  const age = Date.now() - new Date(item.createdAt).getTime();
  return age <= lookbackHours * 36e5;
}

function dedupeRawItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.id || `${item.sourceUrl}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function aggregate(items, keywords, ctx) {
  const groups = new Map();
  for (const item of items) {
    const scored = scoreItem(item, keywords, ctx.focusKeywords);
    const enriched = { ...item, ...scored, appName: inferName(item) };
    const key = item.appUrl ? `url:${canonicalUrl(item.appUrl)}` : `title:${slugify(item.title)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        appName: enriched.appName,
        appUrl: item.appUrl,
        score: 0,
        confidence: "low",
        signals: enriched.signals,
        reasons: new Set(),
        sources: [],
        firstSeenAt: item.createdAt,
        lastSeenAt: item.createdAt,
        metrics: { score: 0, comments: 0, likes: 0, reposts: 0, downloads: 0, users: 0 },
        sampleText: item.text || item.title,
        developerHeavy: enriched.signals.developerHeavy,
        verticalProfessional: enriched.signals.verticalProfessional
      });
    }

    const group = groups.get(key);
    group.score = Math.max(group.score, enriched.score);
    group.metrics.score += item.metrics.score || 0;
    group.metrics.comments += item.metrics.comments || 0;
    group.metrics.likes += item.metrics.likes || 0;
    group.metrics.reposts += item.metrics.reposts || 0;
    group.metrics.downloads += item.metrics.downloads || 0;
    group.metrics.users += item.metrics.users || 0;
    group.developerHeavy = group.developerHeavy || enriched.signals.developerHeavy;
    group.verticalProfessional = group.verticalProfessional || enriched.signals.verticalProfessional;
    for (const reason of enriched.reasons) group.reasons.add(reason);
    group.sources.push({
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      platform: item.platform,
      title: item.title,
      sourceUrl: item.sourceUrl,
      author: item.author,
      createdAt: item.createdAt,
      metrics: item.metrics,
      score: enriched.score,
      signals: enriched.signals
    });

    if (item.createdAt) {
      if (!group.firstSeenAt || new Date(item.createdAt) < new Date(group.firstSeenAt)) group.firstSeenAt = item.createdAt;
      if (!group.lastSeenAt || new Date(item.createdAt) > new Date(group.lastSeenAt)) group.lastSeenAt = item.createdAt;
    }

    group.signals = {
      hasAppUrl: group.signals.hasAppUrl || enriched.signals.hasAppUrl,
      launchLikely: group.signals.launchLikely || enriched.signals.launchLikely,
      vibeCodedLikely: group.signals.vibeCodedLikely || enriched.signals.vibeCodedLikely,
      consumerAppLikely: group.signals.consumerAppLikely || enriched.signals.consumerAppLikely,
      pmInspirationLikely: group.signals.pmInspirationLikely || enriched.signals.pmInspirationLikely,
      novelInteractionLikely: group.signals.novelInteractionLikely || enriched.signals.novelInteractionLikely,
      sceneInnovationLikely: group.signals.sceneInnovationLikely || enriched.signals.sceneInnovationLikely,
      coolPotentialLikely: group.signals.coolPotentialLikely || enriched.signals.coolPotentialLikely,
      verticalProfessional: group.signals.verticalProfessional || enriched.signals.verticalProfessional,
      developerHeavy: group.signals.developerHeavy || enriched.signals.developerHeavy
    };
  }

  return [...groups.values()].map(group => {
    const crossSourceBonus = Math.min(12, (new Set(group.sources.map(s => s.platform)).size - 1) * 6);
    const discussionBonus = Math.min(10, Math.log1p(
      group.metrics.comments +
      group.metrics.likes +
      group.metrics.reposts +
      group.metrics.downloads * 0.2 +
      group.metrics.users * 0.1
    ) * 3);
    const innovationBonus = group.signals.coolPotentialLikely ? 8 : 0;
    const score = Math.round((group.score + crossSourceBonus + discussionBonus + innovationBonus) * 10) / 10;
    const confidence = score >= 50 ? "high" : score >= 35 ? "medium" : "low";
    return {
      ...group,
      score,
      confidence,
      innovationScore: innovationBonus,
      reasons: [...group.reasons],
      sourceCount: group.sources.length
    };
  }).sort((a, b) => b.score - a.score);
}

async function fetchSource(source, ctx) {
  if (source.type === "hn_algolia" || source.type === "hn_algolia_queries") return fetchHN(source, ctx);
  if (source.type === "reddit_listing") return fetchReddit(source, ctx);
  if (source.type === "producthunt_rss") return fetchProductHuntRSS(source, ctx);
  if (source.type === "generic_rss") return fetchGenericRSS(source, ctx);
  if (source.type === "youtube_channel_rss") return fetchYouTubeChannelRSS(source, ctx);
  if (source.type === "twitterapi_io_search") return fetchTwitterApiIo(source, ctx);
  if (source.type === "xiaoyuzhou_podcast") return fetchXiaoyuzhouPodcasts(source, ctx);
  if (source.type === "wewe_rss") return fetchWeWeRSS(source, ctx);
  if (source.type === "github_repo_search") return fetchGitHubRepoSearch(source, ctx);
  if (source.type === "firefox_addons_search") return fetchFirefoxAddons(source, ctx);
  if (source.type === "itunes_app_search") return fetchITunesApps(source, ctx);
  if (source.type === "v2ex_nodes") return fetchV2EX(source, ctx);
  if (source.type === "lobsters_tag") return fetchLobsters(source, ctx);
  if (source.type === "bluesky_search") return fetchBluesky(source, ctx);
  ctx.errors.push(`${source.name}: unsupported source type ${source.type}`);
  return [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaults = await loadJSON(DEFAULT_SOURCES_PATH, {});
  const userConfig = await loadJSON(USER_CONFIG_PATH, {});
  const profile = userConfig.profile || {};
  const baseProjectFormats = normalizedList(userConfig.projectFormats || profile.projectFormats);
  const baseDomains = normalizedList(userConfig.domains || profile.domains);
  const baseFocusKeywords = normalizedList(userConfig.focusKeywords || profile.focusKeywords);
  const projectFormats = args.projectFormats?.length ? args.projectFormats : baseProjectFormats;
  const domains = args.domains?.length ? args.domains : baseDomains;
  const curationStyle = args.curationStyle || userConfig.curationStyle || profile.curationStyle || "balanced";
  const explicitFocusKeywords = [
    ...baseFocusKeywords,
    ...normalizedList(args.focusKeywords)
  ];

  const config = {
    language: args.language || userConfig.language || "en",
    lookbackHours: args.lookbackHours || userConfig.lookbackHours || defaults.defaultLookbackHours || 72,
    maxCandidates: args.maxCandidates || userConfig.maxCandidates || defaults.defaultMaxCandidates || 20,
    projectFormats,
    domains,
    curationStyle,
    focusKeywords: buildFocusKeywords({
      projectFormats,
      domains,
      curationStyle,
      focusKeywords: explicitFocusKeywords
    }),
    blockedDomains: normalizedList(args.blockedDomains || userConfig.blockedDomains).map(d => d.replace(/^www\./, "")),
    enabledSources: args.enabledSources || userConfig.enabledSources || null,
    sourceOptions: userConfig.sourceOptions || {}
  };

  const errors = [];
  const preflight = args.preflight ? await runPreflight() : { ok: true, skipped: true, checks: [] };
  if (!preflight.ok) {
    console.log(JSON.stringify({
      status: "network_unavailable",
      generatedAt: new Date().toISOString(),
      message: "DNS preflight failed for all core hosts. Retry later instead of treating this as an empty radar result.",
      config,
      preflight
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const ctx = { ...config, errors };
  const sourcesToRun = (defaults.sources || []).map(source => ({
    ...source,
    ...(config.sourceOptions[source.id] || {})
  })).filter(source => {
    if (config.enabledSources) return config.enabledSources.includes(source.id);
    if (!source.enabled) return false;
    return true;
  });

  const sourceReports = [];
  const rawItems = [];

  for (const source of sourcesToRun) {
    const beforeErrorCount = errors.length;
    const started = Date.now();
    let items = [];
    try {
      items = await fetchSource(source, ctx);
    } catch (err) {
      errors.push(`${source.name}: ${err.message}`);
    }
    const filtered = items.filter(item => withinLookback(item, config.lookbackHours));
    rawItems.push(...filtered);
    sourceReports.push({
      id: source.id,
      name: source.name,
      type: source.type,
      reliability: source.reliability,
      use: source.use,
      status: errors.length === beforeErrorCount ? "ok" : "partial_or_failed",
      count: filtered.length,
      elapsedMs: Date.now() - started,
      errors: errors.slice(beforeErrorCount)
    });
  }

  const dedupedRaw = dedupeRawItems(rawItems);
  const candidates = aggregate(dedupedRaw, defaults.signalKeywords || {}, ctx)
    .slice(0, config.maxCandidates);
  const prompt = await loadText(USER_PROMPT_PATH, DEFAULT_PROMPT_PATH);
  const outputConfig = {
    ...config,
    sourceOptions: Object.fromEntries(Object.entries(config.sourceOptions).map(([id, options]) => [
      id,
      Object.fromEntries(Object.entries(options || {}).map(([key, value]) => [
        key,
        /(key|token|auth|secret|password)/i.test(key) ? "[redacted]" : value
      ]))
    ]))
  };

  const output = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    config: outputConfig,
    sources: sourceReports,
    notUsed: defaults.notUsed || [],
    stats: {
      rawItems: rawItems.length,
      dedupedRawItems: dedupedRaw.length,
      candidates: candidates.length,
      lookbackHours: config.lookbackHours
    },
    preflight,
    candidates,
    rawItems: dedupedRaw
      .sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)))
      .slice(0, 60),
    prompts: {
      project_radar_digest: prompt
    },
    errors: errors.length ? errors : undefined
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ status: "error", message: err.message }, null, 2));
  process.exit(1);
});
