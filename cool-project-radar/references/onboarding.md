# Onboarding Reference

Use this reference when `~/.cool-project-radar/config.json` is missing or the user asks to change their radar.

Ask at most three concise questions:

1. What kinds of projects do you want to see?
   Examples: mobile apps, web apps, browser extensions, AI tools, hardware/devices, games, open-source tools, creator tools.

2. What scenarios or domains do you care about?
   Examples: productivity, creator tools, social, family, travel, health, education, design, games, developer tools, consumer hardware.

3. What curation style should the radar use?
   Choose one: `innovation`, `popular`, `practical`, `weird`, or `balanced`.

After the user answers, write:

```json
{
  "language": "en",
  "projectFormats": ["web apps", "browser extensions", "AI tools"],
  "domains": ["productivity", "creator tools", "design"],
  "curationStyle": "innovation",
  "lookbackHours": 72,
  "maxCandidates": 36,
  "focusKeywords": [],
  "blockedDomains": [],
  "sourceOptions": {}
}
```

Store it at `~/.cool-project-radar/config.json`.

Infer language from the user's conversation language unless they specify otherwise. Keep `focusKeywords` for extra specific boosts such as "local-first", "camera", "music", "ADHD", "family coordination", or "WebGPU".

Do not copy another user's personal taste profile, private examples, email settings, or automation memory into the public config.
