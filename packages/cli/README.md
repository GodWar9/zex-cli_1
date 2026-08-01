# zex

Autonomous AI coding agent for the terminal. Built on [`@zex/core`](https://www.npmjs.com/package/@zex/core).

## Install

```bash
npm install -g zex
# or, without installing:
npx zex
```

Requires Node.js **>= 22.6.0**.

## Quickstart

```bash
export OPENAI_API_KEY=sk-...   # or ANTHROPIC_API_KEY / GEMINI_API_KEY
npx zex
```

That launches the interactive TUI. Type a request and zex will plan, write
code, run tests, and ask for approval before touching files.

## CLI usage

```
zex                 Launch the interactive TUI
zex --serve         Run headless API server (port: PORT or 3000) — requires Bun runtime
zex --version, -v   Print version
zex --help, -h      Show this help
```

> **Known limitation:** `--serve` currently requires the [Bun](https://bun.sh)
> runtime (`bunx zex --serve`) — it uses `Bun.serve()` internally. The
> interactive TUI (plain `zex`) works fine under standard Node.js. A
> Node-native implementation of `--serve` is a proposed follow-up.

### Environment variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Provider credentials — zex auto-detects which to use |
| `ZEX_AUTH_REQUIRED` | Set `"true"` to fail closed when no API-server token is configured |
| `ZEX_AUTH_TOKEN` | Bearer token for the headless API server |
| `PORT` | API server port (default `3000`) |
| `DAILY_BUDGET_USD` | Daily spending cap (default `10.0`) |

## Building a custom agent on top of zex

If you want the orchestration engine without the TUI, use
[`@zex/core`](https://www.npmjs.com/package/@zex/core) directly — see its
README for the programmatic API.
