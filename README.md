# Zex — terminal coding assistant

[![CI](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml/badge.svg)](https://github.com/GodWar9/zex-cli_1/actions/workflows/ci.yml)

Zex explores reducing repeated context, coordinating model requests, and checking proposed file changes. It combines a React/Ink terminal interface with a TypeScript orchestration library and a Node HTTP/WebSocket API.

**Pre-release:** intended packages `@sahil/zex` and `@sahil/zex-core` are not yet published. See [release readiness](RELEASE_READINESS.md).

## Try without an API key

Requires Node.js 24.12+ and Bun 1.3.12 for development.

```sh
git clone https://github.com/GodWar9/zex-cli_1.git
cd zex-cli_1
bun install --frozen-lockfile
npm run demo
npm run ci
```

The demo runs the real prompt pruner and security scanner locally. It prints token counts for a first turn and a tool-result turn, then scans a deliberately unsafe snippet. It does not generate model responses or make provider calls.

The CI command checks types, tools, SDK transports, HTTP/WebSocket behavior, and npm tarballs installed into an isolated consumer outside the repository. Provider tests use explicit test-only mocks.

## Run the assistant

Set `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` in your environment, then run `bun dev`. Live calls may cost money; the demo and default tests do not use them.

The assistant can edit files and execute shell commands. Use trusted projects. Pattern scanning is a heuristic, not a sandbox or a security guarantee. Plan mode is advisory, not an enforced approval boundary.

## Architecture

| Component | Responsibility |
|---|---|
| `packages/core/src/agent` | Tool loop, prompt selection, context management |
| `packages/core/src/llm` | Provider adapters, key pooling, queue, budget accounting |
| `packages/core/src/security` | Pattern scanning before supported file writes |
| `packages/cli/src/tui` | Interactive React/Ink terminal UI |
| `packages/cli/src/api` | Authenticated HTTP and WebSocket access |
| `scripts/check-packages.mjs` | Build, pack, isolated installation, runtime checks |

The terminal agent and headless API are separate entrypoints; HTTP chat queues model prompts rather than exposing every terminal tool.

## Headless API

Run `npm run build:packages`. Generate a token with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the result as `ZEX_AUTH_TOKEN`, then run `node packages/cli/dist/cli.js --serve`. Bun is not needed at runtime.

Default listener: `127.0.0.1:3000`. A token of at least 32 characters is required, including on loopback. Send `Authorization: Bearer <token>` to `GET /v1/health`, `GET /v1/budget`, or `POST /v1/chat` with JSON `{"prompt":"Explain event loops"}`. Real chat requires provider credentials. Configure the listener with `ZEX_HOST` and `PORT`; put public hosting behind TLS.

`DAILY_BUDGET_USD` defaults to 10. Accounting is process-local, resets on restart, and is not a provider billing limit. This release is for a single trusted operator.

## Evidence and limitations

- Offline checks exercise tools, pruning, SDK error handling, auth, validation, and WebSocket communication.
- `npm run test:package` tests built tarballs under plain Node.
- `npm run build:ci` produces an OS/architecture-specific standalone binary.
- Live provider integration tests are opt-in. A skipped test does not establish provider availability.
- [Benchmarks](BENCHMARKS.md) use a synthetic workload and estimated prices. Savings are not measurements of real paid traffic or guarantees for other workloads.
- See [the release plan](BUILD_PLAN.md) for account, live-provider and platform verification gates.

After publication, `npm install -g @sahil/zex` installs the `zex` command; `npm install @sahil/zex-core` installs the library. Both require Node 24.12+. See [CLI usage](packages/cli/README.md), [library API](packages/core/README.md), and [changelog](CHANGELOG.md).

Verified code and interview walkthrough: [release evidence](RELEASE_EVIDENCE.md).

Read the [user guide](packages/cli/USER_GUIDE.md) for API-key setup, provider capabilities, configuration precedence, server usage and troubleshooting.

Terminal tool calls are implemented for Gemini, OpenAI, Anthropic and the OpenAI-compatible adapters (OpenRouter, Ollama and custom endpoints). Select a model with function-calling support; use `"tools": false` for text-only models. See the user guide for execution boundaries and verification limits.
