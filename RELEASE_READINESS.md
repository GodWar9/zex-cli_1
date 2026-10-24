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

## Native distribution gate 24 October 2026

Use `npm run release:prepare` from a clean committed checkout. It runs the complete source/package/transport suite, builds the native executable, checks that exact binary from an empty consumer directory, then creates an allowlisted release archive. The archive includes the executable, both npm tarballs, user/install guides, license, binary acceptance evidence and a manifest identifying the source commit and SHA-256 of every member. An adjacent SHA-256 file verifies the archive. The bundler extracts the archive, verifies every hash and launches the extracted executable before reporting success.

The six native checks cover version/help, offline configuration diagnosis, refusal of missing/weak auth tokens, authenticated HTTP startup plus malformed requests, and WebSocket startup. They do not perform model generation. Native artifacts are platform-specific; CI checks the native executable on each OS rather than relying on cross-compilation alone.

Both CI workflows now run the executable and archive gates after package/transport checks. Tagged releases remain drafts, and this command does not publish npm packages. A verified local Windows archive can be installed directly without a registry account; provider setup is still required for real model work. See RELEASE_INSTALL.md.

In the current OneDrive checkout, cloud reparse-point test files initially produced No tests found. The two test files were materialized with identical bytes; all four transport cases then passed. No test content or discovery filter was weakened.

The native terminal walkthrough also found and fixed a Ctrl+C process leak: ChatScreen stopped GC but did not close its filesystem watcher. Terminal disposal now closes both watcher and timer on unmount, and the entry point also disposes resources in a finally block while restoring the terminal screen. `test:lifecycle` verifies that a child using real watcher/timer handles exits naturally after idempotent cleanup.

## npm publication path 24 October 2026

The npm packages and native executable are both supported distribution formats. NPM_RELEASE.md documents publication of the exact acceptance-tested tarballs, core-first ordering, checksum verification, interrupted-publish recovery, and fresh public-registry checks of npx, global installation, the zex command and the library import. The package test now exercises the npm command shim as well as the compiled CLI entry point. No provider credentials are needed for these checks.

At preparation time npm authentication is pending. A successful dry-run is not publication. Publication and fresh-install evidence are recorded separately in `.release/npm-publication.json` and `.release/registry-check.json` when those operations succeed.
