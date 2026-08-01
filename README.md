# ZEX

[![CI](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml/badge.svg)](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml)

ZEX is a terminal coding agent focused on one problem: keeping long coding sessions useful after the context starts to fill up. Its differentiating idea is reliability-scored pruning: recent, referenced, and task-relevant context stays; stale tool output gets dropped or compressed.

## Demo

Terminal recording: pending. Do not treat the efficiency claims below as visual-demo verified until a 60-90 second recording is added here.

## Try It In 60 Seconds

```bash
npm install
$env:GEMINI_API_KEY = "your-key-here" # PowerShell
bun dev
```

macOS/Linux:

```bash
npm install
export GEMINI_API_KEY="your-key-here"
bun dev
```

Build a standalone binary:

```bash
bun run build
```

## Using the published npm packages

This repo is the monorepo source. If you just want to *use* zex rather than
develop it:
- CLI: [`packages/cli/README.md`](./packages/cli/README.md) — `npx zex`
- Library: [`packages/core/README.md`](./packages/core/README.md) — `npm install @zex/core`

## What Is Verified

- CI runs typecheck, offline tests, enterprise API/WebSocket tests, and binary builds on Linux, macOS, and Windows.
- `bun run benchmark` runs 25 fixed coding prompts three times with pruning/cache off and on, then writes [BENCHMARKS.md](BENCHMARKS.md) and [benchmarks/raw-data.json](benchmarks/raw-data.json).
- `bun run test:integration` contains live OpenAI, Anthropic, and Gemini adapter checks. It is skipped by default and runs in the nightly GitHub workflow when API-key secrets are configured.

## Core Pieces

- Context pruner: scores chunks by relevance, recency, and pinned importance.
- Dual cache: exact hash hits plus high-similarity semantic hits.
- Token and cost accounting: local tokenizer and model-cost calculator for session stats and benchmarks.
- Security scanner: blocks risky write patterns before tool output reaches files.
- TUI: React/Ink terminal interface with streaming output and status visibility.

## Local Checks

```bash
bun run typecheck
bun run test-offline.ts
bun run test-enterprise.ts
bun run test:integration
bun run benchmark
bun run build
```

Live integration tests require:

```bash
$env:ZEX_LIVE_INTEGRATION = "true"
$env:OPENAI_API_KEY = "..."
$env:ANTHROPIC_API_KEY = "..."
$env:GEMINI_API_KEY = "..."
bun run test:integration
```

## Project Hygiene

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Benchmarks: [BENCHMARKS.md](BENCHMARKS.md)
- CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Nightly live API workflow: [.github/workflows/integration.yml](.github/workflows/integration.yml)

Future work should land in small, logical commits and update the changelog with each user-visible change.
