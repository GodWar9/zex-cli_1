# zex — AI Coding Assistant

**Context-Aware · Security-First · Token-Efficient**

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.3-black?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-7.0-blue?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Ink-7.1_TUI-CC3333?logo=react&logoColor=white" alt="Ink">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.6-339933?logo=node.js&logoColor=white" alt="Node.js">
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google-gemini&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/OpenAI-Supported-412991?logo=openai&logoColor=white" alt="OpenAI">
  <img src="https://img.shields.io/badge/Anthropic-Supported-D97757?logo=anthropic&logoColor=white" alt="Anthropic">
</p>

[![CI](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml/badge.svg)](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml)

`zex` is a CLI-based AI coding assistant built to solve the "context pollution" problem. Most assistants either send too much context or too little. `zex` manages context deliberately — pruning stale data between turns and keeping a strict token budget — while enforcing layered security guardrails around every file write.

## Demo

Terminal recording: pending. Treat the efficiency numbers below as benchmark-backed (see [BENCHMARKS.md](BENCHMARKS.md)), not demo-verified, until a recording is added here.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime (dev) | [Bun](https://bun.sh) 1.3 |
| Runtime (published packages) | Node.js >= 22.6.0 (no Bun required — see [Using the published npm packages](#using-the-published-npm-packages)) |
| Language | TypeScript 7.0 |
| Terminal UI | [Ink](https://github.com/vadimdemedes/ink) 7.1 (React 19 for the terminal) |
| Headless API | `node:http` + [`ws`](https://github.com/websockets/ws) — REST + WebSocket |
| LLM providers | OpenAI, Anthropic, Gemini built in; provider-agnostic adapter interface for custom/self-hosted OpenAI-compatible endpoints |
| Tokenizer | [`js-tiktoken`](https://github.com/dqbd/tiktoken) |
| Payload encoding | [`@toon-format/toon`](https://www.npmjs.com/package/@toon-format/toon) for uniform-array tool results |
| Packaging | npm workspaces — `@zex/core` (library, compiled via `tsc`) + `zex` (CLI, bundled via Bun) |

## Security Guardrails

Security isn't an afterthought — every write is gated by a multi-tier security layer:

- **In-process scanner**: real-time regex-based scanning across 13 vulnerability rules (SQL injection, XSS via `innerHTML`, command injection, `eval()`, SSRF, hardcoded secrets/private keys, path traversal, unsafe `Math.random()` for secrets, and more) before any file write is executed. See [`security/scanner.ts`](./packages/core/src/security/scanner.ts).
- **Automated project audit**: runs once at session start, detects your framework (Next.js, Express, FastAPI) and whether the project touches auth, a database, or the filesystem, then shallow-scans existing source for pre-existing findings — capped at 50 files, completes in under 500ms.
- **Vulnerability blocking**: `write_file` and `patch_file` are gated tools — a `critical`-severity finding blocks the write outright (with a bounded retry budget before it's surfaced to you instead of looping); `high`/`medium` findings are logged as warnings, not silently ignored.
- **Security dashboard**: `/security` shows the full audit log of everything blocked, warned, or logged in your session.

## Advanced Context Hygiene

- **Relevance-aware GC**: tool results are only compressed if they're old (more than 3 user turns ago), large (over 600 characters), *and* not referenced by filename, tool name, or keyword in the last 3 messages. Nothing gets pruned just because it's old.
- **TOON encoding**: uniform-array tool results (directory listings, search results) get encoded via `@toon-format/toon` instead of raw JSON — roughly 40-60% fewer tokens on that payload shape, falling back to plain JSON for anything non-uniform.
- **Intent clarifier**: a cheap (300 max-token) pre-pass runs before every main agent call to disambiguate vague requests and flag security-sensitive intent (touching auth, a database, the filesystem, or env vars) early, before the expensive call happens.
- **Measured impact**: the checked-in benchmark (`bun run benchmark`, 25 fixed coding prompts, 3 runs, [full results](BENCHMARKS.md)) shows a 92.5% token reduction and 91.7% estimated-cost reduction with pruning and caching on vs. off. Reproducible — rerun it yourself.

## Core Features

- **Context pruner**: scores chunks by relevance, recency, and pinned importance — see Advanced Context Hygiene above.
- **Dual cache**: exact hash hits plus high-similarity semantic hits.
- **Provider-agnostic orchestration**: the multi-key pool and provider adapters aren't hardcoded to one vendor — built-in support for OpenAI, Anthropic, and Gemini, plus a registration API for custom/self-hosted OpenAI-compatible providers, with per-provider quota tracking.
- **Multi-key rotation**: the interactive TUI automatically cycles through a pool of Gemini API keys on a 429, putting the exhausted key on a 60-second cooldown and moving to the next one — no interrupted workflow.
- **Token and cost accounting**: local tokenizer and model-cost calculator for session stats and benchmarks.
- **Security scanner**: blocks risky write patterns before tool output reaches files (see Security Guardrails above).
- **Slash commands**:
  - `/security` — full security audit and event history
  - `/undo` — instant revert of the last file write (snapshot taken *before* the write, so it's always safe)
  - `/plan` — toggle plan-before-act mode, forcing the agent to propose a plan before touching code
  - `/keys` — health and cooldown status of your API key pool
- **Headless mode**: `zex --serve` runs the same orchestrator behind a REST + WebSocket API, for when you want zex embedded in something other than a terminal. Runs under Node or Bun.
- **Streaming TUI**: a React (Ink) terminal interface with streaming output and live status.

## Advantages

- **Extreme token efficiency**: 92.5% measured token reduction on the benchmark corpus with pruning + caching on ([BENCHMARKS.md](BENCHMARKS.md)).
- **Safe vibe coding**: focus on building — zex handles context management and blocks insecure writes before they land.
- **Smart pruning, not blind truncation**: recently-referenced context survives regardless of age; only stale, unreferenced tool output gets compressed.

## 🏁 Getting Started

### Prerequisites

- [Bun](https://bun.sh) — used for installs and the dev workflow below.
- One or more Gemini API keys (or an OpenAI/Anthropic key — see [Core Features](#core-features) above).

> Using the published package instead of developing this repo? `npx zex` and `npm install @zex/core` only need plain **Node.js >= 22.6.0** — no Bun required. See [`packages/cli/README.md`](./packages/cli/README.md) and [`packages/core/README.md`](./packages/core/README.md).

### Installation

```bash
bun install
```

### Run

```bash
export GEMINI_API_KEY="your-key-here"   # macOS/Linux
# $env:GEMINI_API_KEY = "your-key-here" # PowerShell
bun dev
```

Build a standalone binary:

```bash
bun run build
```

## What Is Verified

- CI runs typecheck, offline tests, enterprise API/WebSocket tests, and both binary + npm-package builds on Linux, macOS, and Windows.
- `bun run benchmark` runs 25 fixed coding prompts three times with pruning/cache off and on, then writes [BENCHMARKS.md](BENCHMARKS.md) and [benchmarks/raw-data.json](benchmarks/raw-data.json).
- `bun run test:integration` contains live OpenAI, Anthropic, and Gemini adapter checks. Each provider's test is skipped independently if that provider's API-key secret isn't configured, and runs for real (nightly, via GitHub Actions) for whichever providers have keys set.

## Using the published npm packages

This repo is the monorepo source. If you just want to *use* zex rather than develop it:
- CLI: [`packages/cli/README.md`](./packages/cli/README.md) — `npx zex`
- Library: [`packages/core/README.md`](./packages/core/README.md) — `npm install @zex/core`

Both packages are verified against a real, isolated `npm install` (not just local monorepo dev): the CLI binary, the headless `--serve` API, and direct `import { ZexOrchestrator } from "@zex/core"` library usage all run under plain Node with zero Bun dependency.

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

You don't need all three — any subset is fine. Unconfigured providers skip cleanly rather than failing the run.

## Project Hygiene

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Benchmarks: [BENCHMARKS.md](BENCHMARKS.md)
- CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Nightly live API workflow: [.github/workflows/integration.yml](.github/workflows/integration.yml)
- Release workflow (tagged builds): [.github/workflows/release.yml](.github/workflows/release.yml)

Future work should land in small, logical commits and update the changelog with each user-visible change.
