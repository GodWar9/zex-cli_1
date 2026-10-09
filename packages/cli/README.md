# @sahil/zex

Terminal coding assistant and authenticated headless API. Pre-release: not yet published.

After publication: `npm install -g @sahil/zex` or `npx @sahil/zex`. Requires Node.js 24.12+. Bun is only needed to build from source.

```text
zex                 Interactive terminal UI
zex --serve         Node HTTP/WebSocket API
zex --version       Version
zex --help          Help
```

Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` for real model calls, which may incur charges.

For `--serve`, set `ZEX_AUTH_TOKEN` to a random secret of at least 32 characters. Every API request requires `Authorization: Bearer <token>`. Default bind: `127.0.0.1:3000`; configure with `ZEX_HOST` and `PORT`. Public hosting needs TLS.

`GET /v1/health` reports status. `POST /v1/chat` takes `{"prompt":"Explain event loops"}`. `DAILY_BUDGET_USD` defaults to 10; accounting is in memory and resets on restart, not a provider billing cap.

The interactive assistant can edit files and run shell commands. Use trusted projects. Security scanning is heuristic; plan mode is advisory. The headless API is for a single trusted operator and does not expose all terminal tools.

For a no-key demo, architecture and release evidence, see [the repository](https://github.com/GodWar9/zex-cli_1).
