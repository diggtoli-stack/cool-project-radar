**English** | [中文](README.zh-CN.md)

# Cool Project Radar

A Codex skill for finding interesting new projects before they become obvious.

Tell it what you care about — apps, AI tools, browser extensions, hardware, games, creator tools, weird little internet products — and it will scan public sources, pick the most relevant projects, and write a short digest with links.

Think of it as a configurable radar for fresh product ideas.

## What You Get

Cool Project Radar can help you find:

- New apps, web products, browser extensions, and AI tools
- Indie launches, open-source demos, and Product Hunt-style projects
- Consumer hardware, wearables, smart-home ideas, and hardware-plus-app services
- Playful tools, tiny experiments, web toys, and interaction ideas
- Product inspiration grouped by scenario, not just by source
- Links back to the original project and discussion

It is not a generic news reader. It is meant to surface projects with product taste: a new user scene, a new interaction, a sharp workflow, a strange but useful idea, or a signal worth watching.

## Quick Start

1. Install the skill in Codex.
2. Say something like:

```text
Set up Cool Project Radar.
```

3. The agent will show three groups of selectable options:

- Project types: apps, web products, browser extensions, AI tools, open-source tools, hardware, games, creator/design tools
- Domains: productivity, writing/research, design/images, social/community, family/travel, health/habits, education, developer workflow, consumer hardware
- Curation style: innovation, popular, practical, weird, or balanced

Recommended reply format:

```text
Formats: web apps, browser extensions, AI tools
Domains: creator tools, writing, research, design
Style: innovation
```

After that, you can run your radar anytime:

```text
Run my project radar for the last 24 hours.
```

No API keys are needed for the default sources.

## How To Ask For A Radar Run

You do not need to edit config files for every run. Just tell your agent what you want this time.

Examples:

```text
Find weird browser extensions from the past week.
```

```text
Look for consumer hardware and wearable projects from the last 10 days.
```

```text
I want practical AI workflow tools for researchers, last 72 hours.
```

```text
Only scan Product Hunt and GitHub for creator tools.
```

```text
This time, bias toward local-first privacy apps.
```

The skill maps these requests to:

- Time window: last 24 hours, 72 hours, past week, past 10 days
- Project format: apps, web apps, extensions, hardware, games, AI tools
- Domain: productivity, creators, writing, design, family, travel, health, education, developer workflow
- Style: innovative, popular, practical, weird, or balanced
- Extra focus: local-first, privacy, camera, music, ADHD, WebGPU, etc.

## Curation Styles

Choose one default style during setup. You can override it in any run.

- `innovation`: fresh scenes, interactions, taste, or workflow shapes
- `popular`: projects with more launch/discussion/momentum signals
- `practical`: useful tools with clear repeated workflows
- `weird`: playful, experimental, tiny, or surprising projects
- `balanced`: a mix of strong practical picks and experiments

## Installation

Install from this GitHub repo with Codex's skill installer:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo diggtoli-stack/cool-project-radar \
  --path cool-project-radar
```

Then restart Codex so it can discover the skill.

You can also copy the skill folder manually:

```bash
cp -R cool-project-radar ~/.codex/skills/
```

## Manual Setup

If you want to create the config yourself:

```bash
node ~/.codex/skills/cool-project-radar/scripts/init-config.js \
  --language en \
  --formats "web apps,browser extensions,AI tools" \
  --domains "productivity,creator tools,design" \
  --style innovation
```

This writes:

```text
~/.cool-project-radar/config.json
```

See [examples/config.example.json](examples/config.example.json) for a sample profile.

## How It Works

1. The skill reads your local radar profile.
2. It fetches public launch and project sources.
3. It normalizes candidates into one JSON file.
4. Codex inspects the candidates and selects by product judgment.
5. Codex writes a digest with project links and source links.

Default public sources include Hacker News, Product Hunt RSS, GitHub Search, Firefox Add-ons, App Store/iTunes Search, V2EX, Lobsters, tech/product RSS, Reddit public JSON, YouTube channel RSS, and Bluesky public search.

Some sources are best-effort. They may rate-limit, block, timeout, or return partial results. If DNS fails, the script returns `network_unavailable` instead of pretending there were no projects.

## Optional Screenshots

After selecting projects, Codex can capture landing-page screenshots:

```bash
node ~/.codex/skills/cool-project-radar/scripts/capture-screenshots.js \
  --input /tmp/cool-project-radar-selected.json \
  --output-dir /tmp/cool-project-radar-shots \
  --limit 8 \
  --timeout-ms 15000
```

Screenshots are optional. A project should never be selected or rejected only because it has or lacks an image.

## Privacy

- Your profile lives locally at `~/.cool-project-radar/config.json`
- Default sources need no API keys
- Optional API-backed sources should use environment variables, not committed config files
- The skill only reads public pages, feeds, and APIs
- Your preferences stay on your machine

## Requirements

- Codex or another local coding agent that can read skill files and run shell commands
- Node.js 18+
- Internet access
- Chrome/Chromium only if you want optional screenshots

## License

MIT
