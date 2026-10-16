# Zex release readiness — 2026-10-10

Intended packages: `@sahil/zex-core@0.1.0`, `@sahil/zex@0.1.0`. Command: `zex`. Nothing has been published.

## Reproduce

```sh
bun install --frozen-lockfile
npm run demo
npm run ci
npm run build:ci
```

The CI command runs types, 34 offline checks, six SDK transport regressions, 11 configuration/routing checks, six terminal transport checks, 24 enterprise checks, 33 tool-stream protocol checks plus an isolated runner suite with eight execution/denial cases, and isolated installation of both tarballs. Package checks cover compiled exports, CLI help/version, authenticated health, invalid/oversized requests and startup validation. Reviewed tarballs are written to `.release/`.

Supported minimum: Node.js 24.12. CI targets the minimum and current Node 24 on Windows, Linux and macOS. Local success does not prove remote CI success; inspect the exact commit.

On OneDrive-backed Windows, `bun install --backend copyfile --linker hoisted` can avoid incomplete linked files.

## Remaining gates

- Verify GitHub CI and binaries on their target platforms.
- Establish npm account ownership/publish access to `@sahil`. The npm CLI was logged out at audit. A registry 404 does not establish ownership.
- Run a credentialed provider test and interactive TUI walkthrough. Offline mocks do not verify live availability.
- Verify fresh registry installs after publication.

After account access and release authorization, publish reviewed artifacts in order:

```sh
npm publish .release/sahil-zex-core-0.1.0.tgz --access public
npm publish .release/sahil-zex-0.1.0.tgz --access public
```

The root package is private. The tagged GitHub workflow creates a draft binary release, not an npm publication.

All headless starts require a random token of at least 32 characters. Default bind is loopback; public hosting needs TLS. Budget state resets on restart. This is a single-operator tool. Pattern scanning and advisory plan mode do not sandbox shell execution.

## Playwright transport verification (2026-10-16)

`npm run test:e2e` starts the actual authenticated headless HTTP/WebSocket server
with a deterministic provider registered only in the test process. Four tests cover
authentication, malformed inputs, completed tasks, streaming and rejected socket
upgrades. No external API key is used or charged. `npm run test:e2e:ui` opens the
interactive runner; `npm run test:e2e:report` opens the saved HTML report. CI runs
these checks as part of `npm run ci` and retains reports on success or failure.
The full CI command, including isolated packed-package installation, passed locally.
These transport checks do not establish live model quality or interactive TUI UX.
