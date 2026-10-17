import 'dotenv/config';

// ─── CLI flag handling ────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--local') && !args.includes('--doctor')) {
  console.error('Use --local with --doctor to check a local model server.');
  process.exitCode = 1;
} else if (args.includes('--serve') || args.includes('--server')) {
  // Headless API server mode — no TUI required
  const { shutdown } = await import('./api/server.ts');
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
} else if (args.includes('--doctor')) {
  const { loadConfig } = await import('@sahil/zex-core/config/index.ts');
  try {
    const { provider } = loadConfig();
    const ready = provider.provider === 'ollama' || Boolean(provider.apiKey || provider.apiKeys?.length);
    const local = args.includes('--local') ? await (await import('./local-doctor.ts')).checkLocalProvider(provider) : undefined;
    console.log(JSON.stringify({ provider: provider.provider, model: provider.model, endpoint: provider.baseUrl ? new URL(provider.baseUrl).origin : 'provider default', toolsEnabled: provider.tools !== false, credentials: provider.provider === 'ollama' ? 'not required' : ready ? 'configured' : 'missing', liveConnectionTested: local?.liveConnectionTested ?? false, ...(local ? { local } : {}) }, null, 2));
    if (!ready || (local && local.status !== 'ready')) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid configuration');
    process.exitCode = 1;
  }
} else if (args.includes('--version') || args.includes('-v')) {
  // Print version from package.json
  const pkg = await import('../package.json', { with: { type: 'json' } });
  console.log(`zex v${pkg.default.version}`);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`zex — safe vibe coding CLI

Usage:
  zex                 Launch the interactive TUI
  zex --serve         Run headless API server (port: PORT or 3000)
  zex --doctor        Check terminal provider setup without exposing keys or calling APIs
  zex --doctor --local Check local Ollama connectivity and installed model (no generation)
  zex --version, -v   Print version
  zex --help, -h      Show this help

Environment:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY
  ZEX_PROVIDER, ZEX_MODEL, ZEX_API_KEY, ZEX_BASE_URL   Terminal overrides
  ZEX_CONFIG_FILE     Optional terminal JSON configuration path
  ZEX_AUTH_TOKEN      Required server bearer token (at least 32 characters)
  ZEX_HOST            API bind address (default: 127.0.0.1; public binds require a token)
  PORT                API server port (default: 3000)
  DAILY_BUDGET_USD    Daily spending cap (default: 10.0)
`);
} else {
  // Interactive TUI mode
  const { default: React } = await import('react');
  const { render } = await import('ink');
  const { default: App } = await import('./tui/App.tsx');

  // Global error handlers — prevent silent crashes
  process.on('unhandledRejection', (reason) => {
    console.error('[zex] Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[zex] Uncaught Exception:', err);
    process.exit(1);
  });

  // Enter alternate screen
  process.stdout.write('\x1b[?1049h');
  process.stdout.write('\x1b[2J');
  process.stdout.write('\x1b[H');

  const { waitUntilExit } = render(React.createElement(App), {
    exitOnCtrlC: true,
  });

  await waitUntilExit();

  // Leave alternate screen on exit
  process.stdout.write('\x1b[?1049l');
}
