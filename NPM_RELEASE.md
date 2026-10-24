# npm and standalone distribution

Zex keeps both distribution paths: the npm CLI exposes the `zex` command on Node.js 24.12+, and the native executable embeds its runtime. The private repository root is never published.

The public packages are `@sahil/zex-core` (library) and `@sahil/zex` (CLI). The CLI depends on the library, so publish the core first. Confirm the npm account owns this scope before the first publication; a registry 404 does not prove ownership. The user completes npm login and any required browser/2FA prompts themselves.

## Prepare reviewed tarballs

```sh
npm run ci
npm run release:npm:dry-run
```

`test:package`, included in CI, builds and packs the two workspaces, installs them into an isolated consumer, verifies the library export and the actual npm `zex` command, exercises diagnostics and authenticated server behavior, then records SHA-256 and npm SHA-512 integrity in `.release/npm-packages.json`. A failed check removes the old evidence file. The public publishing dry-run uses those exact tarballs and never rebuilds during publication.

## Publish

```sh
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm run release:npm
npm run test:registry
```

`release:npm` publishes publicly to npmjs.org in dependency order. It verifies the tarball hashes before publishing and confirms that each registry version has the same integrity afterward. If interrupted between packages, rerun it: an existing version is skipped only when its bytes match the reviewed artifact. A version with different bytes stops the release and requires a version bump. npm may request a separate browser/2FA approval per package.

`test:registry` uses a new npm cache, empty user configuration, and an isolated consumer. It verifies a fresh `npx` run, global installation and its command shim, offline doctor, and the public library import. It does not invoke any model provider. Results are written to `.release/registry-check.json`; successful publication is recorded separately in `.release/npm-publication.json`.

## User installation

```sh
npm install -g @sahil/zex
zex --help
zex --doctor
```

Or use `npx @sahil/zex`. Configure your provider using the included USER_GUIDE.md. For the standalone distribution, follow RELEASE_INSTALL.md; its binary builds and acceptance checks remain independent of registry publication.

## Later versions

Bump the versions in the root and both workspaces and update the CLI's core dependency. Refresh the lockfile, run CI and repeat the same checks before publishing. npm versions are immutable; a published mistake requires a new version. Do not remove a working release as a routine rollback.

The existing GitHub tag workflow continues to create standalone draft releases. It does not automatically publish npm packages. Token-free CI publication can be enabled later by configuring npm trusted publishing for this repository; no npm credential is committed to Git.

Official reference: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
