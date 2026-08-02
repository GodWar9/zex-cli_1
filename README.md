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

## Runtime requirements

- **Developing this repo:** [Bun](https://bun.sh) (any recent version) — used for installs, the dev loop, and building.
- **Using the published packages** (`npx zex`, `npm install @zex/core`): plain **Node.js >= 22.6.0**. No Bun required — the CLI and library are fully portable; see below.

## Using the published npm packages

This repo is the monorepo source. If you just want to *use* zex rather than
develop it:
- CLI: [`packages/cli/README.md`](./packages/cli/README.md) — `npx zex`
- Library: [`packages/core/README.md`](./packages/core/README.md) — `npm install @zex/core`

Both packages are verified against a real, isolated `npm install` (not just
local monorepo dev) as part of getting them ready to publish: the CLI's
binary, the headless `--serve` API (HTTP + WebSocket), and direct
`import { ZexOrchestrator } from "@zex/core"` library usage all run under
plain Node with zero Bun dependency.

## What Is Verified

- CI runs typecheck, offline tests, enterprise API/WebSocket tests, and both binary + npm-package builds on Linux, macOS, and Windows.
- `bun run benchmark` runs 25 fixed coding prompts three times with pruning/cache off and on, then writes [BENCHMARKS.md](BENCHMARKS.md) and [benchmarks/raw-data.json](benchmarks/raw-data.json).
- `bun run test:integration` contains live OpenAI, Anthropic, and Gemini adapter checks. Each provider's test is skipped independently if that provider's API-key secret isn't configured, and runs for real (nightly, via GitHub Actions) for whichever providers have keys set.

## Core Pieces

- Context pruner: scores chunks by relevance, recency, and pinned importance.
- Dual cache: exact hash hits plus high-similarity semantic hits.
- Provider-agnostic multi-key pool: pools and rotates API keys across any provider (not just the three built-ins), with per-provider quota tracking and configurable defaults for custom providers.
- Token and cost accounting: local tokenizer and model-cost calculator for session stats and benchmarks.
- Security scanner: blocks risky write patterns before tool output reaches files.
- TUI: React/Ink terminal interface with streaming output and status visibility.
- Headless API server (`zex --serve`): REST + WebSocket, runs under Node or Bun.

## Local Checks

```bash
bun run typecheck
bun run test-offline.ts
bun run test-enterprise.ts
bun run test:integration
bun run benchmark
bun run build            # standalone binary (bun --compile)
bun run build:packages   # @zex/core dist/ + zex CLI npm bin — what actually gets published
```

Live integration tests require:

```bash
$env:ZEX_LIVE_INTEGRATION = "true"
$env:OPENAI_API_KEY = "..."
$env:ANTHROPIC_API_KEY = "..."
$env:GEMINI_API_KEY = "..."
bun run test:integration
```

You don't need all three — any subset is fine. Unconfigured providers skip
cleanly rather than failing the run.

## Project Hygiene

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Benchmarks: [BENCHMARKS.md](BENCHMARKS.md)
- CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Nightly live API workflow: [.github/workflows/integration.yml](.github/workflows/integration.yml)
- Release workflow (tagged builds): [.github/workflows/release.yml](.github/workflows/release.yml)

Future work should land in small, logical commits and update the changelog with each user-visible change.
