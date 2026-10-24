# Zex release installation

This bundle contains the native executable for the platform named in its filename, installable npm tarballs, a user guide, license, exact source identity and acceptance evidence. It does not publish npm packages or include provider credits.

## Standalone executable

Verify the archive against its adjacent SHA-256 file, then extract it with `tar -xzf ARCHIVE.tar.gz` into a new folder. On Windows, `Get-FileHash ARCHIVE.tar.gz -Algorithm SHA256` prints the checksum. macOS/Linux can use `shasum -a 256 ARCHIVE.tar.gz`.

Windows x64:

```powershell
.\zex-win32-x64.exe --version
.\zex-win32-x64.exe --help
.\zex-win32-x64.exe --doctor
```

The executable embeds its runtime. Node.js and Bun are not needed to launch it. An unsigned Windows binary can display a platform reputation prompt; signing and publisher reputation are separate release steps.

Configure your selected model provider using USER_GUIDE.md. `--doctor` checks configuration without calling a paid API. `--doctor --local` checks a loopback Ollama server and installed model, without generation. A passing configuration check does not prove model access or answer quality. Start the interactive application from a real terminal inside the project you want to work on.

## Installable packages

If you prefer npm, Node.js 24.12 or newer is required. Install both included tarballs together into your intended consumer project:

```text
npm install /absolute/path/sahil-zex-core-0.1.0.tgz /absolute/path/sahil-zex-0.1.0.tgz
npx zex --help
```

This local installation does not depend on ownership of the @sahil registry scope. npm still retrieves declared third-party dependencies. Public npm publication requires a separately authorized account and verified scope access.

## Headless deployment

Set a random ZEX_AUTH_TOKEN of at least 32 characters, retain the default loopback bind, set PORT if needed, and run the executable with `--serve`. Keep the token in your service manager or private environment file. Never embed it in browser JavaScript or a URL. If exposing the API through a network, terminate HTTPS at a trusted reverse proxy and keep the direct listener private.

Operational HTTP and WebSocket endpoints require authentication. The budget and queue are process-local; this is a single-operator service rather than a durable multi-tenant hosted platform. Heuristic scanning and advisory plan mode are not a shell sandbox.

## Verification and rollback

release-manifest.json records the source commit and each included file hash. binary-check.json records checks against this exact executable: help/version, offline doctor, refusal of unsafe server starts, authenticated HTTP and WebSocket startup, and invalid-request handling. No credentialed model generation is claimed.

Keep your previous executable and private configuration. Stop the running process before replacing a release. Roll back by restoring the previous executable and its compatible configuration; the bundle does not contain your credentials or user workspace.
