# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## [Unreleased]

### Fixed

- CI typecheck failure caused by a fragile `Parameters<typeof test>` type extraction against an overloaded `node:test` signature — replaced with the exported `TestFn` type.
- Nightly integration workflow failing on every scheduled run: a missing provider API key hard-failed that provider's live-adapter test instead of skipping it, so any partially-configured (or unconfigured) set of `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` secrets always produced failures. Now skips per-provider when that provider's key isn't set, and still fails loudly on a genuinely invalid key.
- `--serve` crashed under plain Node (`Bun.serve()` doesn't exist outside Bun). Rewrote the headless API server on `node:http` + `ws`, working identically under both Node and Bun — same routes, auth, WebSocket streaming, and metrics broadcast.
- The actual coding-agent tools (`read_file`, `write_file`, `run_shell_command`, the git auto-checkpoint step, and the dependency-vulnerability audit) were built on Bun-only APIs (`Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.spawnSync`) and would have crashed under Node the moment the agent tried to touch a file or run a command. Ported to `node:fs/promises` and `node:child_process`. Verified directly under plain Node, including the shell-command timeout/kill path.
- Found and fixed a pre-existing bug (predates this project's Node/Bun work entirely) in the workspace-boundary check: writing a file into any new nested directory threw `ENOENT` before ever reaching the file-write step, because only one missing parent-directory level was ever resolved. Now walks up to the nearest existing ancestor directory; the workspace-boundary escape check still applies to the result.
- `llm/keyPool.ts` hardcoded `provider` to a fixed `"openai" | "anthropic" | "gemini"` union, so a key for any other provider (openrouter, groq, a self-hosted/OpenAI-compatible endpoint) couldn't be typed or pooled. Widened to `string`, with `KeyPool.registerQuotaDefault()` for configuring real quota limits per custom provider and a sane generic fallback for anything unregistered.
- `detectProvider()` never checked `OPENROUTER_API_KEY`, even though `'openrouter'` was already a supported `ProviderId`.

### Added

- `packages/core/src/index.ts` — the package previously had no public entrypoint at all; `import { ... } from "@zex/core"` would fail instantly.
- A real `tsc` build pipeline for `@zex/core` (`packages/core/tsconfig.json`, `dist/` output with `.d.ts` declarations), so `@zex/core` can be `npm install`ed and imported as a standalone library, not only consumed from inside this monorepo.
- A working, cross-platform-safe build for the `zex` CLI's npm-publishable binary (`packages/cli` `dist/cli.js`, compiled from TSX with a real shebang, externalizing genuine npm dependencies while bundling `@zex/core`'s source in at build time — since Node refuses to type-strip `.ts` files once they're inside `node_modules`, this is what actually makes `npx zex` work post-install).
- READMEs for both publishable packages (`packages/core/README.md`, `packages/cli/README.md`) with install instructions, quickstarts, and API references.
- CI now builds both publishable packages (`build:packages`) on every push, catching packaging regressions automatically instead of only via manual verification.

### Verification method

Every fix above was proven with an actual `npm pack` of both packages followed by a fresh `npm install` of the tarballs in a completely isolated directory (no Bun, no monorepo, no workspace symlinks) — then exercising the real CLI binary and a real `import` of the library, including a live HTTP + WebSocket round-trip against `--serve` — not just re-running the existing test suite in place.

## [0.1.0] - 2026-07-13

### Added

- Reproducible offline benchmark corpus and runner for pruning/cache efficiency claims.
- Nightly live-provider integration test workflow gated by API-key secrets.
- Cold-reader README structure with CI, benchmark, install, and demo status visibility.
- Changelog discipline for future merged changes.

### Changed

- Reframed unverified marketing claims as benchmark-backed or explicitly pending.
