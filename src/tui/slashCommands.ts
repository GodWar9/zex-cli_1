// ─── Slash Command Handler ─────────────────────────────────────────────────────
// Parses and executes /commands typed into the InputBox.
//
// Supported commands:
//   /clear          — wipe conversation history
//   /keys           — show Gemini key pool status
//   /plan           — toggle plan-before-act mode
//   /undo           — revert the last write_file (from undo stack)
//   /model <name>   — switch model for this session
//   /help           — list all slash commands

export type SlashCommandResult =
  | { type: 'clear' }
  | { type: 'keys' }
  | { type: 'plan' }
  | { type: 'undo' }
  | { type: 'model'; modelName: string }
  | { type: 'resume' }
  | { type: 'help' }
  | { type: 'unknown'; input: string }
  | { type: 'not_a_command' }; // input doesn't start with /

const COMMANDS = [
  { name: '/clear',        desc: 'Clear conversation history and start fresh' },
  { name: '/keys',         desc: 'Show Gemini API key pool status (active / cooldown)' },
  { name: '/plan',         desc: 'Toggle plan-before-act mode (agent proposes plan first)' },
  { name: '/undo',         desc: 'Revert the last file write made by the agent' },
  { name: '/resume',       desc: 'Load the most recent session from disk' },
  { name: '/model <name>', desc: 'Switch the active model (e.g. /model gemini-2.0-flash)' },
  { name: '/help',         desc: 'Show this help list' },
];

export function parseSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return { type: 'not_a_command' };

  const [cmd, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ').trim();

  switch (cmd?.toLowerCase()) {
    case '/clear': return { type: 'clear' };
    case '/keys':  return { type: 'keys' };
    case '/plan':  return { type: 'plan' };
    case '/undo':  return { type: 'undo' };
    case '/resume':return { type: 'resume' };
    case '/help':  return { type: 'help' };
    case '/model':
      if (!arg) return { type: 'unknown', input: trimmed };
      return { type: 'model', modelName: arg };
    default:
      return { type: 'unknown', input: trimmed };
  }
}

/** Build a help message string for /help */
export function buildHelpMessage(): string {
  const lines = ['Available commands:', ''];
  for (const cmd of COMMANDS) {
    lines.push(`  ${cmd.name.padEnd(22)} ${cmd.desc}`);
  }
  return lines.join('\n');
}
