import 'dotenv/config';

// ─── CLI flag handling ────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--serve') || args.includes('--server')) {
  // Headless API server mode — no TUI required.
  // NOTE: currently implemented on Bun.serve() and requires the Bun runtime.
  // Tracked as a known limitation; a Node-native (http + ws) implementation
  // is proposed as follow-up work so `--serve` also works under plain Node.
  if (typeof (globalThis as any).Bun === 'undefined') {
    console.error(
      '[zex] --serve currently requires the Bun runtime (uses Bun.serve()).\n' +
      '      Run it with: bunx zex --serve\n' +
      '      (The interactive TUI — plain `zex` — works fine under Node.)'
    );
    process.exit(1);
  }
  const { shutdown } = await import('./api/server.ts');
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
} else if (args.includes('--version') || args.includes('-v')) {
  // Print version from package.json
  const pkg = await import('../package.json', { with: { type: 'json' } });
  console.log(`zex v${pkg.default.version}`);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`zex — safe vibe coding CLI

Usage:
  zex                 Launch the interactive TUI
  zex --serve         Run headless API server (port: PORT or 3000) — requires Bun runtime
  zex --version, -v   Print version
  zex --help, -h      Show this help

Environment:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
  ZEX_AUTH_REQUIRED   Set to "true" to fail closed when no token is configured
  ZEX_AUTH_TOKEN      Bearer token for API auth
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
