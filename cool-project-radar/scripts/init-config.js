#!/usr/bin/env node

const { mkdir, writeFile } = require("fs/promises");
const { join } = require("path");
const { homedir } = require("os");

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    language: "en",
    projectFormats: [],
    domains: [],
    curationStyle: "balanced",
    lookbackHours: 72,
    maxCandidates: 36,
    output: join(homedir(), ".cool-project-radar", "config.json")
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--language" && argv[i + 1]) args.language = argv[++i];
    else if (arg === "--formats" && argv[i + 1]) args.projectFormats = parseList(argv[++i]);
    else if (arg === "--domains" && argv[i + 1]) args.domains = parseList(argv[++i]);
    else if (arg === "--style" && argv[i + 1]) args.curationStyle = argv[++i];
    else if (arg === "--lookback" && argv[i + 1]) args.lookbackHours = Number(argv[++i]);
    else if (arg === "--limit" && argv[i + 1]) args.maxCandidates = Number(argv[++i]);
    else if (arg === "--output" && argv[i + 1]) args.output = argv[++i];
  }

  return args;
}

function validate(config) {
  const languages = new Set(["zh", "en", "bilingual"]);
  const styles = new Set(["innovation", "popular", "practical", "weird", "balanced"]);
  if (!languages.has(config.language)) throw new Error("--language must be zh, en, or bilingual");
  if (!styles.has(config.curationStyle)) {
    throw new Error("--style must be innovation, popular, practical, weird, or balanced");
  }
  if (!Number.isFinite(config.lookbackHours) || config.lookbackHours < 1) {
    throw new Error("--lookback must be a positive number");
  }
  if (!Number.isFinite(config.maxCandidates) || config.maxCandidates < 1) {
    throw new Error("--limit must be a positive number");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = {
    language: args.language,
    projectFormats: args.projectFormats,
    domains: args.domains,
    curationStyle: args.curationStyle,
    lookbackHours: args.lookbackHours,
    maxCandidates: args.maxCandidates,
    focusKeywords: [],
    blockedDomains: [],
    sourceOptions: {}
  };
  validate(config);
  await mkdir(join(args.output, ".."), { recursive: true });
  await writeFile(args.output, JSON.stringify(config, null, 2) + "\n", "utf-8");
  console.log(JSON.stringify({ status: "ok", path: args.output, config }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ status: "error", message: err.message }, null, 2));
  process.exit(1);
});
