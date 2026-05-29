# Cool Project Radar

Cool Project Radar is a configurable Codex skill for discovering fresh projects: apps, web products, browser extensions, AI tools, indie launches, open-source demos, consumer hardware, games, and playful internet products.

It asks each user for a small taste profile, then uses public sources to find and curate projects that match their interests.

## What It Does

- Fetches public no-login or best-effort sources such as Hacker News, Product Hunt RSS, GitHub Search, Firefox Add-ons, App Store/iTunes Search, V2EX, Lobsters, RSS feeds, Reddit public JSON, YouTube channel RSS, and Bluesky public search.
- Lets users configure preferred project formats, domains, and curation style.
- Supports per-run overrides for time window, formats, domains, style, keywords, and sources.
- Outputs normalized JSON candidates plus a digest prompt for Codex to write a source-backed project memo.
- Includes optional screenshot capture for selected project landing pages.
- Uses DNS preflight checks so network failures are not mistaken for empty results.

## Install

Install with Codex's skill installer:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo <owner>/cool-project-radar \
  --path cool-project-radar
```

Or copy the skill folder manually:

```bash
cp -R cool-project-radar ~/.codex/skills/
```

Restart Codex after installing so it picks up the skill.

## First-Time Setup

The skill should ask at most three questions:

1. What kinds of projects do you want to see?
2. What scenarios or domains do you care about?
3. What curation style should the radar use: `innovation`, `popular`, `practical`, `weird`, or `balanced`?

You can also initialize config from the command line:

```bash
node ~/.codex/skills/cool-project-radar/scripts/init-config.js \
  --language en \
  --formats "web apps,browser extensions,AI tools" \
  --domains "productivity,creator tools,design" \
  --style innovation
```

This writes `~/.cool-project-radar/config.json`.

See [examples/config.example.json](examples/config.example.json) for a sample profile.

## Usage

Ask Codex naturally:

```text
Run my project radar for the last 24 hours.
Find weird browser extensions from the past week.
Look for consumer hardware and wearable projects from the last 10 days.
I want practical AI workflow tools for researchers, last 72 hours.
Only scan Product Hunt and GitHub for creator tools.
This time, bias toward local-first privacy apps.
```

Equivalent CLI examples:

```bash
node ~/.codex/skills/cool-project-radar/scripts/prepare-digest.js \
  --lookback 72 \
  --limit 60 \
  > /tmp/cool-project-radar.json
```

```bash
node ~/.codex/skills/cool-project-radar/scripts/prepare-digest.js \
  --lookback 168 \
  --formats "hardware,wearables,smart home" \
  --domains "health,family" \
  --style innovation \
  --limit 80 \
  > /tmp/cool-project-radar-hardware.json
```

```bash
node ~/.codex/skills/cool-project-radar/scripts/prepare-digest.js \
  --sources product_hunt_rss,github_app_search,firefox_addons \
  --formats "browser extensions,AI tools" \
  --domains "writing,research" \
  --style practical \
  > /tmp/cool-project-radar-focused.json
```

## Output

`prepare-digest.js` outputs JSON containing:

- `config`: effective config with secrets redacted.
- `preflight`: DNS checks for core public hosts.
- `sources`: source status and non-fatal errors.
- `candidates`: normalized, scored project candidates.
- `rawItems`: sampled raw source items.
- `prompts.project_radar_digest`: digest-writing prompt.

Codex should inspect candidates, select by product judgment, and write a concise digest with raw project and source URLs.

## Optional Screenshots

After selecting projects, create a selected JSON and run:

```bash
node ~/.codex/skills/cool-project-radar/scripts/capture-screenshots.js \
  --input /tmp/cool-project-radar-selected.json \
  --output-dir /tmp/cool-project-radar-shots \
  --limit 8 \
  --timeout-ms 15000
```

Screenshots are best-effort display assets. The skill should never select or reject a project because it has or lacks an image.

## Configuration

User config lives at:

```text
~/.cool-project-radar/config.json
```

Supported fields:

- `language`: `zh`, `en`, or `bilingual`
- `projectFormats`: preferred types of projects
- `domains`: scenarios or fields
- `curationStyle`: `innovation`, `popular`, `practical`, `weird`, or `balanced`
- `lookbackHours`
- `maxCandidates`
- `focusKeywords`
- `blockedDomains`
- `enabledSources`
- `sourceOptions`

Keep API keys in environment variables. Do not commit `.env` or personal config files.

## Notes

Some public sources are best-effort and may rate-limit, block, timeout, or return partial results. DNS failures return `status: network_unavailable`; retry later instead of treating that as an empty project day.

## License

MIT
