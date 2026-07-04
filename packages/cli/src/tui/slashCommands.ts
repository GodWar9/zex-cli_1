// ─── Slash Command Handler ─────────────────────────────────────────────────────

export type SlashCommandResult =
  | { type: 'clear' }
  | { type: 'keys' }
  | { type: 'plan' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'model'; modelName: string }
  | { type: 'resume' }
  | { type: 'security' }
  | { type: 'context' }
  | { type: 'stats'; budget?: boolean }
  | { type: 'cache-clear' }
  | { type: 'remember'; text: string }
  | { type: 'recall'; query: string }
  | { type: 'export' }
  | { type: 'export-finetune' }
  | { type: 'reset' }
  | { type: 'config'; key?: string }
  | { type: 'deps' }
  | { type: 'cluster' }
  | { type: 'debug' }
  | { type: 'org' }
  | { type: 'audit' }
  | { type: 'login'; args: string }
  | { type: 'help' }
  | { type: 'logs'; enable: boolean }
  | { type: 'unknown'; input: string }
  | { type: 'not_a_command' };

const COMMANDS = [
  { name: '/clear',              desc: 'Clear conversation history' },
  { name: '/reset',              desc: 'Alias for /clear' },
  { name: '/keys',               desc: 'Show API key pool status' },
  { name: '/plan',               desc: 'Toggle plan-before-act mode' },
  { name: '/undo',               desc: 'Revert last file write' },
  { name: '/redo',               desc: 'Redo last undo' },
  { name: '/context',            desc: 'Context size and token budget' },
  { name: '/stats [--budget]',   desc: 'Session metrics and cost' },
  { name: '/cache-clear',        desc: 'Clear response cache' },
  { name: '/remember <text>',    desc: 'Add persistent memory' },
  { name: '/recall [query]',     desc: 'Search memories' },
  { name: '/cluster',            desc: 'Merge duplicate memories' },
  { name: '/deps',               desc: 'Audit npm dependencies for CVEs' },
  { name: '/debug',              desc: 'Toggle collaborative debug mode' },
  { name: '/export',             desc: 'Export session as markdown' },
  { name: '/export-finetune',    desc: 'Export fine-tuning dataset (JSONL)' },
  { name: '/org',                desc: 'Show org settings and policies' },
  { name: '/audit',              desc: 'Show persistent audit log' },
  { name: '/login <creds>',      desc: 'Authenticate (LDAP/SAML/API-key)' },
  { name: '/config',             desc: 'View user config' },
  { name: '/resume',             desc: 'Load last session' },
  { name: '/security',           desc: 'Security event log' },
  { name: '/model <name>',       desc: 'Switch model' },
  { name: '/logs <on|off>',      desc: 'Toggle tool logs' },
  { name: '/help',               desc: 'Show commands' },
];

export function parseSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return { type: 'not_a_command' };

  const [cmd, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ').trim();

  switch (cmd?.toLowerCase()) {
    case '/clear':
    case '/reset':
      return { type: cmd === '/reset' ? 'reset' : 'clear' };
    case '/keys':           return { type: 'keys' };
    case '/plan':           return { type: 'plan' };
    case '/undo':           return { type: 'undo' };
    case '/redo':           return { type: 'redo' };
    case '/context':        return { type: 'context' };
    case '/stats':          return { type: 'stats', budget: arg === '--budget' };
    case '/cache-clear':    return { type: 'cache-clear' };
    case '/export':         return { type: 'export' };
    case '/export-finetune':return { type: 'export-finetune' };
    case '/deps':           return { type: 'deps' };
    case '/cluster':        return { type: 'cluster' };
    case '/debug':          return { type: 'debug' };
    case '/org':            return { type: 'org' };
    case '/audit':          return { type: 'audit' };
    case '/login':          return { type: 'login', args: arg };
    case '/resume':         return { type: 'resume' };
    case '/help':           return { type: 'help' };
    case '/security':       return { type: 'security' };
    case '/remember':
      if (!arg) return { type: 'unknown', input: trimmed };
      return { type: 'remember', text: arg };
    case '/recall':
      return { type: 'recall', query: arg || '' };
    case '/config':
      return { type: 'config', key: arg || undefined };
    case '/logs':
      if (arg === 'enable' || arg === 'on') return { type: 'logs', enable: true };
      if (arg === 'disable' || arg === 'off') return { type: 'logs', enable: false };
      return { type: 'unknown', input: trimmed };
    case '/model':
      if (!arg) return { type: 'unknown', input: trimmed };
      return { type: 'model', modelName: arg };
    default:
      return { type: 'unknown', input: trimmed };
  }
}

export function buildHelpMessage(): string {
  const lines = ['Available commands:', ''];
  for (const cmd of COMMANDS) {
    lines.push(`  ${cmd.name.padEnd(26)} ${cmd.desc}`);
  }
  return lines.join('\n');
}
