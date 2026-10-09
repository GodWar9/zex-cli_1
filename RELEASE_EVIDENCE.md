# Verified release evidence

Code commit: f90aef3604c33198309eddee9a99b54c5e8b18be (2026-10-09).

[GitHub CI run](https://github.com/GodWar9/zex-cli_1/actions/runs/37889587772)
passed all six jobs: Linux, macOS and Windows, each with Node 24.12.0 and Node 24.
Each job ran the offline demo, type checking, 34 offline checks, six provider SDK
regressions, 24 enterprise/API checks, isolated npm tarball installation and runtime
checks, and the standalone binary build. Built binaries on Linux/macOS were not
interactively exercised in this audit.

Local Windows verification: standalone binary --version, Node terminal UI launch,
and /help command. No live model calls were made. Tarballs are under .release/
after npm run ci; equivalent CI artifacts are attached to the linked run.

The offline demo reported 1,517 first-turn prompt tokens and 426 tool-result-turn
tokens in the audited local environment. This is an illustrative prompt-selection
comparison, not a real API cost or quality benchmark.

## Three-minute interview walkthrough

1. Run npm run demo to show real prompt selection and security-pattern scanning.
2. Explain the separation between terminal tool execution and the headless model
   queue, and why a server token must never be embedded in browser JavaScript.
3. Open scripts/check-packages.mjs to show how a clean consumer catches packaging
   failures that monorepo tests miss. Show the six-platform/version CI results.
4. Explain a concrete regression: old special API-key strings returned fabricated
   responses; provider adapters now call SDK transports, with mocks only in tests.
5. State limitations: heuristic scanning, advisory plan mode, process-local budget,
   and unverified live-provider access. Explain the next release gates.

Suggested resume bullet, if it accurately describes your contribution:

Built a TypeScript terminal coding assistant with model-provider adapters,
authenticated HTTP/WebSocket APIs, and isolated npm package validation across
Linux, macOS and Windows using GitHub Actions.

Publishing remains blocked on npm authentication and confirmed @sahil scope access.
The source demo is usable now; registry installation is not yet available.
