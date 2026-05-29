---
name: cool-project-radar
description: Configurable project-discovery radar for finding and curating fresh apps, web products, browser extensions, AI tools, indie projects, open-source demos, consumer hardware, games, and playful internet products. Use when the user asks to discover new projects, track launches, generate a product/project digest, find cool tools matching their interests, run a personal radar, or asks for /radar, /project-radar, /cool-projects, /hot-projects, or similar fresh-project discovery.
---

# Cool Project Radar

Discover fresh projects from stable public sources, rank them against the user's interests, and turn them into a concise digest with source links.

This is a public, configurable skill. Do not hard-code another user's personal taste profile, email setup, private examples, automation memory, or local file paths into the output.

## User Profile

Use `~/.cool-project-radar/config.json` as the user's local radar profile.

If the config file is missing, ask at most three questions before running a digest:

1. What kinds of projects do you want to see?
2. What scenarios or domains do you care about?
3. What curation style should the radar use: `innovation`, `popular`, `practical`, `weird`, or `balanced`?

Read `references/onboarding.md` when creating or changing the profile. After the user answers, write the config directly or run:

```bash
node scripts/init-config.js \
  --language en \
  --formats "web apps,browser extensions,AI tools" \
  --domains "productivity,creator tools,design" \
  --style innovation
```

Infer `language` from the user's conversation language unless they specify otherwise.

## Run The Radar

Run:

```bash
node scripts/prepare-digest.js --lookback 72 --limit 60 > /tmp/cool-project-radar.json
```

Useful options:

```bash
node scripts/prepare-digest.js --lookback 168 --limit 80
node scripts/prepare-digest.js --lookback 24 --formats "browser extensions,AI tools" --domains "writing,research" --style practical
node scripts/prepare-digest.js --lookback 168 --formats "hardware,wearables,smart home" --domains "health,family" --style innovation
node scripts/prepare-digest.js --focus "local-first,privacy,camera,WebGPU" --style weird
node scripts/prepare-digest.js --sources product_hunt_rss,github_app_search,firefox_addons
node scripts/prepare-digest.js --skip-preflight
```

The script outputs JSON with:

- `config`: effective user profile with secrets redacted.
- `preflight`: DNS checks for core public hosts.
- `sources`: source status and non-fatal errors.
- `candidates`: normalized, scored project candidates.
- `rawItems`: sampled raw items for audit.
- `prompts.project_radar_digest`: the digest prompt to follow.

If the output status is `network_unavailable`, treat it as transient DNS/network failure. Do not write an empty digest; retry later.

## Per-Request Customization

Treat `~/.cool-project-radar/config.json` as the default radar, not a cage. When a user asks for a narrower run, override the profile for that run.

Map natural-language requests to script arguments:

- Time window: "today", "last 24h", "this week", "past 7 days" -> `--lookback 24`, `--lookback 168`, etc.
- Project format: "browser extensions", "hardware", "AI apps", "web toys", "open-source tools" -> `--formats`.
- Scenario/domain: "travel", "family coordination", "creator tools", "health", "developer workflow" -> `--domains`.
- Taste/style: "most innovative", "popular", "practical", "weird/experimental", "balanced" -> `--style`.
- Specific boosts: "local-first", "camera", "music", "ADHD", "WebGPU", "privacy" -> `--focus`.
- Source scope: "only Product Hunt and GitHub" -> `--sources product_hunt_rss,github_app_search`.

Example user requests this skill should support:

- "Run my radar for the last 24 hours."
- "Find weird browser extensions from the past week."
- "Look for consumer hardware and wearable projects from the last 10 days."
- "I want practical AI workflow tools for researchers, last 72 hours."
- "Only scan Product Hunt and GitHub for creator tools."
- "This time, bias toward local-first privacy apps."

## Selection

Use the score as a recall aid, not as the final ranking. Inspect roughly the top 30-40 candidates when available.

Select projects that match the user's configured:

- `projectFormats`: apps, web products, extensions, hardware, games, AI tools, open-source tools, creator tools, etc.
- `domains`: productivity, social, family, travel, health, education, design, developer tools, consumer hardware, etc.
- `curationStyle`: innovation, popular, practical, weird, or balanced.

Prefer projects with a concrete new scene, audience, interaction, taste, distribution mechanic, hardware-service model, or AI workflow. Demote generic AI news, pure infrastructure, enterprise SaaS, pure APIs/libraries, tutorials, and industrial hardware unless their mechanism clearly transfers to the user's interests.

## Digest Writing

Use only the JSON output plus source URLs in that JSON. Do not invent products, traction, screenshots, revenue, or product details.

Follow `prompts/project-radar-digest.md`. Keep 6-12 projects when enough good candidates exist. Include experimental picks only when they help tune the user's radar.

Every item must include:

- What the project does.
- Why it matters for the user's radar.
- A raw project link when known.
- A raw source link.

## Screenshots

Only after selecting projects, optionally run:

```bash
node scripts/capture-screenshots.js \
  --input /tmp/cool-project-radar-selected.json \
  --output-dir /tmp/cool-project-radar-shots \
  --limit 8 \
  --timeout-ms 15000
```

Screenshots are best-effort. Never select or reject a project because an image exists. Include only useful official screenshots, landing-page images, or readable product pages. Omit login walls, Cloudflare/security pages, GitHub repo pages, discussion pages, blank states, and generic platform logos.

## Sources

Default no-key public sources include Hacker News, Product Hunt RSS, GitHub Search, Firefox Add-ons, Apple iTunes Search, V2EX, Lobsters, tech/media RSS, YouTube channel RSS, Reddit public JSON, and Bluesky public search. Some sources are best-effort and may return partial errors.

Optional sources such as X/Twitter via TwitterAPI.io, WeWe RSS, and Xiaoyuzhou podcast pages require user configuration. Put API keys in environment variables, not in config files.
