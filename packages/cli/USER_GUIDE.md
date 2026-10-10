# Zex user guide

Zex accepts your own model-provider keys. The terminal reads credentials on your computer; the headless server reads credentials configured on that server. No Zex account is required.

**Pre-release:** npm packages are not published yet. Source installation works now; registry commands below apply after publication. Offline test success does not certify live provider availability.

## Install

Requires Node.js 24.12+. After publication:

```sh
npm install -g @sahil/zex
zex --version
zex --help
```

Before publication, use Node and Bun 1.3.12:

```sh
git clone https://github.com/GodWar9/zex-cli_1.git
cd zex-cli_1
bun install --frozen-lockfile
npm run build:packages
node packages/cli/dist/cli.js --version
npm run demo
```

For subsequent commands, replace `zex` with `node packages/cli/dist/cli.js` when using source. Use an absolute path to the built CLI if launching it from another project. The current directory is the assistant's working project.

## Provider capabilities

| Provider ID | Credential variable | Terminal responses | Terminal file/shell tools | Headless chat |
|---|---|---|---|---|
| gemini | GEMINI_API_KEY or GOOGLE_API_KEY | Implemented | Implemented | Implemented |
| openai | OPENAI_API_KEY | Implemented | Implemented* | Implemented |
| anthropic | ANTHROPIC_API_KEY | Implemented | Implemented* | Implemented |
| openrouter | OPENROUTER_API_KEY | Implemented | Implemented* | Not built in |
| ollama | None for local Ollama | Implemented | Implemented* | Not built in |
| Compatible endpoint via openai | ZEX_API_KEY + ZEX_BASE_URL | Depends on endpoint | Implemented* | Not built in |

Gemini, OpenAI and Anthropic expose Zex's file/shell tools. OpenRouter, Ollama and custom OpenAI-compatible endpoints use the same tool protocol; the selected model and endpoint must support function calling. Headless chat queues model prompts, not terminal tool execution. Implemented means the adapter and deterministic tests exist, not that every model has been tested live. The asterisk marks newly added tool support tested through mocked SDK transports and real local tools.

