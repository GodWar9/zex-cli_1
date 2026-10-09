# Zex release readiness — 2026-10-09

Intended packages: `@sahil/zex-core@0.1.0`, `@sahil/zex@0.1.0`. Command: `zex`. Nothing has been published.

## Reproduce

```sh
bun install --frozen-lockfile
npm run demo
npm run ci
npm run build:ci
```

The CI command runs types, 34 offline checks, six SDK transport regressions, 24 enterprise checks, and isolated installation of both tarballs. Package checks cover compiled exports, CLI help/version, authenticated health, invalid/oversized requests and startup validation. Reviewed tarballs are written to `.release/`.

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
