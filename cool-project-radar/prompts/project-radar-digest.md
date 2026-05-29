# Cool Project Radar Digest Prompt

Turn normalized project candidates into a concise discovery digest for the user's configured interests.

## Inputs

Use only the JSON produced by `scripts/prepare-digest.js` and source URLs inside that JSON. Do not invent projects, traction, screenshots, funding, revenue, or product details.

Respect the user's config:

- `projectFormats`: what kinds of projects they want, such as mobile apps, web apps, browser extensions, AI tools, hardware, games, or open-source tools.
- `domains`: scenarios or fields they care about, such as productivity, creator tools, social, family, travel, health, education, design, games, developer tools, or consumer hardware.
- `curationStyle`: `innovation`, `popular`, `practical`, `weird`, or `balanced`.

## Selection Standard

Do not blindly take the highest scores. Inspect roughly the top 30-40 candidates when available and select by product judgment.

Prefer projects that teach something about at least one of these lenses:

- New scene: a concrete situation people already recognize.
- New audience: a specific group with a recurring behavior or pain.
- New interaction: a different input method, interface shape, ritual, spatial model, or workflow position.
- New taste: distinctive packaging, aesthetics, format, or playful product language.
- New distribution: sharing loop, creator loop, community wedge, or platform-native behavior.
- New AI workflow: AI embedded into a real workflow rather than pasted on top.
- Hardware/service model: real-world object, device, or hardware-adjacent service that changes an ordinary user behavior.

Demote generic AI news, enterprise SaaS, pure infrastructure, pure APIs/libraries, migration tutorials, industrial hardware, and professional vertical tools unless their mechanism clearly transfers to the user's interests.

For `curationStyle`:

- `innovation`: favor fresh scenes, interactions, taste, or workflow shapes even with weak traction.
- `popular`: favor cross-source signals, launches with discussion, public metrics, and signs of momentum.
- `practical`: favor clear utility, low setup, immediate workflow value, and repeated use cases.
- `weird`: favor playful, experimental, tiny, surprising, or conceptually sharp projects; keep uncertainty visible.
- `balanced`: mix strong practical picks with a few experimental discoveries.

## Output Format

Use the user's configured language. If `language` is `bilingual`, write headings in English and Chinese where natural.

Start with:

```markdown
# Cool Project Radar — YYYY-MM-DD

Here are [N] projects from the last [lookback] hours that match your radar: [one sentence describing the configured focus].
```

Group by scenario or product category, not by source. Use natural category names based on the selected items. Keep 6-12 projects total when enough worthwhile candidates exist.

For each item:

```markdown
## Category Name

### N. ProjectName: one-line summary of what it is / what is new

![Alt text](/absolute/path/to/useful-product-image.png)

**Product:** Explain the concrete function, workflow, target users, and scenario using source-backed details only.

**Why it matters:** Name the specific mechanism, innovation, risk, or transferable lesson. Explicitly say what is new: scene, audience, interaction, taste, distribution, AI workflow, or hardware-service model.

Link: https://project.example

Source: https://source.example
```

Image lines are optional. Include only useful official screenshots, app-store screenshots, product landing-page images, or readable landing-page screenshots. Omit images that show login walls, Cloudflare/security checks, blank/loading states, platform discussion pages, GitHub repo pages, generic store logos, or mostly whitespace.

End with:

```markdown
## Takeaways

- 3-5 concrete observations across selected projects.
- If experimental picks are included, say what feedback would tune future selection.

## Sources

Based on public sources: [platform names only].
```

## Rules

- Every selected item must include a source URL.
- Include the project link when known; omit `Link:` only if no independent project URL is known.
- Keep uncertainty visible with words like "appears", "likely", "small signal", or "experimental" when evidence is thin.
- Do not include per-item freshness lines unless the user asks.
- Keep link lines as raw URLs only: `Link: https://...` and `Source: https://...`.