Get credentials from [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://platform.claude.com/settings/keys), [Google AI Studio](https://aistudio.google.com/apikey), or [OpenRouter](https://openrouter.ai/settings/keys). Your account must have access and quota for the chosen model; Zex does not include API credits.

## Quick start

PowerShell:

```powershell
$env:ZEX_PROVIDER = "gemini"
$env:GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
$env:ZEX_MODEL = "YOUR_AVAILABLE_GEMINI_MODEL_ID"
zex --doctor
zex
```

macOS/Linux:

```sh
export ZEX_PROVIDER="gemini"
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
export ZEX_MODEL="YOUR_AVAILABLE_GEMINI_MODEL_ID"
zex --doctor
zex
```

Replace placeholders with your own values. These variables apply to the current shell and its child processes. Start with a small request such as “Explain event loops.” That request calls the provider and may consume credits.

`--doctor` reports the selected provider/model, endpoint origin and whether credentials are present. It does not print keys or make network calls. Exit 0 means configuration is present; exit 1 means missing credentials or invalid configuration. It does not establish key validity, model access, billing or server availability.

For another provider, change ZEX_PROVIDER, set its credential variable from the table, and set ZEX_MODEL to a model available on that service. OpenRouter uses its own model IDs.

For Ollama, install/start the service and download a model separately. Set ZEX_PROVIDER=ollama and ZEX_MODEL to the installed model. The default endpoint is http://localhost:11434/v1. See [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility). Zex does not download or start models.

## OpenAI-compatible endpoints

PowerShell example:

```powershell
$env:ZEX_PROVIDER = "openai"
$env:ZEX_BASE_URL = "https://YOUR_PROVIDER_HOST/v1"
$env:ZEX_API_KEY = "YOUR_ENDPOINT_KEY"
$env:ZEX_MODEL = "YOUR_ENDPOINT_MODEL_ID"
zex --doctor
zex
```

Use the provider's exact base URL and model ID. Remote endpoints must use HTTPS; HTTP is accepted for localhost, 127.0.0.1 and ::1. URLs cannot contain credentials, query strings or fragments.

The adapter uses Chat Completions streaming and usage options. Groq, DeepSeek, Mistral, Together and other compatible services need individual testing. Azure OpenAI, Bedrock and Vertex AI have no dedicated integration in this release.

Clear generic overrides when changing providers, so one provider's key is not sent to another:

```powershell
Remove-Item Env:ZEX_API_KEY, Env:ZEX_BASE_URL, Env:ZEX_MODEL -ErrorAction SilentlyContinue
```

```sh
unset ZEX_API_KEY ZEX_BASE_URL ZEX_MODEL
```

## Configuration files and precedence

Optional file: ~/.zex/config.json (Windows: %USERPROFILE%/.zex/config.json). Create the directory if necessary. Prefer keeping credentials in environment variables.

```json
{
  "provider": "gemini",
  "model": "YOUR_AVAILABLE_GEMINI_MODEL_ID",
  "maxTokens": 4096,
  "temperature": 0.2
}
```

ZEX_CONFIG_FILE selects another JSON file. A missing explicitly named file or malformed JSON fails visibly. Restart Zex after changes.

1. ZEX_PROVIDER, ZEX_MODEL, ZEX_BASE_URL and ZEX_API_KEY override file settings.
2. File settings override provider-specific environment values and defaults.
3. Automatic provider detection: Gemini, Anthropic, OpenAI, then OpenRouter. Without keys, Gemini is selected and doctor reports missing credentials.
4. Selecting a provider gives it its own default model. When ZEX_PROVIDER changes the saved provider, the saved model, key, pool and base URL are ignored. Explicit generic environment overrides still apply.
5. Credential priority: ZEX_API_KEY > file apiKey > file apiKeys (Gemini only) > GEMINI_API_KEYS (Gemini only) > provider-specific single key. GEMINI_API_KEY precedes GOOGLE_API_KEY.

Default model IDs are convenience fallbacks, not availability guarantees. Select an explicit model your account supports. maxTokens must be a positive integer; temperature must be 0–2, though individual models may impose a narrower range.

The CLI reads .env from the working directory via dotenv; existing shell variables win. Config/.env files are plaintext, not encrypted storage. Keep them private and out of Git. The core library does not automatically load .env; pass credentials explicitly or load your environment first.

## Multiple Gemini keys

GEMINI_API_KEYS accepts a comma-separated list. Alternatively set apiKeys to a JSON array of non-empty strings in a Gemini config file. Environment-list blanks and duplicate pool keys are removed.

A Gemini 429 can trigger a 60-second cooldown and rotation. Use authorized credentials within the provider's terms; rotation does not create quota. Explicit apiKey or ZEX_API_KEY overrides the pool. Other terminal providers do not currently offer this rotation mechanism.

## Headless server

The server reads provider-specific key variables and GEMINI_API_KEYS. It does not read terminal JSON settings or terminal ZEX_* provider overrides.

PowerShell:

```powershell
$env:OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"
$env:ZEX_AUTH_TOKEN = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
zex --serve
```

macOS/Linux:

```sh
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
export ZEX_AUTH_TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
zex --serve
```

The server token authenticates clients to Zex; provider keys authenticate Zex to model services. Every start requires ZEX_AUTH_TOKEN with at least 32 characters.

| Setting | Default / meaning |
|---|---|
| ZEX_HOST | 127.0.0.1 |
| PORT | 3000 |
| ZEX_AUTH_TOKEN | Required shared bearer secret |
| DAILY_BUDGET_USD | 10; positive in-memory budget setting |

From another PowerShell terminal with the same token configured:

```powershell
$headers = @{ Authorization = "Bearer $env:ZEX_AUTH_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3000/v1/health -Headers $headers
$body = @{ provider = "openai"; model = "YOUR_AVAILABLE_OPENAI_MODEL_ID"; prompt = "Explain event loops" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3000/v1/chat -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

macOS/Linux:

```sh
curl -H "Authorization: Bearer $ZEX_AUTH_TOKEN" http://127.0.0.1:3000/v1/health
curl -H "Authorization: Bearer $ZEX_AUTH_TOKEN" -H "Content-Type: application/json" -d '{"provider":"openai","model":"YOUR_AVAILABLE_OPENAI_MODEL_ID","prompt":"Explain event loops"}' http://127.0.0.1:3000/v1/chat
```

Use provider=anthropic or gemini with its matching key and model. Known model prefixes infer a provider; explicit selection avoids ambiguity. Missing keys and mismatched provider/model return 400 before queueing. Retries stay within that provider. With no provider/model, the first configured provider in OpenAI, Anthropic, Gemini order supplies its default model.

Bodies are limited to 1 MiB; prompts to 32,000 characters. Chat waits up to 30 seconds. A 504 includes a task ID and does not guarantee cancellation. WebSocket endpoint: /v1/ws/<sessionId>; use a bearer header and the same sessionId in chat. Events include status, metrics and available chunks; headless adapters may buffer whole responses.

This is a single-operator server, without user accounts, per-user key storage or tenant isolation. Keep it on loopback or behind TLS and access controls. Health 200 means the process responds, not that model access works. Budget accounting resets on restart and is not a provider billing cap.

## Troubleshooting

| Symptom | Action |
|---|---|
| Doctor reports missing key | Check the selected provider and matching variable in the same shell |
| Doctor passes but chat fails | Verify key permissions, quota, model access and connectivity with a small live request |
| Wrong provider/model | Set ZEX_PROVIDER and ZEX_MODEL; clear stale generic overrides |
| Provider 401 / invalid key | Replace the key and confirm it belongs to the selected service |
| Zex HTTP 401 | Send the server's ZEX_AUTH_TOKEN as a bearer token |
| Provider 404 / model missing | Correct the model ID and endpoint path |
| 429 / quota exhausted | Wait or reduce request rate; check the provider dashboard |
| Invalid config | Check JSON syntax/types, supported provider IDs and ZEX_CONFIG_FILE |
| Ollama connection refused | Start Ollama and install the requested model |
| Responses work but no file edits | Choose a tool-capable model/endpoint, check tools is not false, and check tool policy/approval results |
| npm package not found | Use source installation until publication |

Do not put keys in prompts or bug reports. Review logs/screenshots before sharing: provider errors or tool output may contain sensitive content. The assistant may send project context to the selected provider and execute local tools; use trusted projects and review changes.

## Verification

npm run ci runs deterministic tests and isolated tarball checks without paid API calls, including configuration/routing regressions and packaged doctor checks.

Optional live checks: set ZEX_LIVE_INTEGRATION=true and run npm run test:integration from source. Missing providers skip; these tests do not prove every model or terminal-tool capability.

Report Zex/Node versions, OS, provider/model, terminal versus server mode, and redacted errors. Never attach keys, server tokens, .env or secret-bearing config files.

Built-in Anthropic and headless OpenAI adapters pin their official endpoints. SDK-specific base-URL environment overrides are not supported; use the documented terminal OpenAI-compatible configuration for another endpoint.

## Tool execution and text-only models

Terminal adapters expose the registered read, write, patch, search, directory, project-status and shell tools. Tool calls pass through the existing runner policy and approval callback before execution. Scanners and workspace checks still apply; shell commands are not a sandbox. Plan mode remains advisory.

Set `"tools": false` in your terminal JSON config for a model or endpoint that does not support tools, or when you only want responses. This omits tool schemas and rejects unexpected tool calls; the internal intent clarifier always uses text-only mode. Restart Zex after changing config. Doctor reports toolsEnabled.

OpenAI-compatible and Anthropic adapters buffer a complete tool batch before handing it to the runner. Malformed JSON, duplicate call IDs, non-object arguments, truncated output or missing completion markers produce an error without executing that batch. A batch is limited to 64 indexed calls and 1 MiB of streamed call data. Model-side parallel calls are executed sequentially by the runner.

`npm run test:tools` verifies streamed fragments, tool/result IDs, final token usage and failures. It also runs real file write/read and harmless shell operations in temporary workspaces, plus denied-execution checks, for OpenAI, Anthropic, OpenRouter and Ollama. Those SDK transports are mocked; live model/tool reliability still requires a credentialed walkthrough.

Protocol references: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) and [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming).
